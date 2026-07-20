import express from 'express';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(authenticateToken);

// GET /api/years
// Liste toutes les années de l'association
router.get('/', async (req, res) => {
  try {
    const years = await prisma.year.findMany({
      where: { associationId: req.associationId },
      orderBy: { year: 'desc' }
    });
    res.json(years);
  } catch (error) {
    console.error('List years error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des années' });
  }
});

// GET /api/years/active
// Récupérer l'année active de l'association
router.get('/active', async (req, res) => {
  try {
    const activeYear = await prisma.year.findFirst({
      where: { 
        associationId: req.associationId,
        active: true 
      }
    });
    
    if (!activeYear) {
      return res.status(404).json({ error: 'Aucune année active' });
    }
    
    res.json(activeYear);
  } catch (error) {
    console.error('Get active year error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'année active' });
  }
});

// POST /api/years
// Créer une nouvelle année (ADMIN uniquement)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { year, monthlyAmount, active } = req.body;

    if (!year || !monthlyAmount) {
      return res.status(400).json({ error: 'Année et montant mensuel requis' });
    }

    const parsedYear = parseInt(year, 10);
    const parsedAmount = parseFloat(monthlyAmount);
    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < 2000 ||
      parsedYear > 2100 ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      parsedAmount > 100_000_000
    ) {
      return res.status(400).json({ error: 'Données invalides (année 2000-2100, montant > 0)' });
    }

    // Vérifier si l'année existe déjà dans l'association
    const existing = await prisma.year.findFirst({
      where: { 
        associationId: req.associationId,
        year: parseInt(year) 
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Cette année existe déjà' });
    }

    // Si on crée une année active, désactiver les autres
    if (active) {
      await prisma.year.updateMany({
        where: { 
          associationId: req.associationId,
          active: true 
        },
        data: { active: false }
      });
    }

    const newYear = await prisma.year.create({
      data: {
        associationId: req.associationId,
        year: parseInt(year),
        monthlyAmount: parseFloat(monthlyAmount),
        active: active || false
      }
    });

    res.status(201).json(newYear);
  } catch (error) {
    console.error('Create year error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'année' });
  }
});

// PUT /api/years/:id
// Modifier une année (ADMIN uniquement)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { monthlyAmount, year } = req.body;

    // Au moins un champ à modifier
    if (monthlyAmount === undefined && year === undefined) {
      return res.status(400).json({ error: 'Montant mensuel ou numéro d\'année requis' });
    }

    // Vérifier que l'année appartient à l'association
    const existing = await prisma.year.findFirst({
      where: { 
        id,
        associationId: req.associationId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    const updateData = {};

    // Mise à jour du montant mensuel
    if (monthlyAmount !== undefined) {
      updateData.monthlyAmount = parseFloat(monthlyAmount);
    }

    // Mise à jour du numéro d'année
    if (year !== undefined) {
      const newYear = parseInt(year);
      
      // Vérifier que le numéro d'année est valide
      if (isNaN(newYear) || newYear < 2000 || newYear > 2100) {
        return res.status(400).json({ error: 'Numéro d\'année invalide' });
      }

      // Si le numéro change, vérifier l'unicité
      if (newYear !== existing.year) {
        const conflict = await prisma.year.findFirst({
          where: {
            associationId: req.associationId,
            year: newYear,
            id: { not: id } // Exclure l'année en cours de modification
          }
        });

        if (conflict) {
          return res.status(400).json({ error: 'Cette année existe déjà pour cette association' });
        }

        updateData.year = newYear;
      }
    }

    const updatedYear = await prisma.year.update({
      where: { id },
      data: updateData
    });

    res.json(updatedYear);
  } catch (error) {
    console.error('Update year error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'année' });
  }
});

// PUT /api/years/:id/activate
// Activer une année (désactive les autres) (ADMIN uniquement)
router.put('/:id/activate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'année appartient à l'association
    const existing = await prisma.year.findFirst({
      where: { 
        id,
        associationId: req.associationId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    // Désactiver toutes les autres années de l'association
    await prisma.year.updateMany({
      where: { 
        associationId: req.associationId,
        active: true 
      },
      data: { active: false }
    });

    // Activer l'année ciblée
    const activatedYear = await prisma.year.update({
      where: { id },
      data: { active: true }
    });

    res.json(activatedYear);
  } catch (error) {
    console.error('Activate year error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'activation de l\'année' });
  }
});

// DELETE /api/years/:id
// Supprimer une année (ADMIN uniquement)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'année appartient à l'association
    const existing = await prisma.year.findFirst({
      where: { 
        id,
        associationId: req.associationId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    // Vérifier si l'année a des paiements
    const paymentsCount = await prisma.monthlyPayment.count({
      where: { yearId: id }
    });

    if (paymentsCount > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer une année avec des paiements enregistrés' 
      });
    }

    await prisma.year.delete({
      where: { id }
    });

    res.json({ message: 'Année supprimée avec succès' });
  } catch (error) {
    console.error('Delete year error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'année' });
  }
});

export default router;
