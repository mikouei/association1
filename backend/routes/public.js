// Routes publiques (sans authentification)
// Pour les demandes de suppression de compte et la création d'association en libre-service
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma, generateJWT } from '../middleware/auth.js';
import { verifyGoogleIdToken, isGoogleAuthConfigured } from '../middleware/googleAuth.js';
import { getSupportedCurrencies } from '../utils/currency.js';
import { checkMemberLimit } from '../utils/planLimits.js';

const router = express.Router();

// Limite d'associations créées en libre-service par personne (email/téléphone)
// Peut être modifiée via variable d'environnement sans redeployer
const MAX_SELF_SERVICE_PER_USER = parseInt(process.env.MAX_SELF_SERVICE_PER_USER || '5', 10);

// Rate limiter pour les demandes de suppression (5 requêtes / heure / IP)
const deletionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: { error: 'Trop de demandes, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Rate limiter pour l'inscription d'association (plus strict car crée un compte admin réel)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: { error: 'Trop de tentatives, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Rate limiter pour rejoindre une association (même niveau que registerLimiter)
const joinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: { error: 'Trop de tentatives, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Rate limiter léger pour les infos publiques (évite brute-force de codes)
const infoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 30,
  message: { error: 'Trop de requêtes, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// ============================================
// ROUTES DE CRÉATION D'ASSOCIATION EN LIBRE-SERVICE
// ============================================

// GET /api/public/currencies
// Liste des devises supportées
router.get('/currencies', (req, res) => {
  try {
    const currencies = getSupportedCurrencies();
    res.json(currencies);
  } catch (error) {
    console.error('Error fetching currencies:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/public/associations/check-code/:code
// Vérifier la disponibilité d'un code d'association (retour temps réel pendant saisie)
router.get('/associations/check-code/:code', infoLimiter, async (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase();
    
    // Valider le format : lettres majuscules, chiffres, tirets, 3 à 20 caractères
    const codeRegex = /^[A-Z0-9-]{3,20}$/;
    if (!codeRegex.test(code)) {
      return res.json({ available: false, reason: 'format' });
    }
    
    // Vérifier si le code existe déjà
    const existing = await prisma.association.findUnique({
      where: { code }
    });
    
    if (existing) {
      return res.json({ available: false, reason: 'taken' });
    }
    
    res.json({ available: true });
  } catch (error) {
    console.error('Check code error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/public/associations/register
// Créer une association en libre-service + premier admin
router.post('/associations/register', registerLimiter, async (req, res) => {
  try {
    const { name, type, code, adminName, adminEmail, adminPhone, adminPassword, currency } = req.body;
    
    // Validation des champs requis (dans l'ordre spécifié)
    if (!name || !code) {
      return res.status(400).json({ error: 'Nom et code de l\'association requis' });
    }
    
    if (!adminName) {
      return res.status(400).json({ error: 'Nom de l\'administrateur requis' });
    }
    
    if (!adminEmail && !adminPhone) {
      return res.status(400).json({ error: 'Email ou téléphone de l\'administrateur requis' });
    }
    
    if (!adminPassword) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }
    
    if (adminPassword.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }
    
    // Valider le format de l'email si fourni
    if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return res.status(400).json({ error: 'Format email invalide' });
    }
    
    // Valider la devise si fournie
    const validCurrencies = ['XOF', 'EUR', 'USD'];
    const selectedCurrency = currency && validCurrencies.includes(currency.toUpperCase()) 
      ? currency.toUpperCase() 
      : 'XOF';
    
    // Normaliser et valider le code
    const normalizedCode = code.toUpperCase();
    const codeRegex = /^[A-Z0-9-]{3,20}$/;
    if (!codeRegex.test(normalizedCode)) {
      return res.status(400).json({ error: 'Code invalide (3-20 caractères, lettres majuscules, chiffres et tirets uniquement)' });
    }
    
    // Vérifier que le code n'existe pas déjà
    const existingCode = await prisma.association.findUnique({
      where: { code: normalizedCode }
    });
    if (existingCode) {
      return res.status(400).json({ error: 'Ce code existe déjà' });
    }
    
    // Limite PAR PERSONNE : vérifier combien d'associations self_service cette personne a déjà créées
    // Note: Si la même personne utilise un email/téléphone différent à chaque création,
    // cette limite peut être contournée. C'est un garde-fou raisonnable contre l'abus involontaire,
    // pas une protection absolue contre quelqu'un de déterminé à la contourner.
    const orConditions = [];
    if (adminEmail) orConditions.push({ email: adminEmail });
    if (adminPhone) orConditions.push({ phone: adminPhone });
    
    const existingSelfServiceCount = await prisma.user.count({
      where: {
        role: 'ADMIN',
        association: { source: 'self_service' },
        OR: orConditions
      }
    });
    
    if (existingSelfServiceCount >= MAX_SELF_SERVICE_PER_USER) {
      return res.status(403).json({
        error: `Vous avez atteint la limite de ${MAX_SELF_SERVICE_PER_USER} associations créées en libre-service avec cet email/téléphone. Contactez-nous pour créer une association supplémentaire.`
      });
    }
    
    // Hash du mot de passe admin
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    // Déterminer le libellé du champ personnalisé selon le type d'association
    // (même logique que POST /api/platform/associations)
    const associationType = (type || 'association').toLowerCase();
    let defaultMemberFieldLabel = 'Villa';
    if (associationType === 'amicale' || associationType === 'association') {
      defaultMemberFieldLabel = 'Fonction';
    }
    
    // Créer l'association et son premier admin en transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer l'association
      const association = await tx.association.create({
        data: {
          name,
          type: type || 'association',
          code: normalizedCode,
          active: true,
          adminEmail: adminEmail || null,
          adminName,
          source: 'self_service',
          currency: selectedCurrency,
          memberFieldLabel: defaultMemberFieldLabel,
          enableVehiclePlates: false
        }
      });
      
      // Créer l'admin de l'association
      // Note: Si pas d'email fourni, on génère une adresse temporaire unique avec crypto
      const adminUser = await tx.user.create({
        data: {
          associationId: association.id,
          email: adminEmail || `admin_${crypto.randomUUID()}@temp.local`,
          phone: adminPhone || null,
          passwordHash,
          passwordChangedAt: new Date(),
          role: 'ADMIN',
          active: true
        }
      });
      
      return { association, adminUser };
    });
    
    // Générer un JWT pour connexion automatique
    const token = generateJWT(result.adminUser.id, result.association.id, 'ADMIN', result.adminUser.passwordChangedAt);
    
    res.status(201).json({
      message: 'Association créée avec succès',
      token,
      code: result.association.code,
      association: {
        id: result.association.id,
        name: result.association.name,
        code: result.association.code,
        type: result.association.type
      },
      admin: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        phone: result.adminUser.phone
      }
    });
  } catch (error) {
    console.error('Register association error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'association' });
  }
});

// POST /api/public/associations/register-google
// Créer une association en libre-service via Google OAuth
router.post('/associations/register-google', registerLimiter, async (req, res) => {
  try {
    const { idToken, name, type, code, currency } = req.body;
    
    // Vérifier que Google Auth est configuré
    if (!isGoogleAuthConfigured()) {
      return res.status(500).json({ error: 'Authentification Google non configurée sur ce serveur' });
    }

    // Vérifier le token Google en premier
    let googlePayload;
    try {
      googlePayload = await verifyGoogleIdToken(idToken);
    } catch (error) {
      if (error.message === 'EMAIL_NOT_VERIFIED') {
        return res.status(401).json({ error: 'Cet email Google n\'est pas vérifié' });
      }
      return res.status(401).json({ error: 'Jeton Google invalide ou expiré' });
    }

    const { googleId, email: adminEmail, name: adminName } = googlePayload;

    // Validation des champs requis (dans l'ordre spécifié)
    if (!name || !code) {
      return res.status(400).json({ error: 'Nom et code de l\'association requis' });
    }
    
    // Valider la devise si fournie
    const validCurrencies = ['XOF', 'EUR', 'USD'];
    const selectedCurrency = currency && validCurrencies.includes(currency.toUpperCase()) 
      ? currency.toUpperCase() 
      : 'XOF';
    
    // Normaliser et valider le code
    const normalizedCode = code.toUpperCase();
    const codeRegex = /^[A-Z0-9-]{3,20}$/;
    if (!codeRegex.test(normalizedCode)) {
      return res.status(400).json({ error: 'Code invalide (3-20 caractères, lettres majuscules, chiffres et tirets uniquement)' });
    }
    
    // Vérifier que le code n'existe pas déjà
    const existingCode = await prisma.association.findUnique({
      where: { code: normalizedCode }
    });
    if (existingCode) {
      return res.status(400).json({ error: 'Ce code existe déjà' });
    }
    
    // Limite PAR PERSONNE : vérifier combien d'associations self_service cette personne a déjà créées
    const existingSelfServiceCount = await prisma.user.count({
      where: {
        role: 'ADMIN',
        association: { source: 'self_service' },
        email: adminEmail
      }
    });
    
    if (existingSelfServiceCount >= MAX_SELF_SERVICE_PER_USER) {
      return res.status(403).json({
        error: `Vous avez atteint la limite de ${MAX_SELF_SERVICE_PER_USER} associations créées en libre-service avec cet email. Contactez-nous pour créer une association supplémentaire.`
      });
    }
    
    // Générer un hash de mot de passe aléatoire (le compte ne pourra pas se connecter par mot de passe)
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    
    // Déterminer le libellé du champ personnalisé selon le type d'association
    const associationType = (type || 'association').toLowerCase();
    let defaultMemberFieldLabel = 'Villa';
    if (associationType === 'amicale' || associationType === 'association') {
      defaultMemberFieldLabel = 'Fonction';
    }
    
    // Créer l'association et son premier admin en transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer l'association
      const association = await tx.association.create({
        data: {
          name,
          type: type || 'association',
          code: normalizedCode,
          active: true,
          adminEmail: adminEmail,
          adminName: adminName || '',
          source: 'self_service',
          currency: selectedCurrency,
          memberFieldLabel: defaultMemberFieldLabel,
          enableVehiclePlates: false
        }
      });
      
      // Créer l'admin de l'association avec googleId
      const adminUser = await tx.user.create({
        data: {
          associationId: association.id,
          email: adminEmail,
          phone: null,
          passwordHash,
          googleId,
          passwordChangedAt: new Date(),
          role: 'ADMIN',
          active: true
        }
      });
      
      return { association, adminUser };
    });
    
    // Générer un JWT pour connexion automatique
    const token = generateJWT(result.adminUser.id, result.association.id, 'ADMIN', result.adminUser.passwordChangedAt);
    
    res.status(201).json({
      message: 'Association créée avec succès',
      token,
      code: result.association.code,
      association: {
        id: result.association.id,
        name: result.association.name,
        code: result.association.code,
        type: result.association.type
      },
      admin: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        phone: result.adminUser.phone
      }
    });
  } catch (error) {
    console.error('Register association with Google error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'association' });
  }
});

// POST /api/public/associations/:code/join-google
// Rejoindre une association existante en tant que MEMBRE via Google OAuth
router.post('/associations/:code/join-google', joinLimiter, async (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase();
    const { idToken } = req.body;

    // Vérifier que Google Auth est configuré
    if (!isGoogleAuthConfigured()) {
      return res.status(500).json({ error: 'Authentification Google non configurée sur ce serveur' });
    }

    // Résoudre l'association
    const association = await prisma.association.findUnique({
      where: { code }
    });
    
    if (!association || !association.active) {
      return res.status(404).json({ error: 'Association introuvable' });
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

    const { googleId, email, name: memberName } = googlePayload;

    // Chercher un User existant dans cette association avec OR: [{ googleId }, { email }]
    const existingUser = await prisma.user.findFirst({
      where: {
        associationId: association.id,
        OR: [
          { googleId },
          { email }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.active) {
        return res.status(409).json({ 
          error: 'Vous avez déjà un compte pour cette association. Connectez-vous plutôt.',
          code: 'ALREADY_MEMBER'
        });
      } else {
        // Compte désactivé - message uniforme
        return res.status(403).json({ error: 'Identifiants invalides' });
      }
    }

    // Vérifier le plafond de membres selon le plan
    const memberCount = await prisma.user.count({
      where: { associationId: association.id, role: 'MEMBER', approvalStatus: 'APPROVED' }
    });
    const limitCheck = checkMemberLimit(association, memberCount);
    if (!limitCheck.canAdd) {
      return res.status(403).json({ error: limitCheck.message });
    }

    // Générer un hash de mot de passe aléatoire
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    // Créer User + Member en transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          associationId: association.id,
          email,
          phone: null,
          passwordHash,
          googleId,
          role: 'MEMBER',
          active: true,
          passwordChangedAt: new Date()
        }
      });

      const member = await tx.member.create({
        data: {
          associationId: association.id,
          userId: user.id,
          name: memberName || email.split('@')[0], // Fallback sur partie locale de l'email
          customFieldValue: null,
          source: 'self_service',
          active: true
        }
      });

      return { user, member };
    });

    // Générer le JWT
    const token = generateJWT(result.user.id, association.id, 'MEMBER', result.user.passwordChangedAt);

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        phone: null,
        role: 'MEMBER',
        member: {
          id: result.member.id,
          name: result.member.name,
          customFieldValue: null
        }
      },
      association: {
        id: association.id,
        name: association.name,
        code: association.code
      }
    });
  } catch (error) {
    console.error('Join association with Google error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// POST /api/public/associations/:code/join-request
// Demander à rejoindre une association en tant que MEMBRE (validation admin requise)
// Ne retourne PAS de token JWT — le compte reste en attente (approvalStatus: PENDING)
router.post('/associations/:code/join-request', joinLimiter, async (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase();
    const { name, phone, email, password } = req.body;

    // Résoudre l'association
    const association = await prisma.association.findUnique({ where: { code } });
    if (!association || !association.active) {
      return res.status(404).json({ error: 'Association introuvable' });
    }

    // Validation des champs
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nom requis' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Numéro de téléphone requis' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }
    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Format email invalide' });
    }

    const normalizedPhone = phone.trim();
    const normalizedEmail = email && email.trim() ? email.trim() : null;

    // Vérifier qu'un compte n'existe pas déjà (téléphone ou email) dans cette association
    const orConditions = [{ phone: normalizedPhone }];
    if (normalizedEmail) orConditions.push({ email: normalizedEmail });
    const existingUser = await prisma.user.findFirst({
      where: { associationId: association.id, OR: orConditions }
    });
    if (existingUser) {
      return res.status(409).json({
        error: 'Un compte existe déjà avec ce téléphone ou cet email pour cette association.',
        code: 'ALREADY_MEMBER'
      });
    }

    // Vérifier le plafond de membres — SEULS les membres APPROUVÉS comptent
    const memberCount = await prisma.user.count({
      where: { associationId: association.id, role: 'MEMBER', approvalStatus: 'APPROVED' }
    });
    const limitCheck = checkMemberLimit(association, memberCount);
    if (!limitCheck.canAdd) {
      return res.status(403).json({ error: limitCheck.message });
    }

    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer User (PENDING) + Member en transaction
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          associationId: association.id,
          email: normalizedEmail || `membre_${crypto.randomUUID()}@temp.local`,
          phone: normalizedPhone,
          passwordHash,
          role: 'MEMBER',
          approvalStatus: 'PENDING',
          active: true,
          passwordChangedAt: new Date()
        }
      });

      await tx.member.create({
        data: {
          associationId: association.id,
          userId: user.id,
          name: name.trim(),
          customFieldValue: null,
          source: 'self_service',
          active: true
        }
      });
    });

    // Ne PAS retourner de token JWT — juste une confirmation
    res.status(201).json({
      message: 'Votre demande d\'inscription a été envoyée. Elle sera validée par un administrateur.',
      status: 'PENDING'
    });
  } catch (error) {
    console.error('Join request error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la demande' });
  }
});

// GET /api/public/associations/:code/info
// Obtenir les infos publiques d'une association par son code (pour liens d'invitation)
router.get('/associations/:code/info', infoLimiter, async (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase();
    
    const association = await prisma.association.findUnique({
      where: { code },
      select: {
        name: true,
        type: true,
        code: true,
        active: true
      }
    });
    
    if (!association || !association.active) {
      return res.status(404).json({ error: 'Association introuvable' });
    }
    
    res.json({
      name: association.name,
      type: association.type,
      code: association.code
    });
  } catch (error) {
    console.error('Association info error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/public/deletion-request
// Soumettre une demande de suppression de compte
router.post('/deletion-request', deletionLimiter, async (req, res) => {
  try {
    const { email, phone, associationCode, message } = req.body;

    // Validation
    if (!email && !phone) {
      return res.status(400).json({ error: 'Email ou téléphone requis' });
    }

    if (!associationCode) {
      return res.status(400).json({ error: 'Code association requis' });
    }

    // Vérifier que l'association existe
    const association = await prisma.association.findUnique({
      where: { code: associationCode }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée avec ce code' });
    }

    // Créer la demande
    const request = await prisma.deletionRequest.create({
      data: {
        email: email || null,
        phone: phone || null,
        associationCode,
        message: message || null,
        status: 'pending'
      }
    });

    res.status(201).json({ 
      message: 'Votre demande de suppression a été enregistrée. Elle sera traitée sous 30 jours.',
      requestId: request.id
    });
  } catch (error) {
    console.error('Deletion request error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la demande' });
  }
});

// Rate limiter pour la liste des associations (évite l'énumération)
const associationsListLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 30,
  message: { error: 'Trop de requêtes, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// GET /api/public/associations
// Liste des associations (pour le formulaire de demande)
// SÉCURITÉ: Rate limiter ajouté pour éviter l'énumération des associations
router.get('/associations', associationsListLimiter, async (req, res) => {
  try {
    const associations = await prisma.association.findMany({
      where: { active: true },
      select: {
        code: true,
        name: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(associations);
  } catch (error) {
    console.error('List associations error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
