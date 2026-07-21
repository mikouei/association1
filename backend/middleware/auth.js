// Middleware d'authentification pour AssocManager - PostgreSQL Multi-Tenant
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';

// Instance Prisma unique (singleton)
const prisma = new PrismaClient();

// JWT_SECRET est obligatoire - le serveur ne doit pas démarrer sans
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ ERREUR FATALE: JWT_SECRET doit être défini dans les variables d\'environnement');
  process.exit(1);
}

// Rate limiter pour les tentatives de connexion (15 essais / 15 min)
// Augmenté à 15 pour que le verrouillage DB (5 tentatives) soit visible avant le rate-limit IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  // SÉCURITÉ: Désactiver la validation X-Forwarded-For car trust proxy est configuré dans server.js
  validate: { xForwardedForHeader: false },
});

/**
 * Middleware d'authentification principal
 * - Vérifie le token JWT
 * - Extrait l'associationId du token
 * - Attache prisma, user, et associationId à la requête
 */
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Extraire les informations du token
    const { userId, associationId, role } = decoded;
    
    if (!userId || !associationId) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Vérifier que l'association existe et est active
    const association = await prisma.association.findUnique({
      where: { id: associationId }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    if (!association.active) {
      return res.status(403).json({ error: 'Association désactivée' });
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        associationId: associationId
      },
      include: {
        member: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Compte désactivé' });
    }

    // Vérifier si le mot de passe a été changé après l'émission du token
    const currentPwdTs = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
    if (decoded.pwdTs !== undefined && decoded.pwdTs < currentPwdTs) {
      return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
    }

    // Attacher les informations à la requête
    req.prisma = prisma;
    req.user = user;
    req.associationId = associationId;
    req.association = association;

    next();
  } catch (error) {
    console.error('Auth error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré' });
    }
    
    return res.status(403).json({ error: 'Token invalide' });
  }
};

/**
 * Middleware pour vérifier le rôle ADMIN
 */
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  next();
};

/**
 * Middleware pour les routes qui n'ont pas besoin d'authentification
 * mais qui ont besoin d'accéder à Prisma (ex: login, register)
 */
export const attachPrisma = (req, res, next) => {
  req.prisma = prisma;
  next();
};

/**
 * Résoudre l'associationId à partir du code d'association
 * Utilisé pour le login où on n'a pas encore de token
 */
export const resolveAssociationByCode = async (code) => {
  if (!code) return null;
  
  const association = await prisma.association.findUnique({
    where: { code: code.toUpperCase() }
  });
  
  return association;
};

/**
 * Générer un token d'accès pour un membre
 */
export const generateAccessToken = () => {
  return crypto.randomBytes(24).toString('base64url');
};

/**
 * Générer un token JWT
 * SÉCURITÉ: Durée de vie réduite de 30d à 7d
 */
export const generateJWT = (userId, associationId, role, passwordChangedAt) => {
  return jwt.sign(
    { 
      userId, 
      associationId, 
      role, 
      pwdTs: passwordChangedAt ? Math.floor(new Date(passwordChangedAt).getTime() / 1000) : undefined
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Export du client Prisma pour usage direct
 */
export { prisma };

export default {
  authenticateToken,
  requireAdmin,
  attachPrisma,
  resolveAssociationByCode,
  generateAccessToken,
  generateJWT,
  prisma
};
