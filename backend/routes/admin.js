import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireAdmin, generateAccessToken, prisma } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLog.js';

const router = express.Router();

// Toutes les routes nécessitent authentification ADMIN
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/list
// Liste tous les ADMIN de l'association
router.get('/list', async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { 
        associationId: req.associationId,
        role: 'ADMIN' 
      },
      select: {
        id: true,
        email: true,
        phone: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        member: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(admins);
  } catch (error) {
    console.error('List admin error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des administrateurs' });
  }
});

// POST /api/admin/create
// Créer un nouvel ADMIN dans l'association
router.post('/create', async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe trop court (minimum 8 caractères)' });
    }

    // Valider le format de l'email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Format email invalide' });
    }

    // Vérifier si l'email existe déjà dans l'association
    const existing = await prisma.user.findFirst({
      where: { 
        associationId: req.associationId,
        email 
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Vérifier le plafond de 3 admins gratuits
    const adminCount = await prisma.user.count({
      where: { associationId: req.associationId, role: 'ADMIN' }
    });
    if (adminCount >= 3) {
      return res.status(403).json({ error: 'Limite de 3 administrateurs atteinte pour cette association' });
    }

    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer l'ADMIN
    const admin = await prisma.user.create({
      data: {
        associationId: req.associationId,
        email,
        phone: phone || null,
        passwordHash,
        passwordChangedAt: new Date(),
        role: 'ADMIN',
        active: true
      }
    });

    res.status(201).json({
      id: admin.id,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      active: admin.active,
      createdAt: admin.createdAt
    });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'admin.create',
      targetType: 'User',
      targetId: admin.id,
      details: `Nouvel admin créé: ${email}`
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'administrateur' });
  }
});

// PUT /api/admin/:id/deactivate
// Désactiver un ADMIN
router.put('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    // Ne pas se désactiver soi-même
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous désactiver vous-même' });
    }

    // Récupérer l'admin pour le log
    const adminData = await prisma.user.findFirst({
      where: { id, role: 'ADMIN', associationId: req.associationId }
    });

    const admin = await prisma.user.updateMany({
      where: { 
        id, 
        role: 'ADMIN',
        associationId: req.associationId
      },
      data: { active: false }
    });

    res.json({ message: 'Administrateur désactivé' });

    // Log de l'activité
    if (adminData) {
      logActivity({
        associationId: req.associationId,
        userId: req.user.id,
        userName: req.user.member?.name || req.user.email || 'Admin',
        action: 'admin.deactivate',
        targetType: 'User',
        targetId: id,
        details: `Admin désactivé: ${adminData.email}`
      });
    }
  } catch (error) {
    console.error('Deactivate admin error:', error);
    res.status(500).json({ error: 'Erreur lors de la désactivation' });
  }
});

// PUT /api/admin/:id/activate
// Réactiver un ADMIN
router.put('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer l'admin pour le log
    const adminData = await prisma.user.findFirst({
      where: { id, role: 'ADMIN', associationId: req.associationId }
    });

    const admin = await prisma.user.updateMany({
      where: { 
        id, 
        role: 'ADMIN',
        associationId: req.associationId
      },
      data: { active: true }
    });

    res.json({ message: 'Administrateur réactivé' });

    // Log de l'activité
    if (adminData) {
      logActivity({
        associationId: req.associationId,
        userId: req.user.id,
        userName: req.user.member?.name || req.user.email || 'Admin',
        action: 'admin.activate',
        targetType: 'User',
        targetId: id,
        details: `Admin réactivé: ${adminData.email}`
      });
    }
  } catch (error) {
    console.error('Activate admin error:', error);
    res.status(500).json({ error: 'Erreur lors de la réactivation' });
  }
});

// POST /api/admin/:id/reset-password
// Réinitialiser le mot de passe d'un ADMIN
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Mot de passe trop court (minimum 8 caractères)' });
    }

    // Récupérer l'admin pour le log
    const adminData = await prisma.user.findFirst({
      where: { id, role: 'ADMIN', associationId: req.associationId }
    });

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.updateMany({
      where: { 
        id, 
        role: 'ADMIN',
        associationId: req.associationId
      },
      data: { passwordHash, passwordChangedAt: new Date() }
    });

    res.json({ message: 'Mot de passe réinitialisé avec succès' });

    // Log de l'activité
    if (adminData) {
      logActivity({
        associationId: req.associationId,
        userId: req.user.id,
        userName: req.user.member?.name || req.user.email || 'Admin',
        action: 'admin.reset_password',
        targetType: 'User',
        targetId: id,
        details: `Mot de passe réinitialisé pour admin: ${adminData.email}`
      });
    }
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

export default router;
