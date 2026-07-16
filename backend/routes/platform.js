// Routes Platform - Gestion des associations par SUPER_ADMIN
// PostgreSQL Multi-Tenant - Toutes les données dans une seule base
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../middleware/auth.js';

const router = express.Router();

// JWT_SECRET est obligatoire - le serveur ne doit pas démarrer sans
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ ERREUR FATALE: JWT_SECRET doit être défini dans les variables d\'environnement');
  process.exit(1);
}

// Middleware pour vérifier le token SUPER_ADMIN
const authenticateSuperAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Accès SUPER_ADMIN requis' });
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: decoded.id }
    });

    if (!superAdmin || !superAdmin.active) {
      return res.status(403).json({ error: 'Compte SUPER_ADMIN invalide ou désactivé' });
    }

    req.superAdmin = superAdmin;
    next();
  } catch (error) {
    console.error('Auth SUPER_ADMIN error:', error);
    return res.status(403).json({ error: 'Token invalide' });
  }
};

// ============ AUTH SUPER_ADMIN ============

// POST /api/platform/login - Connexion SUPER_ADMIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email }
    });

    if (!superAdmin) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    if (!superAdmin.active) {
      return res.status(401).json({ error: 'Compte désactivé' });
    }

    const validPassword = await bcrypt.compare(password, superAdmin.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = jwt.sign(
      { id: superAdmin.id, email: superAdmin.email, role: 'SUPER_ADMIN' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: 'SUPER_ADMIN'
      }
    });
  } catch (error) {
    console.error('Erreur login SUPER_ADMIN:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/platform/me - Profil SUPER_ADMIN
router.get('/me', authenticateSuperAdmin, async (req, res) => {
  res.json({
    id: req.superAdmin.id,
    email: req.superAdmin.email,
    name: req.superAdmin.name,
    role: 'SUPER_ADMIN'
  });
});

// ============ GESTION DES ASSOCIATIONS ============

// GET /api/platform/associations - Liste des associations
router.get('/associations', authenticateSuperAdmin, async (req, res) => {
  try {
    const associations = await prisma.association.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { members: true, users: true }
        }
      }
    });

    res.json(associations.map(a => ({
      ...a,
      membersCount: a._count.members,
      usersCount: a._count.users
    })));
  } catch (error) {
    console.error('Erreur liste associations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/platform/associations/:id - Détail d'une association
router.get('/associations/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const association = await prisma.association.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { members: true, users: true }
        }
      }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    res.json({
      ...association,
      membersCount: association._count.members,
      usersCount: association._count.users
    });
  } catch (error) {
    console.error('Erreur détail association:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/platform/associations - Créer une association
router.post('/associations', authenticateSuperAdmin, async (req, res) => {
  try {
    const { name, type, code, adminEmail, adminPassword, adminName } = req.body;

    if (!name || !code || !adminEmail || !adminPassword) {
      return res.status(400).json({ 
        error: 'Nom, code, email admin et mot de passe admin requis' 
      });
    }

    // Vérifier que le code est unique
    const existingCode = await prisma.association.findUnique({
      where: { code: code.toUpperCase() }
    });
    if (existingCode) {
      return res.status(400).json({ error: 'Ce code existe déjà' });
    }

    // Hash du mot de passe admin
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Créer l'association et son premier admin en transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer l'association
      const association = await tx.association.create({
        data: {
          name,
          type: type || 'association',
          code: code.toUpperCase(),
          active: true,
          adminEmail,
          adminName: adminName || 'Administrateur',
          memberFieldLabel: 'Villa',
          enableVehiclePlates: false
        }
      });

      // Créer l'admin de l'association
      const adminUser = await tx.user.create({
        data: {
          associationId: association.id,
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
          active: true
        }
      });

      return { association, adminUser };
    });

    res.status(201).json({
      message: 'Association créée avec succès',
      association: result.association,
      credentials: {
        email: adminEmail,
        password: adminPassword
      }
    });
  } catch (error) {
    console.error('Erreur création association:', error);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/platform/associations/:id - Modifier une association
router.put('/associations/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { name, type, active, enableVehiclePlates, memberFieldLabel } = req.body;

    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    const updated = await prisma.association.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(typeof active === 'boolean' && { active }),
        ...(typeof enableVehiclePlates === 'boolean' && { enableVehiclePlates }),
        ...(memberFieldLabel && { memberFieldLabel })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Erreur modification association:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/platform/associations/:id/toggle - Activer/Désactiver
router.put('/associations/:id/toggle', authenticateSuperAdmin, async (req, res) => {
  try {
    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    const updated = await prisma.association.update({
      where: { id: req.params.id },
      data: { active: !association.active }
    });

    res.json({
      message: updated.active ? 'Association activée' : 'Association désactivée',
      association: updated
    });
  } catch (error) {
    console.error('Erreur toggle association:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/platform/associations/:id - Supprimer une association
router.delete('/associations/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    // Supprimer l'association (cascade supprimera users, members, etc.)
    await prisma.association.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Association supprimée' });
  } catch (error) {
    console.error('Erreur suppression association:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============ GESTION DES ADMINS ============

// GET /api/platform/associations/:id/admins - Lister les admins d'une association
router.get('/associations/:id/admins', authenticateSuperAdmin, async (req, res) => {
  try {
    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    const admins = await prisma.user.findMany({
      where: { 
        associationId: req.params.id,
        role: 'ADMIN'
      },
      select: {
        id: true,
        email: true,
        phone: true,
        active: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(admins);
  } catch (error) {
    console.error('Erreur liste admins:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/platform/associations/:id/admins - Ajouter un admin à une association
router.post('/associations/:id/admins', authenticateSuperAdmin, async (req, res) => {
  try {
    const { email, password, phone } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    // Vérifier si l'email existe déjà dans l'association
    const existing = await prisma.user.findFirst({
      where: { 
        associationId: req.params.id,
        email
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Cet email existe déjà' });
    }
    
    // Créer le nouvel admin
    const passwordHash = await bcrypt.hash(password, 10);
    
    const admin = await prisma.user.create({
      data: {
        associationId: req.params.id,
        email,
        phone: phone || null,
        passwordHash,
        role: 'ADMIN',
        active: true
      }
    });
    
    res.status(201).json({
      message: 'Admin ajouté avec succès',
      admin: { 
        id: admin.id, 
        email: admin.email, 
        phone: admin.phone 
      }
    });
  } catch (error) {
    console.error('Erreur ajout admin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/platform/associations/:id/admins/:adminId/password - Changer mot de passe admin
router.put('/associations/:id/admins/:adminId/password', authenticateSuperAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Mot de passe requis (minimum 4 caractères)' });
    }

    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    // Vérifier si l'admin existe
    const admin = await prisma.user.findFirst({
      where: { 
        id: req.params.adminId,
        associationId: req.params.id,
        role: 'ADMIN'
      }
    });
    if (!admin) {
      return res.status(404).json({ error: 'Admin non trouvé' });
    }
    
    // Mettre à jour le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);
    
    await prisma.user.update({
      where: { id: req.params.adminId },
      data: { passwordHash }
    });
    
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('Erreur modification mot de passe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/platform/associations/:id/admins/:adminId - Supprimer un admin
router.delete('/associations/:id/admins/:adminId', authenticateSuperAdmin, async (req, res) => {
  try {
    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    // Compter le nombre d'admins
    const adminCount = await prisma.user.count({
      where: { 
        associationId: req.params.id,
        role: 'ADMIN'
      }
    });
    
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Impossible de supprimer le dernier admin' });
    }
    
    // Supprimer l'admin
    await prisma.user.delete({
      where: { id: req.params.adminId }
    });
    
    res.json({ message: 'Admin supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression admin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/platform/stats - Statistiques de la plateforme
router.get('/stats', authenticateSuperAdmin, async (req, res) => {
  try {
    const totalAssociations = await prisma.association.count();
    const activeAssociations = await prisma.association.count({
      where: { active: true }
    });
    const inactiveAssociations = totalAssociations - activeAssociations;

    const totalMembers = await prisma.member.count();
    const totalUsers = await prisma.user.count();

    res.json({
      totalAssociations,
      activeAssociations,
      inactiveAssociations,
      totalMembers,
      totalUsers
    });
  } catch (error) {
    console.error('Erreur stats platform:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
