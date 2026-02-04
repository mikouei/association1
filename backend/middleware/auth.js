import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_this';

// Cache pour les clients Prisma par association
const prismaClients = new Map();

// Obtenir ou créer un client Prisma pour une association spécifique
export const getPrismaClientForAssociation = async (dbName) => {
  // Si déjà en cache, retourner
  if (prismaClients.has(dbName)) {
    return prismaClients.get(dbName);
  }

  // Utiliser better-sqlite3 directement pour les requêtes
  const dbPath = path.join(__dirname, '../prisma', dbName);
  
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Base de données non trouvée: ${dbName}`);
  }

  const Database = (await import('better-sqlite3')).default;
  const db = new Database(dbPath);
  
  // Créer un wrapper avec les méthodes dont on a besoin
  const client = {
    db,
    dbName,
    
    // User methods
    user: {
      findFirst: async (options) => {
        let sql = 'SELECT * FROM User WHERE 1=1';
        const params = [];
        
        if (options.where) {
          if (options.where.OR) {
            const orConditions = options.where.OR.map(cond => {
              const key = Object.keys(cond)[0];
              params.push(cond[key]);
              return `${key} = ?`;
            }).join(' OR ');
            sql += ` AND (${orConditions})`;
          }
          if (options.where.token) {
            sql += ' AND token = ?';
            params.push(options.where.token);
          }
          if (options.where.active !== undefined) {
            sql += ' AND active = ?';
            params.push(options.where.active ? 1 : 0);
          }
        }
        
        sql += ' LIMIT 1';
        const user = db.prepare(sql).get(...params);
        
        if (user && options.include?.member) {
          const member = db.prepare('SELECT * FROM Member WHERE userId = ?').get(user.id);
          user.member = member || null;
        }
        
        return user ? { ...user, active: !!user.active } : null;
      },
      
      findUnique: async (options) => {
        const user = db.prepare('SELECT * FROM User WHERE id = ?').get(options.where.id);
        
        if (user && options.include?.member) {
          const member = db.prepare('SELECT * FROM Member WHERE userId = ?').get(user.id);
          user.member = member || null;
        }
        
        return user ? { ...user, active: !!user.active } : null;
      }
    }
  };
  
  prismaClients.set(dbName, client);
  return client;
};

// Middleware pour vérifier le JWT et charger la bonne DB
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Si le token contient associationId, charger la bonne DB
    if (decoded.associationId && decoded.dbName) {
      const associationPrisma = await getPrismaClientForAssociation(decoded.dbName);
      req.prisma = associationPrisma;
      req.associationId = decoded.associationId;
      req.dbName = decoded.dbName;
    }
    
    // Récupérer l'utilisateur complet
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

// Générer un token d'accès simple pour les membres (pas JWT)
export const generateAccessToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
