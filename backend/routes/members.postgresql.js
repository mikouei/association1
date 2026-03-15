// Routes membres pour AssocManager - PostgreSQL Multi-Tenant
import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireAdmin, generateAccessToken, prisma } from '../middleware/auth.postgresql.js';

const router = express.Router();

// Authentification requise pour toutes les routes
router.use(authenticateToken);

// Désactiver le cache HTTP
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// GET /api/members
// Liste tous les membres de l'association
router.get('/', async (req, res) => {
  try {
    const { search, active } = req.query;

    const where = {
      associationId: req.associationId,
      user: {
        role: 'MEMBER'
      }
    };

    // Filtre actif/inactif
    if (active !== undefined) {
      where.active = active === 'true';
    }

    // Recherche par nom ou champ personnalisé
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { customFieldValue: { contains: search, mode: 'insensitive' } }
      ];
    }

    const members = await prisma.member.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            active: true,
            token: true,
            createdAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 1000
    });

    // Formatter les résultats pour compatibilité avec l'ancien format
    const formatted = members.map(member => ({
      id: member.user.id,
      email: member.user.email,
      phone: member.user.phone,
      active: member.user.active,
      token: req.user.role === 'ADMIN' ? member.user.token : undefined,
      name: member.name,
      customFieldValue: member.customFieldValue,
      createdAt: member.user.createdAt,
      updatedAt: member.user.updatedAt
    }));

    res.json(formatted);
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des membres' });
  }
});

// GET /api/members/:id
// Détail d'un membre
router.get('/:id', async (req, res) => {
  try {
    const member = await prisma.member.findFirst({
      where: {
        userId: req.params.id,
        associationId: req.associationId
      },
      include: {
        user: true,
        vehiclePlates: true
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    res.json({
      id: member.user.id,
      email: member.user.email,
      phone: member.user.phone,
      active: member.user.active,
      token: req.user.role === 'ADMIN' ? member.user.token : undefined,
      name: member.name,
      customFieldValue: member.customFieldValue,
      vehiclePlates: member.vehiclePlates,
      createdAt: member.user.createdAt,
      updatedAt: member.user.updatedAt
    });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du membre' });
  }
});

// POST /api/members
// Créer un nouveau membre (ADMIN uniquement)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, customFieldValue, email, phone, password } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nom requis' });
    }

    // Générer email par défaut si non fourni
    const memberEmail = email || `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@temp.local`;
    
    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password || Math.random().toString(36).slice(-8), 10);
    
    // Générer un token d'accès unique
    const accessToken = generateAccessToken();

    // Créer l'utilisateur et le membre en transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          associationId: req.associationId,
          email: memberEmail,
          phone: phone || null,
          passwordHash,
          role: 'MEMBER',
          token: accessToken,
          active: true
        }
      });

      const member = await tx.member.create({
        data: {
          associationId: req.associationId,
          userId: user.id,
          name,
          customFieldValue: customFieldValue || '',
          active: true
        }
      });

      return { user, member };
    });

    res.status(201).json({
      id: result.user.id,
      email: result.user.email,
      phone: result.user.phone,
      active: result.user.active,
      token: result.user.token,
      name: result.member.name,
      customFieldValue: result.member.customFieldValue,
      createdAt: result.user.createdAt
    });
  } catch (error) {
    console.error('Create member error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email ou téléphone déjà utilisé' });
    }
    res.status(500).json({ error: 'Erreur lors de la création du membre' });
  }
});

// PUT /api/members/:id
// Modifier un membre (ADMIN uniquement)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, customFieldValue, email, phone, active } = req.body;

    const member = await prisma.member.findFirst({
      where: {
        userId: req.params.id,
        associationId: req.associationId
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    // Mise à jour en transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: req.params.id },
        data: {
          ...(email && { email }),
          ...(phone !== undefined && { phone }),
          ...(typeof active === 'boolean' && { active })
        }
      });

      const updatedMember = await tx.member.update({
        where: { id: member.id },
        data: {
          ...(name && { name }),
          ...(customFieldValue !== undefined && { customFieldValue })
        }
      });

      return { user: updatedUser, member: updatedMember };
    });

    res.json({
      id: result.user.id,
      email: result.user.email,
      phone: result.user.phone,
      active: result.user.active,
      name: result.member.name,
      customFieldValue: result.member.customFieldValue,
      updatedAt: result.user.updatedAt
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du membre' });
  }
});

// DELETE /api/members/:id
// Supprimer un membre (ADMIN uniquement)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const member = await prisma.member.findFirst({
      where: {
        userId: req.params.id,
        associationId: req.associationId
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    // Supprimer l'utilisateur (cascade supprimera le membre)
    await prisma.user.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Membre supprimé avec succès' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du membre' });
  }
});

// PUT /api/members/:id/activate
router.put('/:id/activate', requireAdmin, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { active: true }
    });
    res.json({ message: 'Membre activé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'activation' });
  }
});

// PUT /api/members/:id/deactivate
router.put('/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { active: false }
    });
    res.json({ message: 'Membre désactivé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la désactivation' });
  }
});

// PUT /api/members/:id/regenerate-token
router.put('/:id/regenerate-token', requireAdmin, async (req, res) => {
  try {
    const newToken = generateAccessToken();
    
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { token: newToken }
    });

    res.json({ token: user.token });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la régénération du token' });
  }
});

export default router;
