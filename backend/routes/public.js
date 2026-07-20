// Routes publiques (sans authentification)
// Pour les demandes de suppression de compte et la création d'association en libre-service
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { prisma, generateJWT } from '../middleware/auth.js';

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
});

// Rate limiter pour l'inscription d'association (plus strict car crée un compte admin réel)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: { error: 'Trop de tentatives, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter léger pour les infos publiques (évite brute-force de codes)
const infoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 30,
  message: { error: 'Trop de requêtes, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// ROUTES DE CRÉATION D'ASSOCIATION EN LIBRE-SERVICE
// ============================================

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
    const { name, type, code, adminName, adminEmail, adminPhone, adminPassword } = req.body;
    
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

// GET /api/public/associations
// Liste des associations (pour le formulaire de demande)
router.get('/associations', async (req, res) => {
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
