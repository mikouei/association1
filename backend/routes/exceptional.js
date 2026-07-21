import express from 'express';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLog.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(authenticateToken);

const CONTRIBUTION_TYPES = ['décès', 'mariage', 'anniversaire', 'solidarité', 'autre'];

// Helper pour échapper le HTML (sécurité XSS)
const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// GET /api/exceptional/mine
// Mes cotisations exceptionnelles - ACCESSIBLE À TOUT UTILISATEUR CONNECTÉ
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const member = await prisma.member.findFirst({
      where: { 
        userId: req.user.id,
        associationId: req.associationId
      }
    });
    
    if (!member) {
      return res.status(404).json({ error: 'Aucun profil membre associé à ce compte' });
    }
    
    const contributions = await prisma.exceptionalContribution.findMany({
      where: { associationId: req.associationId },
      include: {
        payments: {
          where: { memberId: member.id }  // <-- uniquement SES propres paiements
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const formatted = contributions.map(contrib => {
      const myPayment = contrib.payments[0] || null;
      return {
        id: contrib.id,
        title: contrib.title,
        type: contrib.type,
        description: contrib.description,
        active: contrib.active,
        createdAt: contrib.createdAt,
        myAmountPaid: myPayment ? myPayment.amount : 0,
        myPaidAt: myPayment ? myPayment.createdAt : null,
      };
    });
    
    res.json(formatted);
  } catch (error) {
    console.error('List my exceptional contributions error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des cotisations' });
  }
});

// GET /api/exceptional
// Liste toutes les cotisations exceptionnelles de l'association - ADMIN ONLY
router.get('/', requireAdmin, async (req, res) => {
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

// GET /api/exceptional/stats
// Statistiques des cotisations exceptionnelles - ADMIN ONLY
// IMPORTANT: Cette route doit être AVANT /:id pour éviter le conflit
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const contributions = await prisma.exceptionalContribution.findMany({
      where: { 
        associationId: req.associationId 
      },
      include: {
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const stats = contributions.map(contrib => {
      const totalAmount = contrib.payments.reduce((sum, p) => sum + p.amount, 0);
      const participants = new Set(contrib.payments.map(p => p.memberId)).size;
      
      return {
        id: contrib.id,
        eventName: contrib.title,
        type: contrib.type,
        participants,
        totalAmount,
        active: contrib.active,
        createdAt: contrib.createdAt
      };
    });

    // Calculer les totaux globaux
    const totalEvents = contributions.length;
    const totalCollected = stats.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalParticipations = stats.reduce((sum, s) => sum + s.participants, 0);

    res.json({
      events: stats,
      summary: {
        totalEvents,
        totalCollected,
        totalParticipations
      }
    });
  } catch (error) {
    console.error('Get exceptional stats error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// Helper pour formater les nombres avec séparateurs de milliers
const formatNumber = (num) => {
  return new Intl.NumberFormat('fr-FR').format(Math.round(num));
};

// GET /api/exceptional/:eventId/stats/pdf
// Export PDF des statistiques d'un événement exceptionnel - ADMIN ONLY
router.get('/:eventId/stats/pdf', requireAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Récupérer l'événement avec ses paiements
    const contribution = await prisma.exceptionalContribution.findFirst({
      where: { 
        id: eventId,
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
      return res.status(404).json({ error: 'Événement introuvable' });
    }

    // Récupérer les infos de l'association
    const association = req.association;

    // Calculer les totaux
    const totalCollected = contribution.payments.reduce((sum, p) => sum + p.amount, 0);
    const participantsCount = new Set(contribution.payments.map(p => p.memberId)).size;

    // Mapper les types vers des icônes/couleurs
    const typeColors = {
      'décès': '#607D8B',
      'mariage': '#E91E63',
      'anniversaire': '#FF9800',
      'solidarité': '#4CAF50',
      'autre': '#9E9E9E'
    };
    const typeColor = typeColors[contribution.type] || '#2196F3';

    // Générer le HTML pour le PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(contribution.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid ${typeColor}; padding-bottom: 20px; }
    .header h1 { color: ${typeColor}; font-size: 28px; margin-bottom: 10px; }
    .header .type { 
      display: inline-block;
      background: ${typeColor}; 
      color: white; 
      padding: 4px 16px; 
      border-radius: 20px;
      font-size: 14px;
      text-transform: capitalize;
    }
    .header .date { color: #666; font-size: 14px; margin-top: 10px; }
    .description { 
      background: #f5f5f5; 
      padding: 15px; 
      border-radius: 8px; 
      margin-bottom: 20px;
      font-style: italic;
      color: #666;
    }
    .stats-row { 
      display: flex; 
      justify-content: center; 
      gap: 40px; 
      margin-bottom: 30px; 
    }
    .stat-box { 
      text-align: center; 
      padding: 20px 40px; 
      background: #E3F2FD; 
      border-radius: 12px; 
    }
    .stat-box.highlight { background: #E8F5E9; }
    .stat-value { font-size: 32px; font-weight: bold; color: #1976D2; }
    .stat-box.highlight .stat-value { color: #388E3C; }
    .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
    .section-title { 
      font-size: 18px; 
      font-weight: bold; 
      color: #333; 
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e0e0e0;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { 
      background: ${typeColor}; 
      color: white; 
      padding: 12px 8px; 
      text-align: left; 
      font-weight: 600; 
    }
    td { padding: 12px 8px; border-bottom: 1px solid #e0e0e0; }
    tr:nth-child(even) { background: #fafafa; }
    tr:hover { background: #f0f7ff; }
    .amount { font-weight: bold; color: #388E3C; text-align: right; }
    .date-col { color: #666; font-size: 13px; }
    .footer { 
      margin-top: 30px; 
      text-align: center; 
      color: #999; 
      font-size: 11px; 
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
    .no-payments { 
      text-align: center; 
      padding: 40px; 
      color: #999; 
      font-style: italic; 
    }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(contribution.title)}</h1>
    <span class="type">${escapeHtml(contribution.type)}</span>
    <div class="date">Créé le ${new Date(contribution.createdAt).toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })}</div>
  </div>
  
  ${contribution.description ? `<div class="description">${escapeHtml(contribution.description)}</div>` : ''}

  <div class="stats-row">
    <div class="stat-box highlight">
      <div class="stat-value">${formatNumber(totalCollected)}</div>
      <div class="stat-label">FCFA collectés</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${participantsCount}</div>
      <div class="stat-label">Participants</div>
    </div>
  </div>

  <div class="section-title">Liste des paiements</div>
  
  ${contribution.payments.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Membre</th>
          <th>Date</th>
          <th style="text-align: right;">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${contribution.payments.map(payment => `
          <tr>
            <td>${escapeHtml(payment.member?.name || 'Inconnu')}</td>
            <td class="date-col">${new Date(payment.paymentDate).toLocaleDateString('fr-FR')}</td>
            <td class="amount">${formatNumber(payment.amount)} FCFA</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<div class="no-payments">Aucun paiement enregistré</div>'}

  <div class="footer">
    <p>${escapeHtml(association?.name || 'Association')}</p>
    <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Export exceptional PDF error:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
  }
});

// GET /api/exceptional/:id
// Détail d'une cotisation exceptionnelle - ADMIN ONLY
router.get('/:id', requireAdmin, async (req, res) => {
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

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'exceptional.create',
      targetType: 'ExceptionalContribution',
      targetId: contribution.id,
      details: `Cotisation exceptionnelle créée: ${title} (${type})`
    });
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

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'exceptional.update',
      targetType: 'ExceptionalContribution',
      targetId: contribution.id,
      details: `Cotisation exceptionnelle modifiée: ${contribution.title}`
    });
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

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'exceptional.delete',
      targetType: 'ExceptionalContribution',
      targetId: id,
      details: `Cotisation exceptionnelle supprimée: ${existing.title}`
    });
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

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'exceptional_payment.create',
      targetType: 'ExceptionalPayment',
      targetId: payment.id,
      details: `Paiement exceptionnel créé: ${parseFloat(amount)} FCFA pour ${member.name} (${contribution.title})`
    });
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

    // Vérifier que le paiement appartient à l'association via la contribution ou le membre
    const existingPayment = await prisma.exceptionalPayment.findFirst({
      where: { id: paymentId },
      include: {
        contribution: true,
        member: true
      }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    // Vérifier l'appartenance à l'association (défense en profondeur: rejeter si l'un OU l'autre diffère)
    if (existingPayment.contribution?.associationId !== req.associationId || 
        existingPayment.member?.associationId !== req.associationId) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

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

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'exceptional_payment.update',
      targetType: 'ExceptionalPayment',
      targetId: payment.id,
      details: `Paiement exceptionnel modifié: ${payment.amount} FCFA pour ${existingPayment.member?.name || 'Inconnu'}`
    });
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

    // Vérifier que le paiement appartient à l'association via la contribution ou le membre
    const existingPayment = await prisma.exceptionalPayment.findFirst({
      where: { id: paymentId },
      include: {
        contribution: true,
        member: true
      }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    // Vérifier l'appartenance à l'association (défense en profondeur: rejeter si l'un OU l'autre diffère)
    if (existingPayment.contribution?.associationId !== req.associationId || 
        existingPayment.member?.associationId !== req.associationId) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    await prisma.exceptionalPayment.delete({
      where: { id: paymentId }
    });

    res.json({ message: 'Paiement supprimé avec succès' });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'exceptional_payment.delete',
      targetType: 'ExceptionalPayment',
      targetId: paymentId,
      details: `Paiement exceptionnel supprimé: ${existingPayment.amount} FCFA pour ${existingPayment.member?.name || 'Inconnu'} (${existingPayment.contribution?.title})`
    });
  } catch (error) {
    console.error('Delete exceptional payment error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

export default router;
