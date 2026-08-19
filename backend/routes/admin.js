import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireAdmin, generateAccessToken, prisma } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLog.js';

const router = express.Router();

// Quotas par rôle
const ROLE_QUOTAS = {
  ADMIN: 3,
  SCANNER: 10,
  AUDITEUR: 3
};

// Labels des rôles en français
const ROLE_LABELS = {
  ADMIN: 'Administrateur',
  SCANNER: 'Scanner',
  AUDITEUR: 'Auditeur'
};

// Toutes les routes nécessitent authentification ADMIN
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/quotas
// Récupérer les quotas et compteurs par rôle
router.get('/quotas', async (req, res) => {
  try {
    const counts = await prisma.user.groupBy({
      by: ['role'],
      where: { 
        associationId: req.associationId,
        role: { in: ['ADMIN', 'SCANNER', 'AUDITEUR'] }
      },
      _count: { role: true }
    });

    const quotas = {};
    for (const role of ['ADMIN', 'SCANNER', 'AUDITEUR']) {
      const found = counts.find(c => c.role === role);
      quotas[role] = {
        label: ROLE_LABELS[role],
        current: found ? found._count.role : 0,
        max: ROLE_QUOTAS[role]
      };
    }

    res.json(quotas);
  } catch (error) {
    console.error('Get quotas error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des quotas' });
  }
});

// GET /api/admin/list
// Liste tous les comptes staff (ADMIN, SCANNER, AUDITEUR) de l'association
router.get('/list', async (req, res) => {
  try {
    const staffUsers = await prisma.user.findMany({
      where: { 
        associationId: req.associationId,
        role: { in: ['ADMIN', 'SCANNER', 'AUDITEUR'] }
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        member: { select: { id: true } }
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }]
    });

    res.json(staffUsers);
  } catch (error) {
    console.error('List admin error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des administrateurs' });
  }
});

// POST /api/admin/create
// Créer un nouveau compte staff (ADMIN, SCANNER, ou AUDITEUR)
router.post('/create', async (req, res) => {
  try {
    const { email, phone, password, role = 'ADMIN' } = req.body;

    // Valider le rôle
    if (!['ADMIN', 'SCANNER', 'AUDITEUR'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide. Valeurs acceptées: ADMIN, SCANNER, AUDITEUR' });
    }

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

    // Vérifier le quota pour ce rôle spécifique
    const roleCount = await prisma.user.count({
      where: { associationId: req.associationId, role }
    });
    
    const maxQuota = ROLE_QUOTAS[role];
    if (roleCount >= maxQuota) {
      return res.status(403).json({ 
        error: `Limite de ${maxQuota} ${ROLE_LABELS[role].toLowerCase()}(s) atteinte pour cette association` 
      });
    }

    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer le compte
    const user = await prisma.user.create({
      data: {
        associationId: req.associationId,
        email,
        phone: phone || null,
        passwordHash,
        passwordChangedAt: new Date(),
        role,
        active: true
      }
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt
    });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'admin.create',
      targetType: 'User',
      targetId: user.id,
      details: `Nouveau ${ROLE_LABELS[role]} créé: ${email}`
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/admin/:id/deactivate
// Désactiver un compte staff (ADMIN, SCANNER, AUDITEUR)
router.put('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    // Ne pas se désactiver soi-même
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous désactiver vous-même' });
    }

    // Récupérer le compte pour le log
    const userData = await prisma.user.findFirst({
      where: { 
        id, 
        role: { in: ['ADMIN', 'SCANNER', 'AUDITEUR'] }, 
        associationId: req.associationId 
      }
    });

    if (!userData) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }

    await prisma.user.updateMany({
      where: { 
        id, 
        role: { in: ['ADMIN', 'SCANNER', 'AUDITEUR'] },
        associationId: req.associationId
      },
      data: { active: false }
    });

    res.json({ message: 'Compte désactivé' });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'admin.deactivate',
      targetType: 'User',
      targetId: id,
      details: `${ROLE_LABELS[userData.role]} désactivé: ${userData.email}`
    });
  } catch (error) {
    console.error('Deactivate admin error:', error);
    res.status(500).json({ error: 'Erreur lors de la désactivation' });
  }
});

// PUT /api/admin/:id/activate
// Réactiver un compte staff
router.put('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le compte pour le log
    const userData = await prisma.user.findFirst({
      where: { 
        id, 
        role: { in: ['ADMIN', 'SCANNER', 'AUDITEUR'] }, 
        associationId: req.associationId 
      }
    });

    if (!userData) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }

    await prisma.user.updateMany({
      where: { 
        id, 
        role: { in: ['ADMIN', 'SCANNER', 'AUDITEUR'] },
        associationId: req.associationId
      },
      data: { active: true }
    });

    res.json({ message: 'Compte réactivé' });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'admin.activate',
      targetType: 'User',
      targetId: id,
      details: `${ROLE_LABELS[userData.role]} réactivé: ${userData.email}`
    });
  } catch (error) {
    console.error('Activate admin error:', error);
    res.status(500).json({ error: 'Erreur lors de la réactivation' });
  }
});

// POST /api/admin/:id/reset-password
// Réinitialiser le mot de passe d'un compte staff
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, currentPassword } = req.body;

    // SÉCURITÉ: Exiger le mot de passe actuel de l'admin effectuant l'action
    if (!currentPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel requis pour confirmer cette action' });
    }

    // Vérifier le mot de passe actuel de l'admin connecté
    const currentAdmin = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const validCurrentPassword = await bcrypt.compare(currentPassword, currentAdmin.passwordHash);
    if (!validCurrentPassword) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Mot de passe trop court (minimum 8 caractères)' });
    }

    // Récupérer le compte pour le log
    const userData = await prisma.user.findFirst({
      where: { 
        id, 
        role: { in: ['ADMIN', 'SCANNER', 'AUDITEUR'] }, 
        associationId: req.associationId 
      }
    });

    if (!userData) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.updateMany({
      where: { 
        id, 
        role: { in: ['ADMIN', 'SCANNER', 'AUDITEUR'] },
        associationId: req.associationId
      },
      data: { 
        passwordHash, 
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    res.json({ message: 'Mot de passe réinitialisé avec succès' });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'admin.reset_password',
      targetType: 'User',
      targetId: id,
      details: `Mot de passe réinitialisé pour ${ROLE_LABELS[userData.role]}: ${userData.email}`
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

// GET /api/admin/pending-members
// Liste les demandes d'inscription en attente (approvalStatus: PENDING) de l'association
router.get('/pending-members', async (req, res) => {
  try {
    const pending = await prisma.user.findMany({
      where: {
        associationId: req.associationId,
        role: 'MEMBER',
        approvalStatus: 'PENDING'
      },
      select: {
        id: true,
        email: true,
        phone: true,
        createdAt: true,
        member: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    const result = pending.map((u) => ({
      id: u.id,
      name: u.member?.name || '',
      email: u.email,
      phone: u.phone,
      requestedAt: u.createdAt
    }));

    res.json(result);
  } catch (error) {
    console.error('List pending members error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des demandes' });
  }
});

// POST /api/admin/pending-members/approve
// Approuver une ou plusieurs demandes d'inscription
router.post('/pending-members/approve', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Aucune demande sélectionnée' });
    }

    const result = await prisma.user.updateMany({
      where: {
        id: { in: ids },
        associationId: req.associationId,
        role: 'MEMBER',
        approvalStatus: 'PENDING'
      },
      data: { approvalStatus: 'APPROVED' }
    });

    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'member.approve',
      targetType: 'User',
      targetId: null,
      details: `${result.count} demande(s) d'inscription approuvée(s)`
    });

    res.json({ message: 'Demandes approuvées', count: result.count });
  } catch (error) {
    console.error('Approve pending members error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'approbation' });
  }
});

// POST /api/admin/pending-members/reject
// Refuser (supprimer) une ou plusieurs demandes d'inscription
router.post('/pending-members/reject', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Aucune demande sélectionnée' });
    }

    // Ne cibler que les demandes PENDING de cette association
    const pendingUsers = await prisma.user.findMany({
      where: {
        id: { in: ids },
        associationId: req.associationId,
        role: 'MEMBER',
        approvalStatus: 'PENDING'
      },
      select: { id: true }
    });
    const userIds = pendingUsers.map((u) => u.id);

    let count = 0;
    if (userIds.length > 0) {
      // Supprimer les members puis les users correspondants
      await prisma.$transaction(async (tx) => {
        await tx.member.deleteMany({ where: { userId: { in: userIds } } });
        const del = await tx.user.deleteMany({ where: { id: { in: userIds } } });
        count = del.count;
      });
    }

    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'member.reject',
      targetType: 'User',
      targetId: null,
      details: `${count} demande(s) d'inscription refusée(s)`
    });

    res.json({ message: 'Demandes refusées', count });
  } catch (error) {
    console.error('Reject pending members error:', error);
    res.status(500).json({ error: 'Erreur lors du refus' });
  }
});

export default router;
