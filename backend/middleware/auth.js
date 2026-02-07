import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_this';

// Client Prisma par défaut (pour V1 - assocmanager.db)
const defaultPrisma = new PrismaClient();

// Cache pour les clients Prisma dynamiques par association
const prismaClients = new Map();

// Créer un vrai client Prisma pour une association (même schéma, DB différente)
export const getSqliteClientForAssociation = (dbName) => {
  // Pour la DB par défaut, utiliser le client Prisma standard
  if (dbName === 'assocmanager.db') {
    return defaultPrisma;
  }
  
  // Si déjà en cache, retourner
  if (prismaClients.has(dbName)) {
    return prismaClients.get(dbName);
  }

  const dbPath = path.join(__dirname, '../prisma', dbName);
  
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Base de données non trouvée: ${dbName}`);
  }

  // Créer un VRAI client Prisma qui pointe vers la DB de l'association
  // Toutes les DB ont le même schéma, donc le même client généré fonctionne
  const client = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`
      }
    }
  });
  
  prismaClients.set(dbName, client);
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
