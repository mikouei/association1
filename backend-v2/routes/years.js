import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(authenticateToken);

// GET /api/years
// Liste toutes les années
router.get('/', async (req, res) => {
  try {
    const years = await req.prisma.year.findMany({
      orderBy: { year: 'desc' }
    });
    res.json(years);
  } catch (error) {
    console.error('List years error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des années' });
  }
});

// GET /api/years/active
// Récupérer l'année active
router.get('/active', async (req, res) => {
  try {
    const activeYear = await req.prisma.year.findFirst({
      where: { active: true }
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

    // Vérifier si l'année existe déjà
    const existing = await req.prisma.year.findUnique({
      where: { year: parseInt(year) }
    });

    if (existing) {
      return res.status(400).json({ error: 'Cette année existe déjà' });
    }

    // Si on crée une année active, désactiver les autres
    if (active) {
      await req.prisma.year.updateMany({
        where: { active: true },
        data: { active: false }
      });
    }

    const newYear = await req.prisma.year.create({
      data: {
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
    const { monthlyAmount } = req.body;

    if (!monthlyAmount) {
      return res.status(400).json({ error: 'Montant mensuel requis' });
    }

    const updatedYear = await req.prisma.year.update({
      where: { id },
      data: { monthlyAmount: parseFloat(monthlyAmount) }
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

    // Désactiver toutes les autres années
    await req.prisma.year.updateMany({
      where: { active: true },
      data: { active: false }
    });

    // Activer l'année ciblée
    const activatedYear = await req.prisma.year.update({
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

    // Vérifier si l'année a des paiements
    const paymentsCount = await req.prisma.monthlyPayment.count({
      where: { yearId: id }
    });

    if (paymentsCount > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer une année avec des paiements enregistrés' 
      });
    }

    await req.prisma.year.delete({
      where: { id }
    });

    res.json({ message: 'Année supprimée avec succès' });
  } catch (error) {
    console.error('Delete year error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'année' });
  }
});

export default router;
