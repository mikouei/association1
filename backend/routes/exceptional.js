import express from 'express';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(authenticateToken);

const CONTRIBUTION_TYPES = ['décès', 'mariage', 'anniversaire', 'solidarité', 'autre'];

// GET /api/exceptional
// Liste toutes les cotisations exceptionnelles de l'association
router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    
    const where = {
      associationId: req.associationId
    };
    if (active !== undefined) {
      where.active = active === 'true';
    }

    const contributions = await prisma.exceptionalContribution.findMany({
      where,
      include: {
        payments: {
          include: {
            member: {
              include: {
                user: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculer les stats pour chaque contribution
    const formatted = contributions.map(contrib => {
      const totalCollected = contrib.payments.reduce((sum, p) => sum + p.amount, 0);
      const participantsCount = new Set(contrib.payments.map(p => p.memberId)).size;
      
      return {
        ...contrib,
        totalCollected,
        participantsCount
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('List exceptional contributions error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des cotisations' });
  }
});

// GET /api/exceptional/:id
// Détail d'une cotisation exceptionnelle
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const contribution = await prisma.exceptionalContribution.findFirst({
      where: { 
        id,
        associationId: req.associationId
      },
      include: {
        payments: {
          include: {
            member: {
              include: {
                user: true
              }
            }
          },
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!contribution) {
      return res.status(404).json({ error: 'Cotisation introuvable' });
    }

    const totalCollected = contribution.payments.reduce((sum, p) => sum + p.amount, 0);
    const participantsCount = new Set(contribution.payments.map(p => p.memberId)).size;

    res.json({
      ...contribution,
      totalCollected,
      participantsCount
    });
  } catch (error) {
    console.error('Get exceptional contribution error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la cotisation' });
  }
});

// POST /api/exceptional
// Créer une cotisation exceptionnelle (ADMIN)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, type, description } = req.body;

    if (!title || !type) {
      return res.status(400).json({ error: 'Titre et type requis' });
    }

    if (!CONTRIBUTION_TYPES.includes(type)) {
      return res.status(400).json({ 
        error: `Type invalide. Types autorisés: ${CONTRIBUTION_TYPES.join(', ')}` 
      });
    }

    const contribution = await prisma.exceptionalContribution.create({
      data: {
        associationId: req.associationId,
        title,
        type,
        description: description || null,
        active: true
      }
    });

    res.status(201).json(contribution);
  } catch (error) {
    console.error('Create exceptional contribution error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la cotisation' });
  }
});

// PUT /api/exceptional/:id
// Modifier une cotisation (ADMIN)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, description, active } = req.body;

    // Vérifier que la cotisation appartient à l'association
    const existing = await prisma.exceptionalContribution.findFirst({
      where: { 
        id,
        associationId: req.associationId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cotisation introuvable' });
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (type) {
      if (!CONTRIBUTION_TYPES.includes(type)) {
        return res.status(400).json({ 
          error: `Type invalide. Types autorisés: ${CONTRIBUTION_TYPES.join(', ')}` 
        });
      }
      updateData.type = type;
    }
    if (description !== undefined) updateData.description = description;
    if (active !== undefined) updateData.active = active;

    const contribution = await prisma.exceptionalContribution.update({
      where: { id },
      data: updateData
    });

    res.json(contribution);
  } catch (error) {
    console.error('Update exceptional contribution error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// DELETE /api/exceptional/:id
// Supprimer une cotisation (ADMIN)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la cotisation appartient à l'association
    const existing = await prisma.exceptionalContribution.findFirst({
      where: { 
        id,
        associationId: req.associationId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cotisation introuvable' });
    }

    await prisma.exceptionalContribution.delete({
      where: { id }
    });

    res.json({ message: 'Cotisation supprimée avec succès' });
  } catch (error) {
    console.error('Delete exceptional contribution error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// POST /api/exceptional/:id/payments
// Enregistrer un paiement pour une cotisation (ADMIN)
router.post('/:id/payments', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { memberId, amount, paymentDate, notes } = req.body;

    if (!memberId || !amount) {
      return res.status(400).json({ error: 'Membre et montant requis' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    // Vérifier que la cotisation existe dans l'association
    const contribution = await prisma.exceptionalContribution.findFirst({
      where: { 
        id,
        associationId: req.associationId
      }
    });

    if (!contribution) {
      return res.status(404).json({ error: 'Cotisation introuvable' });
    }

    // Trouver le membre (accepte userId ou memberId)
    let member = await prisma.member.findFirst({ 
      where: { 
        id: memberId,
        associationId: req.associationId
      } 
    });
    if (!member) {
      member = await prisma.member.findFirst({ 
        where: { 
          userId: memberId,
          associationId: req.associationId
        } 
      });
    }

    if (!member) {
      return res.status(404).json({ error: 'Membre introuvable' });
    }

    const payment = await prisma.exceptionalPayment.create({
      data: {
        contributionId: id,
        memberId: member.id,
        amount: parseFloat(amount),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        notes: notes || null
      }
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Create exceptional payment error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du paiement' });
  }
});

// PUT /api/exceptional/payments/:paymentId
// Modifier un paiement exceptionnel (ADMIN)
router.put('/payments/:paymentId', requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, paymentDate, notes } = req.body;

    const updateData = {};
    if (amount !== undefined) {
      if (amount <= 0) {
        return res.status(400).json({ error: 'Montant invalide' });
      }
      updateData.amount = parseFloat(amount);
    }
    if (paymentDate) updateData.paymentDate = new Date(paymentDate);
    if (notes !== undefined) updateData.notes = notes;

    const payment = await prisma.exceptionalPayment.update({
      where: { id: paymentId },
      data: updateData
    });

    res.json(payment);
  } catch (error) {
    console.error('Update exceptional payment error:', error);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// DELETE /api/exceptional/payments/:paymentId
// Supprimer un paiement exceptionnel (ADMIN)
router.delete('/payments/:paymentId', requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;

    await prisma.exceptionalPayment.delete({
      where: { id: paymentId }
    });

    res.json({ message: 'Paiement supprimé avec succès' });
  } catch (error) {
    console.error('Delete exceptional payment error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

export default router;
