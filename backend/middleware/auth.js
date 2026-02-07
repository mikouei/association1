import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_this';

// Client Prisma par défaut (pour V1 - assocmanager.db)
const defaultPrisma = new PrismaClient();

// Cache pour les wrappers SQLite par association
const sqliteClients = new Map();

// Helper pour convertir les valeurs pour SQLite
const toSqlite = (value) => {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
};

// Helper pour convertir les valeurs depuis SQLite
const fromSqlite = (row) => {
  if (!row) return null;
  const result = { ...row };
  if ('active' in result) result.active = !!result.active;
  return result;
};

// Créer un wrapper SQLite compatible Prisma pour une association
export const getSqliteClientForAssociation = (dbName) => {
  // Pour la DB par défaut, utiliser le client Prisma standard
  if (dbName === 'assocmanager.db') {
    return defaultPrisma;
  }
  
  // Si déjà en cache, retourner
  if (sqliteClients.has(dbName)) {
    return sqliteClients.get(dbName);
  }

  const dbPath = path.join(__dirname, '../prisma', dbName);
  
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Base de données non trouvée: ${dbName}`);
  }

  const db = new Database(dbPath);
  
  // Créer un wrapper compatible Prisma
  const client = {
    _db: db,
    _dbName: dbName,

    // ==================== USER ====================
    user: {
      findUnique: async ({ where, include }) => {
        if (!where || (!where.id && !where.email && !where.token)) {
          return null;
        }
        
        let user = null;
        if (where.id) {
          user = db.prepare('SELECT * FROM User WHERE id = ?').get(where.id);
        } else if (where.email) {
          user = db.prepare('SELECT * FROM User WHERE email = ?').get(where.email);
        } else if (where.token) {
          user = db.prepare('SELECT * FROM User WHERE token = ?').get(where.token);
        }
        
        if (!user) return null;
        user = fromSqlite(user);
        
        if (include?.member) {
          const member = db.prepare('SELECT * FROM Member WHERE userId = ?').get(user.id);
          user.member = fromSqlite(member);
        }
        
        return user;
      },
      
      findFirst: async ({ where, include } = {}) => {
        let sql = 'SELECT * FROM User WHERE 1=1';
        const params = [];
        
        if (where) {
          if (where.OR) {
            const orConditions = where.OR.map(cond => {
              const key = Object.keys(cond)[0];
              params.push(cond[key]);
              return `${key} = ?`;
            }).join(' OR ');
            sql += ` AND (${orConditions})`;
          }
          if (where.token !== undefined) {
            sql += ' AND token = ?';
            params.push(where.token);
          }
          if (where.active !== undefined) {
            sql += ' AND active = ?';
            params.push(where.active ? 1 : 0);
          }
          if (where.role !== undefined) {
            sql += ' AND role = ?';
            params.push(where.role);
          }
          if (where.phone !== undefined) {
            sql += ' AND phone = ?';
            params.push(where.phone);
          }
          if (where.email !== undefined) {
            sql += ' AND email = ?';
            params.push(where.email);
          }
        }
        
        sql += ' LIMIT 1';
        let user = db.prepare(sql).get(...params);
        
        if (!user) return null;
        user = fromSqlite(user);
        
        if (include?.member) {
          const member = db.prepare('SELECT * FROM Member WHERE userId = ?').get(user.id);
          user.member = fromSqlite(member);
        }
        
        return user;
      },

      findMany: async ({ where, include, orderBy } = {}) => {
        let sql = 'SELECT * FROM User WHERE 1=1';
        const params = [];
        
        if (where) {
          if (where.role) {
            sql += ' AND role = ?';
            params.push(where.role);
          }
          if (where.active !== undefined) {
            sql += ' AND active = ?';
            params.push(where.active ? 1 : 0);
          }
        }
        
        if (orderBy) {
          const key = Object.keys(orderBy)[0];
          const dir = orderBy[key] === 'desc' ? 'DESC' : 'ASC';
          sql += ` ORDER BY ${key} ${dir}`;
        }
        
        const users = db.prepare(sql).all(...params);
        
        return users.map(user => {
          user = fromSqlite(user);
          if (include?.member) {
            const member = db.prepare('SELECT * FROM Member WHERE userId = ?').get(user.id);
            user.member = fromSqlite(member);
          }
          return user;
        });
      },

      create: async ({ data }) => {
        const id = data.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO User (id, email, phone, passwordHash, role, token, active, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, 
          toSqlite(data.email), 
          toSqlite(data.phone), 
          toSqlite(data.passwordHash),
          data.role || 'MEMBER', 
          toSqlite(data.token), 
          data.active !== false ? 1 : 0,
          now, 
          now
        );
        
        return fromSqlite({ id, ...data, active: data.active !== false, createdAt: now, updatedAt: now });
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          sets.push(`${key} = ?`);
          params.push(toSqlite(data[key]));
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE User SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        return fromSqlite(db.prepare('SELECT * FROM User WHERE id = ?').get(where.id));
      },

      delete: async ({ where }) => {
        const user = db.prepare('SELECT * FROM User WHERE id = ?').get(where.id);
        db.prepare('DELETE FROM User WHERE id = ?').run(where.id);
        return fromSqlite(user);
      }
    },

    // ==================== MEMBER ====================
    member: {
      findUnique: async ({ where, include }) => {
        let member = null;
        if (where.id) {
          member = db.prepare('SELECT * FROM Member WHERE id = ?').get(where.id);
        } else if (where.userId) {
          member = db.prepare('SELECT * FROM Member WHERE userId = ?').get(where.userId);
        }
        
        if (!member) return null;
        member = fromSqlite(member);
        
        if (include?.user) {
          const user = db.prepare('SELECT * FROM User WHERE id = ?').get(member.userId);
          member.user = fromSqlite(user);
        }
        if (include?.payments) {
          let paymentSql = 'SELECT * FROM MonthlyPayment WHERE memberId = ?';
          const paymentParams = [member.id];
          if (include.payments.where?.yearId) {
            paymentSql += ' AND yearId = ?';
            paymentParams.push(include.payments.where.yearId);
          }
          member.payments = db.prepare(paymentSql).all(...paymentParams);
        }
        
        return member;
      },

      findMany: async ({ where, include, orderBy } = {}) => {
        let sql = 'SELECT * FROM Member WHERE 1=1';
        const params = [];
        
        if (where) {
          if (where.active !== undefined) {
            sql += ' AND active = ?';
            params.push(where.active ? 1 : 0);
          }
        }
        
        if (orderBy) {
          const key = Object.keys(orderBy)[0];
          const dir = orderBy[key] === 'desc' ? 'DESC' : 'ASC';
          sql += ` ORDER BY ${key} ${dir}`;
        }
        
        const members = db.prepare(sql).all(...params);
        
        return members.map(member => {
          member = fromSqlite(member);
          if (include?.user) {
            const user = db.prepare('SELECT * FROM User WHERE id = ?').get(member.userId);
            member.user = fromSqlite(user);
          }
          if (include?.payments) {
            let paymentSql = 'SELECT * FROM MonthlyPayment WHERE memberId = ?';
            const paymentParams = [member.id];
            if (include.payments.where?.yearId) {
              paymentSql += ' AND yearId = ?';
              paymentParams.push(include.payments.where.yearId);
            }
            member.payments = db.prepare(paymentSql).all(...paymentParams);
          }
          return member;
        });
      },

      create: async ({ data }) => {
        const id = data.id || `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO Member (id, userId, name, customFieldValue, active, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, 
          toSqlite(data.userId), 
          toSqlite(data.name), 
          toSqlite(data.customFieldValue), 
          data.active !== false ? 1 : 0, 
          now, 
          now
        );
        
        return fromSqlite({ id, ...data, active: data.active !== false, createdAt: now, updatedAt: now });
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          sets.push(`${key} = ?`);
          params.push(toSqlite(data[key]));
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE Member SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        return fromSqlite(db.prepare('SELECT * FROM Member WHERE id = ?').get(where.id));
      },

      delete: async ({ where }) => {
        const member = db.prepare('SELECT * FROM Member WHERE id = ?').get(where.id);
        db.prepare('DELETE FROM Member WHERE id = ?').run(where.id);
        return fromSqlite(member);
      },

      count: async ({ where } = {}) => {
        let sql = 'SELECT COUNT(*) as count FROM Member WHERE 1=1';
        const params = [];
        
        if (where?.active !== undefined) {
          sql += ' AND active = ?';
          params.push(where.active ? 1 : 0);
        }
        
        return db.prepare(sql).get(...params).count;
      }
    },

    // ==================== ASSOCIATION CONFIG ====================
    associationConfig: {
      findFirst: async () => {
        return fromSqlite(db.prepare('SELECT * FROM AssociationConfig LIMIT 1').get());
      },

      create: async ({ data }) => {
        const id = `config_${Date.now()}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO AssociationConfig (id, name, type, memberFieldLabel, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, toSqlite(data.name), toSqlite(data.type), data.memberFieldLabel || 'Villa', now, now);
        
        return fromSqlite({ id, ...data, createdAt: now, updatedAt: now });
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          sets.push(`${key} = ?`);
          params.push(toSqlite(data[key]));
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE AssociationConfig SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        return fromSqlite(db.prepare('SELECT * FROM AssociationConfig WHERE id = ?').get(where.id));
      }
    },

    // ==================== YEAR ====================
    year: {
      findUnique: async ({ where }) => {
        let year = null;
        if (where.id) {
          year = db.prepare('SELECT * FROM Year WHERE id = ?').get(where.id);
        } else if (where.year) {
          year = db.prepare('SELECT * FROM Year WHERE year = ?').get(where.year);
        }
        return fromSqlite(year);
      },

      findFirst: async ({ where } = {}) => {
        let sql = 'SELECT * FROM Year WHERE 1=1';
        const params = [];
        
        if (where?.active !== undefined) {
          sql += ' AND active = ?';
          params.push(where.active ? 1 : 0);
        }
        if (where?.year !== undefined) {
          sql += ' AND year = ?';
          params.push(where.year);
        }
        
        sql += ' LIMIT 1';
        return fromSqlite(db.prepare(sql).get(...params));
      },

      findMany: async ({ where, orderBy } = {}) => {
        let sql = 'SELECT * FROM Year WHERE 1=1';
        const params = [];
        
        if (where?.active !== undefined) {
          sql += ' AND active = ?';
          params.push(where.active ? 1 : 0);
        }
        
        if (orderBy) {
          const key = Object.keys(orderBy)[0];
          const dir = orderBy[key] === 'desc' ? 'DESC' : 'ASC';
          sql += ` ORDER BY ${key} ${dir}`;
        }
        
        return db.prepare(sql).all(...params).map(fromSqlite);
      },

      create: async ({ data }) => {
        const id = data.id || `year_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO Year (id, year, monthlyAmount, active, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          id, 
          toSqlite(data.year), 
          toSqlite(data.monthlyAmount), 
          data.active ? 1 : 0, 
          now, 
          now
        );
        
        return fromSqlite({ id, ...data, createdAt: now, updatedAt: now });
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          sets.push(`${key} = ?`);
          params.push(toSqlite(data[key]));
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE Year SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        return fromSqlite(db.prepare('SELECT * FROM Year WHERE id = ?').get(where.id));
      },

      updateMany: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          sets.push(`${key} = ?`);
          params.push(toSqlite(data[key]));
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        
        let sql = `UPDATE Year SET ${sets.join(', ')}`;
        if (where) {
          // Add where conditions if needed
        }
        
        const result = db.prepare(sql).run(...params);
        return { count: result.changes };
      }
    },

    // ==================== MONTHLY PAYMENT ====================
    monthlyPayment: {
      findFirst: async ({ where } = {}) => {
        let sql = 'SELECT * FROM MonthlyPayment WHERE 1=1';
        const params = [];
        
        if (where?.memberId) { sql += ' AND memberId = ?'; params.push(where.memberId); }
        if (where?.yearId) { sql += ' AND yearId = ?'; params.push(where.yearId); }
        if (where?.month !== undefined) { sql += ' AND month = ?'; params.push(where.month); }
        
        sql += ' LIMIT 1';
        return fromSqlite(db.prepare(sql).get(...params));
      },

      findMany: async ({ where, include, orderBy } = {}) => {
        let sql = 'SELECT * FROM MonthlyPayment WHERE 1=1';
        const params = [];
        
        if (where?.memberId) { sql += ' AND memberId = ?'; params.push(where.memberId); }
        if (where?.yearId) { sql += ' AND yearId = ?'; params.push(where.yearId); }
        
        if (orderBy) {
          const key = Object.keys(orderBy)[0];
          const dir = orderBy[key] === 'desc' ? 'DESC' : 'ASC';
          sql += ` ORDER BY ${key} ${dir}`;
        }
        
        const payments = db.prepare(sql).all(...params);
        
        return payments.map(payment => {
          payment = fromSqlite(payment);
          if (include?.member) {
            const member = db.prepare('SELECT * FROM Member WHERE id = ?').get(payment.memberId);
            payment.member = fromSqlite(member);
          }
          return payment;
        });
      },

      create: async ({ data }) => {
        const id = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO MonthlyPayment (id, memberId, yearId, month, amountPaid, paymentDate, notes, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, 
          toSqlite(data.memberId), 
          toSqlite(data.yearId), 
          toSqlite(data.month), 
          toSqlite(data.amountPaid), 
          toSqlite(data.paymentDate) || now, 
          toSqlite(data.notes), 
          now, 
          now
        );
        
        return fromSqlite({ id, ...data, createdAt: now, updatedAt: now });
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          sets.push(`${key} = ?`);
          params.push(toSqlite(data[key]));
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE MonthlyPayment SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        return fromSqlite(db.prepare('SELECT * FROM MonthlyPayment WHERE id = ?').get(where.id));
      },

      upsert: async ({ where, create, update }) => {
        const key = where.memberId_yearId_month;
        const existing = db.prepare(
          'SELECT * FROM MonthlyPayment WHERE memberId = ? AND yearId = ? AND month = ?'
        ).get(key.memberId, key.yearId, key.month);
        
        if (existing) {
          const sets = [];
          const params = [];
          
          Object.keys(update).forEach(k => {
            sets.push(`${k} = ?`);
            params.push(toSqlite(update[k]));
          });
          
          sets.push('updatedAt = ?');
          params.push(new Date().toISOString());
          params.push(existing.id);
          
          db.prepare(`UPDATE MonthlyPayment SET ${sets.join(', ')} WHERE id = ?`).run(...params);
          
          return fromSqlite(db.prepare('SELECT * FROM MonthlyPayment WHERE id = ?').get(existing.id));
        } else {
          const id = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const now = new Date().toISOString();
          
          db.prepare(`
            INSERT INTO MonthlyPayment (id, memberId, yearId, month, amountPaid, paymentDate, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            id, 
            toSqlite(create.memberId), 
            toSqlite(create.yearId), 
            toSqlite(create.month), 
            toSqlite(create.amountPaid), 
            toSqlite(create.paymentDate) || now, 
            toSqlite(create.notes), 
            now, 
            now
          );
          
          return fromSqlite({ id, ...create, createdAt: now, updatedAt: now });
        }
      },

      delete: async ({ where }) => {
        const payment = db.prepare('SELECT * FROM MonthlyPayment WHERE id = ?').get(where.id);
        db.prepare('DELETE FROM MonthlyPayment WHERE id = ?').run(where.id);
        return fromSqlite(payment);
      }
    },

    // ==================== EXCEPTIONAL CONTRIBUTION ====================
    exceptionalContribution: {
      findUnique: async ({ where, include }) => {
        const contrib = db.prepare('SELECT * FROM ExceptionalContribution WHERE id = ?').get(where.id);
        if (!contrib) return null;
        
        const result = fromSqlite(contrib);
        
        if (include?.payments) {
          let payments = db.prepare('SELECT * FROM ExceptionalPayment WHERE contributionId = ?').all(contrib.id);
          
          if (include.payments.include?.member) {
            payments = payments.map(p => {
              const member = db.prepare('SELECT * FROM Member WHERE id = ?').get(p.memberId);
              return { ...fromSqlite(p), member: fromSqlite(member) };
            });
          }
          result.payments = payments;
        }
        
        return result;
      },

      findMany: async ({ where, include, orderBy } = {}) => {
        let sql = 'SELECT * FROM ExceptionalContribution WHERE 1=1';
        const params = [];
        
        if (where?.active !== undefined) {
          sql += ' AND active = ?';
          params.push(where.active ? 1 : 0);
        }
        
        if (orderBy) {
          const key = Object.keys(orderBy)[0];
          const dir = orderBy[key] === 'desc' ? 'DESC' : 'ASC';
          sql += ` ORDER BY ${key} ${dir}`;
        }
        
        const contribs = db.prepare(sql).all(...params);
        
        return contribs.map(contrib => {
          const result = fromSqlite(contrib);
          if (include?.payments) {
            result.payments = db.prepare('SELECT * FROM ExceptionalPayment WHERE contributionId = ?').all(contrib.id);
          }
          return result;
        });
      },

      create: async ({ data }) => {
        const id = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO ExceptionalContribution (id, title, type, description, active, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, 
          toSqlite(data.title), 
          toSqlite(data.type), 
          toSqlite(data.description), 
          data.active !== false ? 1 : 0, 
          now, 
          now
        );
        
        return fromSqlite({ id, ...data, active: data.active !== false, createdAt: now, updatedAt: now });
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          sets.push(`${key} = ?`);
          params.push(toSqlite(data[key]));
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE ExceptionalContribution SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        return fromSqlite(db.prepare('SELECT * FROM ExceptionalContribution WHERE id = ?').get(where.id));
      }
    },

    // ==================== EXCEPTIONAL PAYMENT ====================
    exceptionalPayment: {
      findFirst: async ({ where } = {}) => {
        let sql = 'SELECT * FROM ExceptionalPayment WHERE 1=1';
        const params = [];
        
        if (where?.contributionId) { sql += ' AND contributionId = ?'; params.push(where.contributionId); }
        if (where?.memberId) { sql += ' AND memberId = ?'; params.push(where.memberId); }
        
        sql += ' LIMIT 1';
        return fromSqlite(db.prepare(sql).get(...params));
      },

      findMany: async ({ where, include } = {}) => {
        let sql = 'SELECT * FROM ExceptionalPayment WHERE 1=1';
        const params = [];
        
        if (where?.contributionId) { sql += ' AND contributionId = ?'; params.push(where.contributionId); }
        if (where?.memberId) { sql += ' AND memberId = ?'; params.push(where.memberId); }
        
        const payments = db.prepare(sql).all(...params);
        
        return payments.map(p => {
          const result = fromSqlite(p);
          if (include?.member) {
            const member = db.prepare('SELECT * FROM Member WHERE id = ?').get(p.memberId);
            result.member = fromSqlite(member);
          }
          return result;
        });
      },

      create: async ({ data }) => {
        const id = `expay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO ExceptionalPayment (id, contributionId, memberId, amount, paymentDate, notes, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, 
          toSqlite(data.contributionId), 
          toSqlite(data.memberId), 
          toSqlite(data.amount), 
          toSqlite(data.paymentDate) || now, 
          toSqlite(data.notes), 
          now, 
          now
        );
        
        return fromSqlite({ id, ...data, createdAt: now, updatedAt: now });
      },

      delete: async ({ where }) => {
        const payment = db.prepare('SELECT * FROM ExceptionalPayment WHERE id = ?').get(where.id);
        db.prepare('DELETE FROM ExceptionalPayment WHERE id = ?').run(where.id);
        return fromSqlite(payment);
      }
    },

    // ==================== TRANSACTION ====================
    $transaction: async function(operationsOrCallback) {
      db.prepare('BEGIN').run();
      try {
        let result;
        
        if (typeof operationsOrCallback === 'function') {
          // Mode callback - passer le client lui-même
          result = await operationsOrCallback(this);
        } else if (Array.isArray(operationsOrCallback)) {
          // Mode tableau de promesses
          result = [];
          for (const op of operationsOrCallback) {
            result.push(await op);
          }
        }
        
        db.prepare('COMMIT').run();
        return result;
      } catch (error) {
        db.prepare('ROLLBACK').run();
        throw error;
      }
    }
  };
  
  sqliteClients.set(dbName, client);
  return client;
};

// Middleware pour vérifier le JWT et charger la bonne DB
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Charger la bonne DB selon le token
    if (decoded.dbName) {
      req.prisma = getSqliteClientForAssociation(decoded.dbName);
      req.associationId = decoded.associationId;
      req.dbName = decoded.dbName;
    } else {
      req.prisma = defaultPrisma;
    }
    
    // Vérifier que userId existe
    if (!decoded.userId) {
      return res.status(401).json({ error: 'Token invalide - userId manquant' });
    }
    
    // Récupérer l'utilisateur
    const user = await req.prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { member: true }
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Utilisateur inactif ou introuvable' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(403).json({ error: 'Token invalide' });
  }
};

// Middleware pour vérifier le rôle ADMIN
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
};

// Générer un token JWT avec association
export const generateToken = (userId, associationId = null, dbName = null) => {
  const payload = { userId };
  if (associationId) payload.associationId = associationId;
  if (dbName) payload.dbName = dbName;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
};

// Générer un token d'accès simple pour les membres
export const generateAccessToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
