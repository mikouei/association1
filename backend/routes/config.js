import express from 'express';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';

const router = express.Router();

// GET /api/config
// Récupérer la configuration de l'association (accessible à tous)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // La config est maintenant dans la table Association
    const association = req.association;

    // Récupérer ou créer la config associée
    let config = await prisma.associationConfig.findFirst({
      where: { associationId: req.associationId }
    });

    // Si aucune config spécifique, utiliser les valeurs de l'association
    if (!config) {
      config = {
        id: null,
        associationId: req.associationId,
        name: association.name,
        type: association.type || 'Association',
        memberFieldLabel: association.memberFieldLabel || 'Villa',
        createdAt: association.createdAt,
        updatedAt: association.updatedAt
      };
    }

    res.json({
      ...config,
      memberFieldLabel: association.memberFieldLabel || 'Villa'
    });
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

    // Mettre à jour l'association directement
    const updatedAssociation = await prisma.association.update({
      where: { id: req.associationId },
      data: { 
        name,
        type,
        memberFieldLabel
      }
    });

    // Vérifier s'il existe déjà une config
    const existingConfig = await prisma.associationConfig.findFirst({
      where: { associationId: req.associationId }
    });

    let config;
    if (existingConfig) {
      // Mettre à jour
      config = await prisma.associationConfig.update({
        where: { id: existingConfig.id },
        data: { name, type }
      });
    } else {
      // Créer
      config = await prisma.associationConfig.create({
        data: { 
          associationId: req.associationId,
          name, 
          type 
        }
      });
    }

    res.json({
      ...config,
      memberFieldLabel: updatedAssociation.memberFieldLabel
    });
  } catch (error) {
    console.error('Save config error:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde de la configuration' });
  }
});

export default router;
