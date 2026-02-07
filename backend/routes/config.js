import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import platformPrisma from '../prisma/platformClient.js';

const router = express.Router();

// GET /api/config
// Récupérer la configuration de l'association (accessible à tous)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let config = await req.prisma.associationConfig.findFirst();

    // Si aucune config, créer une config par défaut
    if (!config) {
      config = await req.prisma.associationConfig.create({
        data: {
          name: 'Mon Association',
          type: 'Association',
          memberFieldLabel: 'Villa'
        }
      });
    }

    res.json(config);
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la configuration' });
  }
});

// POST /api/config
// Créer ou mettre à jour la configuration (ADMIN uniquement)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, type, memberFieldLabel } = req.body;

    if (!name || !memberFieldLabel) {
      return res.status(400).json({ error: 'Nom et libellé du champ requis' });
    }

    // Vérifier s'il existe déjà une config
    const existing = await req.prisma.associationConfig.findFirst();

    let config;
    if (existing) {
      // Mettre à jour
      config = await req.prisma.associationConfig.update({
        where: { id: existing.id },
        data: { name, type, memberFieldLabel }
      });
    } else {
      // Créer
      config = await req.prisma.associationConfig.create({
        data: { name, type, memberFieldLabel }
      });
    }

    res.json(config);
  } catch (error) {
    console.error('Save config error:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde de la configuration' });
  }
});

export default router;
