// Routes d'authentification pour AssocManager - PostgreSQL Multi-Tenant
import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { 
  prisma, 
  authenticateToken, 
  attachPrisma,
  resolveAssociationByCode,
  generateJWT,
  generateAccessToken,
  loginLimiter
} from '../middleware/auth.js';
import { verifyGoogleIdToken, isGoogleAuthConfigured } from '../middleware/googleAuth.js';

const router = express.Router();

// Rate limiter pour la liste des associations (évite l'énumération)
const associationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 30,
  message: { error: 'Trop de requêtes, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// GET /api/auth/associations - Liste des associations actives pour le login
// SÉCURITÉ: Rate limiter ajouté pour éviter l'énumération des associations
router.get('/associations', associationsLimiter, attachPrisma, async (req, res) => {
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

// POST /api/auth/login
// Connexion utilisateur (ADMIN ou MEMBER)
router.post('/login', loginLimiter, attachPrisma, async (req, res) => {
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
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // Vérifier si le compte est verrouillé
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
        return res.status(403).json({
          error: `Compte temporairement bloqué suite à plusieurs tentatives échouées. Réessayez dans ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
        });
      }

      // Vérifier le mot de passe
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        // Incrémenter le compteur d'échecs
        const attempts = (user.failedLoginAttempts || 0) + 1;
        const updateData = { failedLoginAttempts: attempts };
        if (attempts >= 5) {
          updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        }
        await prisma.user.update({ where: { id: user.id }, data: updateData });
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // Connexion réussie - réinitialiser le compteur d'échecs
      if (user.failedLoginAttempts > 0 || user.lockedUntil) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null }
        });
      }
    }

    // Générer le token JWT
    const token = generateJWT(user.id, association.id, user.role, user.passwordChangedAt);

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

// POST /api/auth/google
// Connexion via Google OAuth (équivalent Google de /login)
router.post('/google', loginLimiter, attachPrisma, async (req, res) => {
  try {
    const { idToken, associationCode } = req.body;

    // Validation des champs requis
    if (!idToken) {
      return res.status(400).json({ error: 'Token Google requis' });
    }
    if (!associationCode) {
      return res.status(400).json({ error: 'Code association requis' });
    }

    // Vérifier que Google Auth est configuré
    if (!isGoogleAuthConfigured()) {
      return res.status(500).json({ error: 'Authentification Google non configurée sur ce serveur' });
    }

    // Résoudre l'association par son code
    const association = await resolveAssociationByCode(associationCode);
    
    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    if (!association.active) {
      return res.status(403).json({ error: 'Association désactivée' });
    }

    // Vérifier le token Google
    let googlePayload;
    try {
      googlePayload = await verifyGoogleIdToken(idToken);
    } catch (error) {
      if (error.message === 'EMAIL_NOT_VERIFIED') {
        return res.status(401).json({ error: 'Cet email Google n\'est pas vérifié' });
      }
      return res.status(401).json({ error: 'Jeton Google invalide ou expiré' });
    }

    const { googleId, email } = googlePayload;

    // Chercher l'utilisateur par googleId OU email dans cette association
    let user = await prisma.user.findFirst({
      where: {
        associationId: association.id,
        OR: [
          { googleId },
          { email }
        ]
      },
      include: { member: true }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'Aucun compte trouvé pour cet email Google dans cette association',
        code: 'NO_ACCOUNT'
      });
    }

    if (!user.active) {
      // Message uniforme pour ne pas révéler si un compte désactivé existe
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Si l'utilisateur existe mais n'a pas encore de googleId lié (compte créé par mot de passe)
    // → lier le googleId maintenant (liaison automatique)
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
        include: { member: true }
      });
    }

    // Connexion Google réussie - réinitialiser le compteur d'échecs s'il y en avait
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null }
      });
    }

    // Générer le token JWT
    const token = generateJWT(user.id, association.id, user.role, user.passwordChangedAt);

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
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
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
      customFieldLabel: req.association.memberFieldLabel || 'Villa',
      currency: req.association.currency || 'XOF'
    });
  } catch (error) {
    console.error('Get association settings error:', error);
    res.json({
      enableVehiclePlates: false,
      customFieldLabel: 'Villa',
      currency: 'XOF'
    });
  }
});

// PUT /api/auth/association-settings
// Modifier les paramètres de l'association (ADMIN uniquement)
router.put('/association-settings', authenticateToken, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est ADMIN
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const { memberFieldLabel, enableVehiclePlates, currency } = req.body;

    const updateData = {};
    
    // Libellé du champ personnalisé (texte libre)
    if (memberFieldLabel !== undefined) {
      if (typeof memberFieldLabel !== 'string' || memberFieldLabel.trim().length === 0) {
        return res.status(400).json({ error: 'Le libellé ne peut pas être vide' });
      }
      updateData.memberFieldLabel = memberFieldLabel.trim();
    }

    // Option plaques d'immatriculation
    if (enableVehiclePlates !== undefined) {
      updateData.enableVehiclePlates = Boolean(enableVehiclePlates);
    }

    // Devise
    if (currency !== undefined) {
      const validCurrencies = ['XOF', 'EUR', 'USD'];
      if (!validCurrencies.includes(currency.toUpperCase())) {
        return res.status(400).json({ error: 'Devise non supportée. Choisissez parmi: XOF, EUR, USD' });
      }
      updateData.currency = currency.toUpperCase();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Aucun paramètre à modifier' });
    }

    const updatedAssociation = await prisma.association.update({
      where: { id: req.associationId },
      data: updateData
    });

    res.json({
      message: 'Paramètres mis à jour',
      enableVehiclePlates: updatedAssociation.enableVehiclePlates,
      customFieldLabel: updatedAssociation.memberFieldLabel,
      currency: updatedAssociation.currency
    });
  } catch (error) {
    console.error('Update association settings error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres' });
  }
});

// DELETE /api/auth/me
// Suppression (anonymisation) du compte utilisateur
// Requis par Google Play Store pour les apps avec création de compte
router.delete('/me', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression' });
    }

    // Récupérer l'utilisateur complet avec son hash de mot de passe
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { member: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    // Si l'utilisateur est ADMIN, vérifier qu'il n'est pas le dernier admin actif
    if (user.role === 'ADMIN') {
      const activeAdminCount = await prisma.user.count({
        where: {
          associationId: req.associationId,
          role: 'ADMIN',
          active: true
        }
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({ 
          error: 'Vous êtes le dernier administrateur de cette association. Veuillez d\'abord faire ajouter un autre administrateur par le Super Admin avant de supprimer votre compte.' 
        });
      }
    }

    // Générer une valeur aléatoire pour invalider les credentials
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const deletedEmail = `compte-supprime-${user.id.substring(0, 8)}@deleted.local`;
    const invalidPasswordHash = await bcrypt.hash(randomSuffix + Date.now(), 10);

    // Anonymiser le compte (ne pas supprimer pour conserver l'historique des paiements)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: deletedEmail,
        phone: null,
        passwordHash: invalidPasswordHash,
        token: null,
        active: false
      }
    });

    // Si le user a un Member associé, anonymiser aussi le nom
    if (user.member) {
      await prisma.member.update({
        where: { id: user.member.id },
        data: {
          name: `Membre supprimé (${user.id.substring(0, 8)})`,
          customFieldValue: null,
          active: false
        }
      });
    }

    res.json({ 
      message: 'Compte supprimé. L\'historique des cotisations est conservé pour la comptabilité de l\'association.' 
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du compte' });
  }
});

export default router;
