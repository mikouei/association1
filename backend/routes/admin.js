import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireAdmin, generateAccessToken } from '../middleware/auth.js';
import platformPrisma from '../prisma/platformClient.js';

const router = express.Router();

// Toutes les routes nécessitent authentification ADMIN
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/list
// Liste tous les ADMIN
router.get('/list', async (req, res) => {
  try {
    const admins = await req.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        phone: true,
        active: true,
        createdAt: true,
        updatedAt: true
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
// Créer un nouvel ADMIN
router.post('/create', async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Vérifier si l'email existe déjà
    const existing = await req.prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer l'ADMIN
    const admin = await req.prisma.user.create({
      data: {
        email,
        phone: phone || null,
        passwordHash,
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

    const admin = await req.prisma.user.update({
      where: { id, role: 'ADMIN' },
      data: { active: false }
    });

    res.json({ message: 'Administrateur désactivé', admin });
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

    const admin = await req.prisma.user.update({
      where: { id, role: 'ADMIN' },
      data: { active: true }
    });

    res.json({ message: 'Administrateur réactivé', admin });
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

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Mot de passe trop court (minimum 4 caractères)' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await req.prisma.user.update({
      where: { id, role: 'ADMIN' },
      data: { passwordHash }
    });

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

export default router;
