import express from 'express';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLog.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(authenticateToken);

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// GET /api/payments/year/:yearId
// Tous les paiements d'une année avec calculs par membre - ADMIN ONLY
router.get('/year/:yearId', requireAdmin, async (req, res) => {
  try {
    const { yearId } = req.params;

    // Récupérer l'année (vérifier qu'elle appartient à l'association)
    const year = await prisma.year.findFirst({
      where: { 
        id: yearId,
        associationId: req.associationId
      }
    });

    if (!year) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    // Récupérer tous les membres actifs de l'association
    const members = await prisma.member.findMany({
      where: { 
        associationId: req.associationId,
        active: true 
      },
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
// Paiements d'un membre pour une année - ADMIN ONLY
router.get('/member/:memberId/year/:yearId', requireAdmin, async (req, res) => {
  try {
    const { memberId, yearId } = req.params;

    const year = await prisma.year.findFirst({
      where: { 
        id: yearId,
        associationId: req.associationId
      }
    });

    if (!year) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    const payments = await prisma.monthlyPayment.findMany({
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
// Enregistrer ou mettre à jour un paiement (ADMIN uniquement)
// Si un paiement existe déjà pour ce membre/année/mois, il sera REMPLACÉ (pas accumulé)
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

    // Vérifier que le membre et l'année existent dans l'association
    // memberId peut être userId ou memberId direct
    let member = await prisma.member.findFirst({ 
      where: { 
        id: memberId,
        associationId: req.associationId
      } 
    });
    
    if (!member) {
      // Essayer de trouver par userId
      member = await prisma.member.findFirst({ 
        where: { 
          userId: memberId,
          associationId: req.associationId
        } 
      });
    }

    const year = await prisma.year.findFirst({ 
      where: { 
        id: yearId,
        associationId: req.associationId
      } 
    });

    if (!member) {
      return res.status(404).json({ error: 'Membre introuvable' });
    }

    if (!year) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    // Vérifier s'il existe déjà un paiement pour ce membre/année/mois
    const existingPayment = await prisma.monthlyPayment.findFirst({
      where: {
        memberId: member.id,
        yearId,
        month: parseInt(month)
      }
    });

    let payment;
    
    if (existingPayment) {
      // MISE À JOUR: Remplacer le montant existant (ne pas accumuler)
      payment = await prisma.monthlyPayment.update({
        where: { id: existingPayment.id },
        data: {
          amountPaid: parseFloat(amountPaid),
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          notes: notes || existingPayment.notes
        }
      });
    } else {
      // CRÉATION: Nouveau paiement
      payment = await prisma.monthlyPayment.create({
        data: {
          memberId: member.id,
          yearId,
          month: parseInt(month),
          amountPaid: parseFloat(amountPaid),
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          notes: notes || null
        }
      });
    }

    res.status(201).json(payment);

    // Log de l'activité
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: existingPayment ? 'payment.update' : 'payment.create',
      targetType: 'MonthlyPayment',
      targetId: payment.id,
      details: `Paiement ${existingPayment ? 'modifié' : 'créé'}: ${parseFloat(amountPaid)} FCFA pour ${member.name} (${monthNames[parseInt(month) - 1]} ${year.year})`
    });
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

    // Vérifier que le paiement appartient à l'association via le membre ou l'année
    const existingPayment = await prisma.monthlyPayment.findFirst({
      where: { id },
      include: {
        member: true,
        year: true
      }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    // Vérifier l'appartenance à l'association (défense en profondeur: rejeter si l'un OU l'autre diffère)
    if (existingPayment.member?.associationId !== req.associationId || 
        existingPayment.year?.associationId !== req.associationId) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    const updateData = {};
    if (amountPaid !== undefined) updateData.amountPaid = parseFloat(amountPaid);
    if (paymentDate) updateData.paymentDate = new Date(paymentDate);
    if (notes !== undefined) updateData.notes = notes;

    const payment = await prisma.monthlyPayment.update({
      where: { id },
      data: updateData
    });

    res.json(payment);

    // Log de l'activité
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'payment.update',
      targetType: 'MonthlyPayment',
      targetId: payment.id,
      details: `Paiement modifié: ${payment.amountPaid} FCFA pour ${existingPayment.member?.name || 'Inconnu'} (${monthNames[existingPayment.month - 1]} ${existingPayment.year?.year})`
    });
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

    // Vérifier que le paiement appartient à l'association via le membre ou l'année
    const existingPayment = await prisma.monthlyPayment.findFirst({
      where: { id },
      include: {
        member: true,
        year: true
      }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    // Vérifier l'appartenance à l'association (défense en profondeur: rejeter si l'un OU l'autre diffère)
    if (existingPayment.member?.associationId !== req.associationId || 
        existingPayment.year?.associationId !== req.associationId) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    await prisma.monthlyPayment.delete({
      where: { id }
    });

    res.json({ message: 'Paiement supprimé avec succès' });

    // Log de l'activité
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'payment.delete',
      targetType: 'MonthlyPayment',
      targetId: id,
      details: `Paiement supprimé: ${existingPayment.amountPaid} FCFA pour ${existingPayment.member?.name || 'Inconnu'} (${monthNames[existingPayment.month - 1]} ${existingPayment.year?.year})`
    });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du paiement' });
  }
});

// GET /api/payments/stats/year/:yearId
// Statistiques globales d'une année - ADMIN ONLY
router.get('/stats/year/:yearId', requireAdmin, async (req, res) => {
  try {
    const { yearId } = req.params;

    const year = await prisma.year.findFirst({
      where: { 
        id: yearId,
        associationId: req.associationId
      }
    });

    if (!year) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    // Compter les membres actifs de l'association
    const activeMembersCount = await prisma.member.count({
      where: { 
        associationId: req.associationId,
        active: true 
      }
    });

    // Calculer le total des paiements
    const payments = await prisma.monthlyPayment.findMany({
      where: { yearId },
      include: { member: true }
    });

    const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalDue = year.monthlyAmount * 12 * activeMembersCount;
    const remaining = totalDue - totalPaid;
    const percentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

    // Compter les membres à jour (payé >= dû)
    const membersWithPayments = await prisma.member.findMany({
      where: { 
        associationId: req.associationId,
        active: true 
      },
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
