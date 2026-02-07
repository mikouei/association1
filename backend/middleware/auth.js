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
  const client = createPrismaCompatibleWrapper(db, dbName);
  
  sqliteClients.set(dbName, client);
  return client;
};

// Créer un wrapper compatible avec l'API Prisma
function createPrismaCompatibleWrapper(db, dbName) {
  return {
    _db: db,
    _dbName: dbName,

    // User model
    user: {
      findUnique: async ({ where, include }) => {
        let user;
        if (where.id) {
          user = db.prepare('SELECT * FROM User WHERE id = ?').get(where.id);
        } else if (where.email) {
          user = db.prepare('SELECT * FROM User WHERE email = ?').get(where.email);
        } else if (where.token) {
          user = db.prepare('SELECT * FROM User WHERE token = ?').get(where.token);
        }
        
        if (!user) return null;
        user.active = !!user.active;
        
        if (include?.member) {
          const member = db.prepare('SELECT * FROM Member WHERE userId = ?').get(user.id);
          user.member = member ? { ...member, active: !!member.active } : null;
        }
        
        return user;
      },
      
      findFirst: async ({ where, include }) => {
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
        }
        
        sql += ' LIMIT 1';
        const user = db.prepare(sql).get(...params);
        
        if (!user) return null;
        user.active = !!user.active;
        
        if (include?.member) {
          const member = db.prepare('SELECT * FROM Member WHERE userId = ?').get(user.id);
          user.member = member ? { ...member, active: !!member.active } : null;
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
          user.active = !!user.active;
          if (include?.member) {
            const member = db.prepare('SELECT * FROM Member WHERE userId = ?').get(user.id);
            user.member = member ? { ...member, active: !!member.active } : null;
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
          id, data.email, data.phone || null, data.passwordHash,
          data.role || 'MEMBER', data.token || null, data.active !== false ? 1 : 0,
          now, now
        );
        
        return { id, ...data, active: data.active !== false, createdAt: now, updatedAt: now };
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          if (key === 'active') {
            sets.push('active = ?');
            params.push(data[key] ? 1 : 0);
          } else {
            sets.push(`${key} = ?`);
            params.push(data[key]);
          }
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE User SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        return db.prepare('SELECT * FROM User WHERE id = ?').get(where.id);
      },

      delete: async ({ where }) => {
        const user = db.prepare('SELECT * FROM User WHERE id = ?').get(where.id);
        db.prepare('DELETE FROM User WHERE id = ?').run(where.id);
        return user;
      }
    },

    // Member model
    member: {
      findUnique: async ({ where, include }) => {
        let member;
        if (where.id) {
          member = db.prepare('SELECT * FROM Member WHERE id = ?').get(where.id);
        } else if (where.userId) {
          member = db.prepare('SELECT * FROM Member WHERE userId = ?').get(where.userId);
        }
        
        if (!member) return null;
        member.active = !!member.active;
        
        if (include?.user) {
          const user = db.prepare('SELECT * FROM User WHERE id = ?').get(member.userId);
          member.user = user ? { ...user, active: !!user.active } : null;
        }
        if (include?.payments) {
          const whereClause = include.payments.where;
          let paymentSql = 'SELECT * FROM MonthlyPayment WHERE memberId = ?';
          const paymentParams = [member.id];
          if (whereClause?.yearId) {
            paymentSql += ' AND yearId = ?';
            paymentParams.push(whereClause.yearId);
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
          member.active = !!member.active;
          if (include?.user) {
            const user = db.prepare('SELECT * FROM User WHERE id = ?').get(member.userId);
            member.user = user ? { ...user, active: !!user.active } : null;
          }
          if (include?.payments) {
            const whereClause = include.payments.where;
            let paymentSql = 'SELECT * FROM MonthlyPayment WHERE memberId = ?';
            const paymentParams = [member.id];
            if (whereClause?.yearId) {
              paymentSql += ' AND yearId = ?';
              paymentParams.push(whereClause.yearId);
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
        `).run(id, data.userId, data.name, data.customFieldValue, data.active !== false ? 1 : 0, now, now);
        
        return { id, ...data, active: data.active !== false, createdAt: now, updatedAt: now };
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          if (key === 'active') {
            sets.push('active = ?');
            params.push(data[key] ? 1 : 0);
          } else {
            sets.push(`${key} = ?`);
            params.push(data[key]);
          }
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE Member SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        return db.prepare('SELECT * FROM Member WHERE id = ?').get(where.id);
      },

      delete: async ({ where }) => {
        const member = db.prepare('SELECT * FROM Member WHERE id = ?').get(where.id);
        db.prepare('DELETE FROM Member WHERE id = ?').run(where.id);
        return member;
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

    // AssociationConfig model
    associationConfig: {
      findFirst: async () => {
        const config = db.prepare('SELECT * FROM AssociationConfig LIMIT 1').get();
        return config || null;
      },

      create: async ({ data }) => {
        const id = `config_${Date.now()}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO AssociationConfig (id, name, type, memberFieldLabel, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, data.name, data.type || null, data.memberFieldLabel || 'Villa', now, now);
        
        return { id, ...data, createdAt: now, updatedAt: now };
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          sets.push(`${key} = ?`);
          params.push(data[key]);
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE AssociationConfig SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        return db.prepare('SELECT * FROM AssociationConfig WHERE id = ?').get(where.id);
      }
    },

    // Year model
    year: {
      findUnique: async ({ where }) => {
        if (where.id) {
          return db.prepare('SELECT * FROM Year WHERE id = ?').get(where.id);
        } else if (where.year) {
          return db.prepare('SELECT * FROM Year WHERE year = ?').get(where.year);
        }
        return null;
      },

      findFirst: async ({ where }) => {
        let sql = 'SELECT * FROM Year WHERE 1=1';
        const params = [];
        
        if (where?.active !== undefined) {
          sql += ' AND active = ?';
          params.push(where.active ? 1 : 0);
        }
        
        sql += ' LIMIT 1';
        const year = db.prepare(sql).get(...params);
        return year ? { ...year, active: !!year.active } : null;
      },

      findMany: async ({ orderBy } = {}) => {
        let sql = 'SELECT * FROM Year';
        
        if (orderBy) {
          const key = Object.keys(orderBy)[0];
          const dir = orderBy[key] === 'desc' ? 'DESC' : 'ASC';
          sql += ` ORDER BY ${key} ${dir}`;
        }
        
        return db.prepare(sql).all().map(y => ({ ...y, active: !!y.active }));
      },

      create: async ({ data }) => {
        const id = `year_${Date.now()}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO Year (id, year, monthlyAmount, active, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, data.year, data.monthlyAmount, data.active ? 1 : 0, now, now);
        
        return { id, ...data, createdAt: now, updatedAt: now };
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          if (key === 'active') {
            sets.push('active = ?');
            params.push(data[key] ? 1 : 0);
          } else {
            sets.push(`${key} = ?`);
            params.push(data[key]);
          }
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE Year SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        const year = db.prepare('SELECT * FROM Year WHERE id = ?').get(where.id);
        return year ? { ...year, active: !!year.active } : null;
      },

      updateMany: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          if (key === 'active') {
            sets.push('active = ?');
            params.push(data[key] ? 1 : 0);
          } else {
            sets.push(`${key} = ?`);
            params.push(data[key]);
          }
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        
        db.prepare(`UPDATE Year SET ${sets.join(', ')}`).run(...params);
        
        return { count: 1 };
      }
    },

    // MonthlyPayment model
    monthlyPayment: {
      findFirst: async ({ where }) => {
        let sql = 'SELECT * FROM MonthlyPayment WHERE 1=1';
        const params = [];
        
        if (where?.memberId) { sql += ' AND memberId = ?'; params.push(where.memberId); }
        if (where?.yearId) { sql += ' AND yearId = ?'; params.push(where.yearId); }
        if (where?.month) { sql += ' AND month = ?'; params.push(where.month); }
        
        sql += ' LIMIT 1';
        return db.prepare(sql).get(...params) || null;
      },

      findMany: async ({ where, orderBy } = {}) => {
        let sql = 'SELECT * FROM MonthlyPayment WHERE 1=1';
        const params = [];
        
        if (where?.memberId) { sql += ' AND memberId = ?'; params.push(where.memberId); }
        if (where?.yearId) { sql += ' AND yearId = ?'; params.push(where.yearId); }
        
        if (orderBy) {
          const key = Object.keys(orderBy)[0];
          const dir = orderBy[key] === 'desc' ? 'DESC' : 'ASC';
          sql += ` ORDER BY ${key} ${dir}`;
        }
        
        return db.prepare(sql).all(...params);
      },

      create: async ({ data }) => {
        const id = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        // Convertir undefined/null/Date en valeurs compatibles SQLite
        const memberId = data.memberId || null;
        const yearId = data.yearId || null;
        const month = data.month !== undefined ? data.month : null;
        const amountPaid = data.amountPaid !== undefined ? data.amountPaid : null;
        // Gérer les objets Date
        let paymentDate = now;
        if (data.paymentDate) {
          paymentDate = data.paymentDate instanceof Date 
            ? data.paymentDate.toISOString() 
            : data.paymentDate;
        }
        const notes = (data.notes !== undefined && data.notes !== null) ? String(data.notes) : null;
        
        db.prepare(`
          INSERT INTO MonthlyPayment (id, memberId, yearId, month, amountPaid, paymentDate, notes, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, memberId, yearId, month, amountPaid, paymentDate, notes, now, now);
        
        return { id, ...data, createdAt: now, updatedAt: now };
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          sets.push(`${key} = ?`);
          params.push(data[key]);
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE MonthlyPayment SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        return db.prepare('SELECT * FROM MonthlyPayment WHERE id = ?').get(where.id);
      },

      upsert: async ({ where, create, update }) => {
        const existing = db.prepare(
          'SELECT * FROM MonthlyPayment WHERE memberId = ? AND yearId = ? AND month = ?'
        ).get(where.memberId_yearId_month.memberId, where.memberId_yearId_month.yearId, where.memberId_yearId_month.month);
        
        if (existing) {
          const sets = [];
          const params = [];
          
          Object.keys(update).forEach(key => {
            sets.push(`${key} = ?`);
            params.push(update[key]);
          });
          
          sets.push('updatedAt = ?');
          params.push(new Date().toISOString());
          params.push(existing.id);
          
          db.prepare(`UPDATE MonthlyPayment SET ${sets.join(', ')} WHERE id = ?`).run(...params);
          
          return db.prepare('SELECT * FROM MonthlyPayment WHERE id = ?').get(existing.id);
        } else {
          const id = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const now = new Date().toISOString();
          
          db.prepare(`
            INSERT INTO MonthlyPayment (id, memberId, yearId, month, amountPaid, paymentDate, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, create.memberId, create.yearId, create.month, create.amountPaid, create.paymentDate || now, create.notes || null, now, now);
          
          return { id, ...create, createdAt: now, updatedAt: now };
        }
      }
    },

    // ExceptionalContribution model
    exceptionalContribution: {
      findUnique: async ({ where, include }) => {
        const contrib = db.prepare('SELECT * FROM ExceptionalContribution WHERE id = ?').get(where.id);
        if (!contrib) return null;
        contrib.active = !!contrib.active;
        
        if (include?.payments) {
          let paymentsSql = 'SELECT * FROM ExceptionalPayment WHERE contributionId = ?';
          const payments = db.prepare(paymentsSql).all(contrib.id);
          
          if (include.payments.include?.member) {
            contrib.payments = payments.map(p => {
              const member = db.prepare('SELECT * FROM Member WHERE id = ?').get(p.memberId);
              return { ...p, member: member ? { ...member, active: !!member.active } : null };
            });
          } else {
            contrib.payments = payments;
          }
        }
        
        return contrib;
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
          contrib.active = !!contrib.active;
          if (include?.payments) {
            contrib.payments = db.prepare('SELECT * FROM ExceptionalPayment WHERE contributionId = ?').all(contrib.id);
          }
          return contrib;
        });
      },

      create: async ({ data }) => {
        const id = `contrib_${Date.now()}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO ExceptionalContribution (id, title, type, description, active, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, data.title, data.type, data.description || null, data.active !== false ? 1 : 0, now, now);
        
        return { id, ...data, active: data.active !== false, createdAt: now, updatedAt: now };
      },

      update: async ({ where, data }) => {
        const sets = [];
        const params = [];
        
        Object.keys(data).forEach(key => {
          if (key === 'active') {
            sets.push('active = ?');
            params.push(data[key] ? 1 : 0);
          } else {
            sets.push(`${key} = ?`);
            params.push(data[key]);
          }
        });
        
        sets.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(where.id);
        
        db.prepare(`UPDATE ExceptionalContribution SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        
        const contrib = db.prepare('SELECT * FROM ExceptionalContribution WHERE id = ?').get(where.id);
        return contrib ? { ...contrib, active: !!contrib.active } : null;
      }
    },

    // ExceptionalPayment model
    exceptionalPayment: {
      findFirst: async ({ where }) => {
        let sql = 'SELECT * FROM ExceptionalPayment WHERE 1=1';
        const params = [];
        
        if (where?.contributionId) { sql += ' AND contributionId = ?'; params.push(where.contributionId); }
        if (where?.memberId) { sql += ' AND memberId = ?'; params.push(where.memberId); }
        
        sql += ' LIMIT 1';
        return db.prepare(sql).get(...params) || null;
      },

      create: async ({ data }) => {
        const id = `expay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        db.prepare(`
          INSERT INTO ExceptionalPayment (id, contributionId, memberId, amount, paymentDate, notes, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, data.contributionId, data.memberId, data.amount, data.paymentDate || now, data.notes || null, now, now);
        
        return { id, ...data, createdAt: now, updatedAt: now };
      },

      delete: async ({ where }) => {
        const payment = db.prepare('SELECT * FROM ExceptionalPayment WHERE id = ?').get(where.id);
        db.prepare('DELETE FROM ExceptionalPayment WHERE id = ?').run(where.id);
        return payment;
      }
    },

    // Transaction support - supporte les deux modes Prisma
    $transaction: async function(operationsOrCallback) {
      db.prepare('BEGIN').run();
      try {
        let result;
        
        // Mode callback (comme Prisma interactive transactions)
        if (typeof operationsOrCallback === 'function') {
          // Passer le client lui-même comme proxy de transaction
          result = await operationsOrCallback(this);
        } 
        // Mode tableau de promesses
        else if (Array.isArray(operationsOrCallback)) {
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
  
  return client;
}

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
