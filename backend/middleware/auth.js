import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_this';

// Client Prisma par défaut (V1)
const defaultPrisma = new PrismaClient();

// Cache pour les clients Prisma par association
const prismaClients = new Map();

// Créer un client Prisma pour une association spécifique
export const getPrismaForAssociation = async (dbName) => {
  // Pour la DB par défaut, utiliser le client standard
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

  // Créer un nouveau client Prisma avec la bonne URL
  const client = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`
      }
    }
  });
  
  // Connecter le client
  await client.$connect();
  
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
    
    // Si le token contient associationId et dbName, charger la bonne DB
    if (decoded.dbName) {
      const associationPrisma = await getPrismaForAssociation(decoded.dbName);
      req.prisma = associationPrisma;
      req.associationId = decoded.associationId;
      req.dbName = decoded.dbName;
    }
    // Sinon utiliser le client par défaut
    else {
      req.prisma = defaultPrisma;
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

// Fermer toutes les connexions (pour le shutdown)
export const closeAllConnections = async () => {
  await defaultPrisma.$disconnect();
  for (const [, client] of prismaClients) {
    await client.$disconnect();
  }
};
