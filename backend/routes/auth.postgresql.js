// Routes d'authentification pour AssocManager - PostgreSQL Multi-Tenant
import express from 'express';
import bcrypt from 'bcryptjs';
import { 
  prisma, 
  authenticateToken, 
  attachPrisma,
  resolveAssociationByCode,
  generateJWT,
  generateAccessToken 
} from '../middleware/auth.postgresql.js';

const router = express.Router();

// POST /api/auth/login
// Connexion utilisateur (ADMIN ou MEMBER)
router.post('/login', attachPrisma, async (req, res) => {
  try {
    const { identifier, phone, password, associationCode, accessToken } = req.body;

    // Identifier peut être email ou phone
    const loginIdentifier = phone || identifier;

    if (!associationCode) {
      return res.status(400).json({ error: 'Code association requis' });
    }

    // Résoudre l'association par son code
    const association = await resolveAssociationByCode(associationCode);
    
    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    if (!association.active) {
      return res.status(403).json({ error: 'Association désactivée' });
    }

    let user;

    // Connexion par token d'accès (pour les membres)
    if (accessToken) {
      user = await prisma.user.findFirst({
        where: {
          associationId: association.id,
          token: accessToken,
          active: true
        },
        include: { member: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Token d\'accès invalide' });
      }
    } 
    // Connexion par identifiant + mot de passe
    else {
      if (!loginIdentifier || !password) {
        return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
      }

      // Rechercher l'utilisateur par email ou téléphone
      user = await prisma.user.findFirst({
        where: {
          associationId: association.id,
          OR: [
            { email: loginIdentifier },
            { phone: loginIdentifier }
          ]
        },
        include: { member: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      if (!user.active) {
        return res.status(403).json({ error: 'Compte désactivé' });
      }

      // Vérifier le mot de passe
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }
    }

    // Générer le token JWT
    const token = generateJWT(user.id, association.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        member: user.member
      },
      association: {
        id: association.id,
        name: association.name,
        code: association.code
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/associations
// Liste des associations actives (pour le login)
router.get('/associations', attachPrisma, async (req, res) => {
  try {
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
    console.error('Get associations error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des associations' });
  }
});

// GET /api/auth/me
// Profil utilisateur connecté
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { member: true }
    });

    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      member: user.member,
      association: {
        id: req.association.id,
        name: req.association.name,
        code: req.association.code
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des informations' });
  }
});

// GET /api/auth/association-settings
// Paramètres de l'association
router.get('/association-settings', authenticateToken, async (req, res) => {
  try {
    res.json({
      enableVehiclePlates: req.association.enableVehiclePlates || false,
      customFieldLabel: req.association.memberFieldLabel || 'Villa'
    });
  } catch (error) {
    console.error('Get association settings error:', error);
    res.json({
      enableVehiclePlates: false,
      customFieldLabel: 'Villa'
    });
  }
});

export default router;
