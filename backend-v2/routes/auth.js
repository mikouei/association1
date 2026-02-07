import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, authenticateToken, getSqliteClientForAssociation } from '../middleware/auth.js';
import { PrismaClient as PlatformPrismaClient } from '../node_modules/.prisma/platform-client/index.js';

const router = express.Router();

// Client Platform pour récupérer les infos des associations
let platformPrisma = null;
const getPlatformPrisma = async () => {
  if (!platformPrisma) {
    platformPrisma = new PlatformPrismaClient();
  }
  return platformPrisma;
};

// GET /api/auth/associations - Liste des associations actives pour le login
router.get('/associations', async (req, res) => {
  try {
    const prisma = await getPlatformPrisma();
    const associations = await prisma.association.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        code: true,
        type: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(associations);
  } catch (error) {
    console.error('Erreur liste associations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login
// Login avec associationCode + phone + password OU token d'accès
router.post('/login', async (req, res) => {
  try {
    const { identifier, password, accessToken, associationCode, phone } = req.body;

    // Récupérer l'association par son code
    let association = null;
    let associationPrisma = req.prisma; // Par défaut, la DB V1
    
    if (associationCode) {
      const platform = await getPlatformPrisma();
      association = await platform.association.findUnique({
        where: { code: associationCode }
      });
      
      if (!association) {
        return res.status(400).json({ error: 'Association non trouvée' });
      }
      
      if (!association.active) {
        return res.status(400).json({ error: 'Cette association est désactivée' });
      }
      
      // Charger le client Prisma pour cette association
      associationPrisma = getSqliteClientForAssociation(association.dbName);
    }

    // Cas 1: Login avec token d'accès (pour les membres)
    if (accessToken) {
      const user = await associationPrisma.user.findFirst({
        where: { 
          token: accessToken,
          active: true
        },
        include: { member: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Token d\'accès invalide' });
      }

      const token = generateToken(
        user.id, 
        association?.id || null, 
        association?.dbName || null
      );
      
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          member: user.member
        },
        association: association ? {
          id: association.id,
          name: association.name,
          code: association.code
        } : null
      });
    }

    // Cas 2: Login avec phone/email + password (nouvelle méthode avec association)
    const loginIdentifier = phone || identifier;
    
    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }

    // Chercher par email ou téléphone
    const user = await associationPrisma.user.findFirst({
      where: {
        OR: [
          { email: loginIdentifier },
          { phone: loginIdentifier }
        ],
        active: true
      },
      include: { member: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Générer le token JWT avec l'association
    const token = generateToken(
      user.id, 
      association?.id || null, 
      association?.dbName || null
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        member: user.member
      },
      association: association ? {
        id: association.id,
        name: association.name,
        code: association.code
      } : null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// GET /api/auth/me
// Récupérer les infos de l'utilisateur connecté
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Récupérer les infos de l'association si présente
    let associationInfo = null;
    if (req.associationId) {
      const platform = await getPlatformPrisma();
      const association = await platform.association.findUnique({
        where: { id: req.associationId }
      });
      if (association) {
        associationInfo = {
          id: association.id,
          name: association.name,
          code: association.code
        };
      }
    }
    
    res.json({
      id: req.user.id,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      member: req.user.member,
      association: associationInfo
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des informations' });
  }
});

export default router;
