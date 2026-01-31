import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(authenticateToken);

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// GET /api/payments/year/:yearId
// Tous les paiements d'une année avec calculs par membre
router.get('/year/:yearId', async (req, res) => {
  try {
    const { yearId } = req.params;

    // Récupérer l'année
    const year = await req.prisma.year.findUnique({
      where: { id: yearId }
    });

    if (!year) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    // Récupérer tous les membres actifs
    const members = await req.prisma.member.findMany({
      where: { active: true },
      include: {
        user: true,
        payments: {
          where: { yearId }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Calculer les données pour chaque membre
    const membersData = members.map(member => {
      // Grouper les paiements par mois
      const paymentsByMonth = {};
      
      for (let month = 1; month <= 12; month++) {
        const monthPayments = member.payments.filter(p => p.month === month);
        const totalPaid = monthPayments.reduce((sum, p) => sum + p.amountPaid, 0);
        
        paymentsByMonth[month] = {
          paid: totalPaid >= year.monthlyAmount,
          amountPaid: totalPaid,
          payments: monthPayments
        };
      }

      // Calculs globaux
      const totalPaid = member.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const totalDue = year.monthlyAmount * 12;
      const remaining = totalDue - totalPaid;
      const percentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

      return {
        id: member.id,
        userId: member.userId,
        name: member.name,
        customFieldValue: member.customFieldValue,
        phone: member.user.phone,
        paymentsByMonth,
        totalPaid,
        totalDue,
        remaining,
        percentage: Math.round(percentage * 100) / 100
      };
    });

    res.json({
      year,
      members: membersData
    });
  } catch (error) {
    console.error('Get year payments error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paiements' });
  }
});

// GET /api/payments/member/:memberId/year/:yearId
// Paiements d'un membre pour une année
router.get('/member/:memberId/year/:yearId', async (req, res) => {
  try {
    const { memberId, yearId } = req.params;

    const year = await req.prisma.year.findUnique({
      where: { id: yearId }
    });

    if (!year) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    const payments = await req.prisma.monthlyPayment.findMany({
      where: {
        memberId,
        yearId
      },
      orderBy: [{ month: 'asc' }, { paymentDate: 'asc' }]
    });

    // Grouper par mois
    const paymentsByMonth = {};
    for (let month = 1; month <= 12; month++) {
      const monthPayments = payments.filter(p => p.month === month);
      const totalPaid = monthPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      
      paymentsByMonth[month] = {
        monthName: MONTHS[month - 1],
        paid: totalPaid >= year.monthlyAmount,
        amountPaid: totalPaid,
        amountDue: year.monthlyAmount,
        remaining: Math.max(0, year.monthlyAmount - totalPaid),
        payments: monthPayments
      };
    }

    // Calculs globaux
    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalDue = year.monthlyAmount * 12;
    const remaining = totalDue - totalPaid;
    const percentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

    res.json({
      year,
      paymentsByMonth,
      summary: {
        totalPaid,
        totalDue,
        remaining,
        percentage: Math.round(percentage * 100) / 100
      }
    });
  } catch (error) {
    console.error('Get member payments error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paiements' });
  }
});

// POST /api/payments
// Enregistrer un paiement (ADMIN uniquement)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { memberId, yearId, month, amountPaid, paymentDate, notes } = req.body;

    if (!memberId || !yearId || !month || amountPaid === undefined) {
      return res.status(400).json({ 
        error: 'Membre, année, mois et montant requis' 
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'Mois invalide (1-12)' });
    }

    if (amountPaid <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    // Vérifier que le membre et l'année existent
    const [member, year] = await Promise.all([
      req.prisma.member.findUnique({ where: { id: memberId } }),
      req.prisma.year.findUnique({ where: { id: yearId } })
    ]);

    if (!member) {
      return res.status(404).json({ error: 'Membre introuvable' });
    }

    if (!year) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    const payment = await req.prisma.monthlyPayment.create({
      data: {
        memberId,
        yearId,
        month: parseInt(month),
        amountPaid: parseFloat(amountPaid),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        notes: notes || null
      }
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du paiement' });
  }
});

// PUT /api/payments/:id
// Modifier un paiement (ADMIN uniquement)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaid, paymentDate, notes } = req.body;

    if (amountPaid !== undefined && amountPaid <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const updateData = {};
    if (amountPaid !== undefined) updateData.amountPaid = parseFloat(amountPaid);
    if (paymentDate) updateData.paymentDate = new Date(paymentDate);
    if (notes !== undefined) updateData.notes = notes;

    const payment = await req.prisma.monthlyPayment.update({
      where: { id },
      data: updateData
    });

    res.json(payment);
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du paiement' });
  }
});

// DELETE /api/payments/:id
// Supprimer un paiement (ADMIN uniquement)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await req.prisma.monthlyPayment.delete({
      where: { id }
    });

    res.json({ message: 'Paiement supprimé avec succès' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du paiement' });
  }
});

// GET /api/payments/stats/year/:yearId
// Statistiques globales d'une année
router.get('/stats/year/:yearId', async (req, res) => {
  try {
    const { yearId } = req.params;

    const year = await req.prisma.year.findUnique({
      where: { id: yearId }
    });

    if (!year) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    // Compter les membres actifs
    const activeMembersCount = await req.prisma.member.count({
      where: { active: true }
    });

    // Calculer le total des paiements
    const payments = await req.prisma.monthlyPayment.findMany({
      where: { yearId },
      include: { member: true }
    });

    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalDue = year.monthlyAmount * 12 * activeMembersCount;
    const remaining = totalDue - totalPaid;
    const percentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

    // Compter les membres à jour (payé >= dû)
    const membersWithPayments = await req.prisma.member.findMany({
      where: { active: true },
      include: {
        payments: { where: { yearId } }
      }
    });

    let membersUpToDate = 0;
    let membersLate = 0;

    membersWithPayments.forEach(member => {
      const memberTotalPaid = member.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const memberDue = year.monthlyAmount * 12;
      
      if (memberTotalPaid >= memberDue) {
        membersUpToDate++;
      } else {
        membersLate++;
      }
    });

    res.json({
      year,
      activeMembersCount,
      totalPaid,
      totalDue,
      remaining,
      percentage: Math.round(percentage * 100) / 100,
      membersUpToDate,
      membersLate
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Erreur lors du calcul des statistiques' });
  }
});

export default router;
