import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireAdmin, generateAccessToken } from '../middleware/auth.js';

const router = express.Router();

// Authentification requise pour toutes les routes
router.use(authenticateToken);

// GET /api/members
// Liste tous les membres (avec recherche)
router.get('/', async (req, res) => {
  try {
    const { search, active } = req.query;

    const where = {
      role: 'MEMBER'
    };

    // Filtre actif/inactif
    if (active !== undefined) {
      where.active = active === 'true';
    }

    // Recherche par nom ou champ personnalisé
    if (search) {
      where.OR = [
        { member: { name: { contains: search, mode: 'insensitive' } } },
        { member: { customFieldValue: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const members = await req.prisma.user.findMany({
      where,
      include: {
        member: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Formatter les résultats
    const formatted = members.map(user => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      active: user.active,
      token: req.user.role === 'ADMIN' ? user.token : undefined, // Token visible uniquement pour ADMIN
      name: user.member?.name,
      customFieldValue: user.member?.customFieldValue,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.json(formatted);
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des membres' });
  }
});

// POST /api/members
// Créer un nouveau membre (ADMIN uniquement)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, customFieldValue, email, phone, password } = req.body;

    if (!name || !customFieldValue) {
      return res.status(400).json({ error: 'Nom et champ personnalisé requis' });
    }

    if (!email && !phone) {
      return res.status(400).json({ error: 'Email ou téléphone requis' });
    }

    // Vérifier unicité email
    if (email) {
      const existing = await req.prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }
    }

    // Générer un mot de passe aléatoire si non fourni
    const finalPassword = password || Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(finalPassword, 10);

    // Générer un token d'accès unique
    let accessToken = generateAccessToken();
    let tokenExists = true;
    
    // S'assurer que le token est unique
    while (tokenExists) {
      const existing = await req.prisma.user.findUnique({ where: { token: accessToken } });
      if (!existing) tokenExists = false;
      else accessToken = generateAccessToken();
    }

    // Créer l'utilisateur et le membre en transaction
    const result = await req.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email: email || `member_${Date.now()}@temp.local`,
          phone: phone || null,
          passwordHash,
          role: 'MEMBER',
          token: accessToken,
          active: true
        }
      });

      const member = await prisma.member.create({
        data: {
          userId: user.id,
          name,
          customFieldValue,
          active: true
        }
      });

      return { user, member };
    });

    res.status(201).json({
      id: result.user.id,
      email: result.user.email,
      phone: result.user.phone,
      token: result.user.token,
      password: finalPassword, // Retourner le password généré
      name: result.member.name,
      customFieldValue: result.member.customFieldValue,
      active: result.user.active
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du membre' });
  }
});

// GET /api/members/:id
// Récupérer un membre spécifique
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await req.prisma.user.findUnique({
      where: { id, role: 'MEMBER' },
      include: { member: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Membre introuvable' });
    }

    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      active: user.active,
      token: req.user.role === 'ADMIN' ? user.token : undefined,
      name: user.member?.name,
      customFieldValue: user.member?.customFieldValue,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du membre' });
  }
});

// PUT /api/members/:id
// Modifier un membre (ADMIN uniquement)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, customFieldValue, email, phone } = req.body;

    // Vérifier que le membre existe
    const existing = await req.prisma.user.findUnique({
      where: { id, role: 'MEMBER' },
      include: { member: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Membre introuvable' });
    }

    // Vérifier unicité email si changé
    if (email && email !== existing.email) {
      const emailExists = await req.prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }
    }

    // Mettre à jour en transaction
    const result = await req.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.update({
        where: { id },
        data: {
          email: email || existing.email,
          phone: phone !== undefined ? phone : existing.phone
        }
      });

      const member = await prisma.member.update({
        where: { userId: id },
        data: {
          name: name || existing.member.name,
          customFieldValue: customFieldValue || existing.member.customFieldValue
        }
      });

      return { user, member };
    });

    res.json({
      id: result.user.id,
      email: result.user.email,
      phone: result.user.phone,
      active: result.user.active,
      token: result.user.token,
      name: result.member.name,
      customFieldValue: result.member.customFieldValue
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du membre' });
  }
});

// PUT /api/members/:id/deactivate
// Désactiver un membre (ADMIN uniquement)
router.put('/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await req.prisma.user.update({
      where: { id, role: 'MEMBER' },
      data: { active: false }
    });

    res.json({ message: 'Membre désactivé avec succès' });
  } catch (error) {
    console.error('Deactivate member error:', error);
    res.status(500).json({ error: 'Erreur lors de la désactivation du membre' });
  }
});

// PUT /api/members/:id/activate
// Réactiver un membre (ADMIN uniquement)
router.put('/:id/activate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await req.prisma.user.update({
      where: { id, role: 'MEMBER' },
      data: { active: true }
    });

    res.json({ message: 'Membre réactivé avec succès' });
  } catch (error) {
    console.error('Activate member error:', error);
    res.status(500).json({ error: 'Erreur lors de la réactivation du membre' });
  }
});

// POST /api/members/:id/reset-password
// Réinitialiser le mot de passe d'un membre (ADMIN uniquement)
router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Mot de passe trop court (minimum 4 caractères)' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await req.prisma.user.update({
      where: { id, role: 'MEMBER' },
      data: { passwordHash }
    });

    res.json({ message: 'Mot de passe réinitialisé', newPassword });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

// POST /api/members/:id/regenerate-token
// Régénérer le token d'accès d'un membre (ADMIN uniquement)
router.post('/:id/regenerate-token', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Générer un nouveau token unique
    let accessToken = generateAccessToken();
    let tokenExists = true;
    
    while (tokenExists) {
      const existing = await req.prisma.user.findUnique({ where: { token: accessToken } });
      if (!existing) tokenExists = false;
      else accessToken = generateAccessToken();
    }

    await req.prisma.user.update({
      where: { id, role: 'MEMBER' },
      data: { token: accessToken }
    });

    res.json({ message: 'Token régénéré', token: accessToken });
  } catch (error) {
    console.error('Regenerate token error:', error);
    res.status(500).json({ error: 'Erreur lors de la régénération du token' });
  }
});

// DELETE /api/members/:id
// Supprimer un membre et son compte utilisateur
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Trouver le membre via son userId
    const user = await req.prisma.user.findUnique({
      where: { id },
      include: { member: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    // Supprimer dans une transaction : paiements → membre → utilisateur
    await req.prisma.$transaction(async (prisma) => {
      if (user.member) {
        // Supprimer les paiements mensuels du membre
        await prisma.monthlyPayment.deleteMany({
          where: { memberId: user.member.id }
        });

        // Supprimer les paiements exceptionnels du membre
        await prisma.exceptionalPayment.deleteMany({
          where: { memberId: user.member.id }
        });

        // Supprimer le membre
        await prisma.member.delete({
          where: { id: user.member.id }
        });
      }

      // Supprimer l'utilisateur
      await prisma.user.delete({
        where: { id }
      });
    });

    res.json({ message: 'Membre supprimé avec succès' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du membre' });
  }
});

export default router;
