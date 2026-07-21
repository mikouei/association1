import express from 'express';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLog.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(authenticateToken);

// ============================================
// O.9 — Mes tontines (membre) - DOIT être AVANT les routes :id
// ============================================

// GET /api/tontines/mine
// Mes tontines - accessible à tout utilisateur connecté (pas requireAdmin)
router.get('/mine', async (req, res) => {
  try {
    // Trouver le membre associé à cet utilisateur
    const member = await prisma.member.findFirst({
      where: { 
        userId: req.user.id,
        associationId: req.associationId
      }
    });
    
    if (!member) {
      return res.status(404).json({ error: 'Aucun profil membre associé à ce compte' });
    }
    
    // Trouver toutes les participations de ce membre
    const participations = await prisma.tontineParticipant.findMany({
      where: { memberId: member.id },
      include: {
        tontine: {
          include: {
            rounds: {
              where: { status: 'open' },
              take: 1,
              include: {
                payments: {
                  where: { memberId: member.id },
                  take: 1
                }
              }
            }
          }
        }
      }
    });
    
    // Filtrer les tontines actives ou terminées (pas annulées)
    const activeTontines = participations
      .filter(p => p.tontine.status !== 'cancelled')
      .map(p => {
        const tontine = p.tontine;
        const currentOpenRound = tontine.rounds[0];
        const myPaymentThisRound = currentOpenRound?.payments[0];
        
        return {
          tontineId: tontine.id,
          name: tontine.name,
          amount: tontine.amount,
          frequency: tontine.frequency,
          status: tontine.status,
          currentRound: tontine.currentRound,
          myOrder: p.order,
          hasReceived: p.hasReceived,
          receivedRound: p.receivedRound,
          isMyTurnNow: currentOpenRound?.beneficiaryMemberId === member.id,
          currentRoundPaid: myPaymentThisRound?.isPaid || false
        };
      })
      .sort((a, b) => {
        // Tontines actives en premier, puis par nom
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.name.localeCompare(b.name);
      });
    
    res.json(activeTontines);
  } catch (error) {
    console.error('List my tontines error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des tontines' });
  }
});

// ============================================
// O.1 — Créer une tontine (ADMIN)
// ============================================

// POST /api/tontines
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, amount, frequency, memberIds } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Nom de la tontine requis' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Montant invalide (doit être supérieur à 0)' });
    }

    const validFrequencies = ['monthly', 'weekly'];
    if (frequency && !validFrequencies.includes(frequency)) {
      return res.status(400).json({ error: 'Fréquence invalide (monthly ou weekly)' });
    }

    if (!Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({ error: 'Au moins 2 participants requis' });
    }

    // Vérifier les doublons
    const uniqueMemberIds = [...new Set(memberIds)];
    if (uniqueMemberIds.length !== memberIds.length) {
      return res.status(400).json({ error: 'Doublons détectés dans la liste des participants' });
    }

    // Note: memberIds peut être soit des User IDs soit des Member IDs
    // D'abord essayer de trouver par User ID (plus commun dans l'API frontend)
    let validMembers = await prisma.member.findMany({
      where: {
        userId: { in: memberIds },
        associationId: req.associationId,
        active: true
      }
    });

    // Si aucun résultat, essayer par Member ID directement
    if (validMembers.length === 0) {
      validMembers = await prisma.member.findMany({
        where: {
          id: { in: memberIds },
          associationId: req.associationId,
          active: true
        }
      });
    }

    if (validMembers.length !== memberIds.length) {
      return res.status(400).json({ error: 'Certains membres sont invalides ou inactifs' });
    }

    // Mapper les User IDs vers les Member IDs réels dans l'ordre original
    const memberIdMapping = {};
    validMembers.forEach(m => {
      // Créer un mapping pour les deux types d'IDs
      memberIdMapping[m.userId] = m.id;
      memberIdMapping[m.id] = m.id;
    });

    // Convertir les IDs fournis en Member IDs réels, en préservant l'ordre
    const orderedMemberIds = memberIds.map(id => memberIdMapping[id]);

    // Créer la tontine en transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer la tontine
      const tontine = await tx.tontine.create({
        data: {
          associationId: req.associationId,
          name: name.trim(),
          amount: parsedAmount,
          frequency: frequency || 'monthly',
          status: 'active',
          currentRound: 1
        }
      });

      // 2. Créer les participants dans l'ordre
      const participants = await Promise.all(
        orderedMemberIds.map((memberId, index) => 
          tx.tontineParticipant.create({
            data: {
              tontineId: tontine.id,
              memberId,
              order: index + 1, // 1-indexé
              hasReceived: false
            }
          })
        )
      );

      // 3. Le bénéficiaire du premier tour est le membre à order: 1
      const firstBeneficiary = orderedMemberIds[0];

      // 4. Créer le premier round
      const round = await tx.tontineRound.create({
        data: {
          tontineId: tontine.id,
          roundNumber: 1,
          beneficiaryMemberId: firstBeneficiary,
          status: 'open'
        }
      });

      // 5. Pré-créer les paiements placeholder pour ce round
      await Promise.all(
        orderedMemberIds.map(memberId =>
          tx.tontinePayment.create({
            data: {
              roundId: round.id,
              memberId,
              amount: parsedAmount,
              isPaid: false
            }
          })
        )
      );

      return { tontine, participants, round };
    });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'tontine.create',
      targetType: 'Tontine',
      targetId: result.tontine.id,
      details: `Tontine créée: ${name} (${memberIds.length} participants, ${parsedAmount} par tour)`
    });

    // Récupérer la tontine complète avec les participants
    const tontineWithParticipants = await prisma.tontine.findUnique({
      where: { id: result.tontine.id },
      include: {
        participants: {
          include: {
            member: { select: { id: true, name: true } }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    res.status(201).json(tontineWithParticipants);
  } catch (error) {
    console.error('Create tontine error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la tontine' });
  }
});

// ============================================
// O.2 — Lister les tontines (ADMIN)
// ============================================

// GET /api/tontines
router.get('/', requireAdmin, async (req, res) => {
  try {
    const tontines = await prisma.tontine.findMany({
      where: { associationId: req.associationId },
      include: {
        participants: {
          include: {
            member: { select: { id: true, name: true } }
          },
          orderBy: { order: 'asc' }
        },
        rounds: {
          where: { status: 'open' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Formater la réponse avec le nom du bénéficiaire actuel
    const formatted = tontines.map(t => {
      const currentRound = t.rounds[0];
      const currentBeneficiary = currentRound 
        ? t.participants.find(p => p.memberId === currentRound.beneficiaryMemberId)
        : null;

      return {
        id: t.id,
        name: t.name,
        amount: t.amount,
        frequency: t.frequency,
        status: t.status,
        currentRound: t.currentRound,
        participantsCount: t.participants.length,
        currentBeneficiaryName: currentBeneficiary?.member?.name || null,
        createdAt: t.createdAt
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('List tontines error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des tontines' });
  }
});

// ============================================
// O.3 — Détail d'une tontine (ADMIN)
// ============================================

// GET /api/tontines/:id
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const tontine = await prisma.tontine.findFirst({
      where: { 
        id,
        associationId: req.associationId
      },
      include: {
        participants: {
          include: {
            member: { select: { id: true, name: true } }
          },
          orderBy: { order: 'asc' }
        },
        rounds: {
          include: {
            payments: {
              include: {
                member: { select: { id: true, name: true } }
              }
            }
          },
          orderBy: { roundNumber: 'asc' }
        }
      }
    });

    if (!tontine) {
      return res.status(404).json({ error: 'Tontine introuvable' });
    }

    res.json(tontine);
  } catch (error) {
    console.error('Get tontine error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la tontine' });
  }
});

// ============================================
// O.4 — Modifier une tontine (ADMIN)
// ============================================

// PUT /api/tontines/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, status } = req.body;

    // Vérifier que la tontine existe et appartient à l'association
    const existing = await prisma.tontine.findFirst({
      where: { 
        id,
        associationId: req.associationId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Tontine introuvable' });
    }

    const updateData = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Nom invalide' });
      }
      updateData.name = name.trim();
    }

    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Montant invalide' });
      }
      updateData.amount = parsedAmount;
    }

    if (status !== undefined) {
      const validStatuses = ['active', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
      }
      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Aucune modification fournie' });
    }

    const tontine = await prisma.tontine.update({
      where: { id },
      data: updateData
    });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'tontine.update',
      targetType: 'Tontine',
      targetId: tontine.id,
      details: `Tontine modifiée: ${tontine.name}`
    });

    res.json(tontine);
  } catch (error) {
    console.error('Update tontine error:', error);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// ============================================
// O.5 — Supprimer une tontine (ADMIN)
// ============================================

// DELETE /api/tontines/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.tontine.findFirst({
      where: { 
        id,
        associationId: req.associationId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Tontine introuvable' });
    }

    await prisma.tontine.delete({
      where: { id }
    });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'tontine.delete',
      targetType: 'Tontine',
      targetId: id,
      details: `Tontine supprimée: ${existing.name}`
    });

    res.json({ message: 'Tontine supprimée avec succès' });
  } catch (error) {
    console.error('Delete tontine error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ============================================
// O.6 — Enregistrer un paiement (ADMIN)
// ============================================

// POST /api/tontines/:id/payments
router.post('/:id/payments', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { memberId, amount } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'ID du membre requis' });
    }

    // Vérifier que la tontine existe
    const tontine = await prisma.tontine.findFirst({
      where: { 
        id,
        associationId: req.associationId
      }
    });

    if (!tontine) {
      return res.status(404).json({ error: 'Tontine introuvable' });
    }

    if (tontine.status !== 'active') {
      return res.status(400).json({ error: 'Cette tontine n\'est pas active' });
    }

    // Trouver le round ouvert
    const openRound = await prisma.tontineRound.findFirst({
      where: {
        tontineId: id,
        status: 'open'
      }
    });

    if (!openRound) {
      return res.status(400).json({ error: 'Aucun tour en cours' });
    }

    // Trouver le paiement placeholder
    const payment = await prisma.tontinePayment.findFirst({
      where: {
        roundId: openRound.id,
        memberId
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Ce membre ne participe pas à ce tour' });
    }

    if (payment.isPaid) {
      return res.status(400).json({ error: 'Ce paiement est déjà enregistré' });
    }

    // Mettre à jour le paiement
    const parsedAmount = amount !== undefined ? parseFloat(amount) : tontine.amount;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const updatedPayment = await prisma.tontinePayment.update({
      where: { id: payment.id },
      data: {
        isPaid: true,
        amount: parsedAmount,
        paidAt: new Date()
      },
      include: {
        member: { select: { id: true, name: true } }
      }
    });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'tontine.payment',
      targetType: 'TontinePayment',
      targetId: updatedPayment.id,
      details: `Paiement tontine: ${parsedAmount} de ${updatedPayment.member.name} (Tour ${openRound.roundNumber})`
    });

    res.json(updatedPayment);
  } catch (error) {
    console.error('Record tontine payment error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du paiement' });
  }
});

// ============================================
// O.7 — Annuler un paiement (ADMIN)
// ============================================

// DELETE /api/tontines/payments/:paymentId
router.delete('/payments/:paymentId', requireAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Vérifier que le paiement existe et appartient à l'association
    const payment = await prisma.tontinePayment.findFirst({
      where: { id: paymentId },
      include: {
        round: {
          include: {
            tontine: true
          }
        },
        member: { select: { id: true, name: true } }
      }
    });

    if (!payment || payment.round.tontine.associationId !== req.associationId) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    if (!payment.isPaid) {
      return res.status(400).json({ error: 'Ce paiement n\'est pas marqué comme payé' });
    }

    // Annuler le paiement (ne pas supprimer, juste remettre isPaid à false)
    await prisma.tontinePayment.update({
      where: { id: paymentId },
      data: {
        isPaid: false,
        paidAt: null
      }
    });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'tontine.payment_cancel',
      targetType: 'TontinePayment',
      targetId: paymentId,
      details: `Paiement tontine annulé: ${payment.member.name}`
    });

    res.json({ message: 'Paiement annulé' });
  } catch (error) {
    console.error('Cancel tontine payment error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation' });
  }
});

// ============================================
// O.8 — Clôturer le tour et passer au suivant (ADMIN)
// ============================================

// POST /api/tontines/:id/close-round
router.post('/:id/close-round', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const tontine = await prisma.tontine.findFirst({
      where: { 
        id,
        associationId: req.associationId
      },
      include: {
        participants: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!tontine) {
      return res.status(404).json({ error: 'Tontine introuvable' });
    }

    if (tontine.status !== 'active') {
      return res.status(400).json({ error: 'Cette tontine n\'est pas active' });
    }

    // Trouver le round ouvert
    const openRound = await prisma.tontineRound.findFirst({
      where: {
        tontineId: id,
        status: 'open'
      }
    });

    if (!openRound) {
      return res.status(400).json({ error: 'Aucun tour en cours à clôturer' });
    }

    // Exécuter en transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Clôturer le round actuel
      await tx.tontineRound.update({
        where: { id: openRound.id },
        data: {
          status: 'closed',
          closedAt: new Date()
        }
      });

      // 2. Marquer le bénéficiaire comme ayant reçu
      await tx.tontineParticipant.updateMany({
        where: {
          tontineId: id,
          memberId: openRound.beneficiaryMemberId
        },
        data: {
          hasReceived: true,
          receivedRound: openRound.roundNumber,
          receivedAt: new Date()
        }
      });

      // 3. Trouver le prochain participant qui n'a pas encore reçu
      const nextParticipant = tontine.participants.find(p => 
        !p.hasReceived && p.memberId !== openRound.beneficiaryMemberId
      );

      let updatedTontine;

      if (nextParticipant) {
        // 4a. Il reste des participants - créer un nouveau round
        const newRoundNumber = tontine.currentRound + 1;

        updatedTontine = await tx.tontine.update({
          where: { id },
          data: { currentRound: newRoundNumber }
        });

        const newRound = await tx.tontineRound.create({
          data: {
            tontineId: id,
            roundNumber: newRoundNumber,
            beneficiaryMemberId: nextParticipant.memberId,
            status: 'open'
          }
        });

        // Pré-créer les paiements pour ce nouveau round
        await Promise.all(
          tontine.participants.map(p =>
            tx.tontinePayment.create({
              data: {
                roundId: newRound.id,
                memberId: p.memberId,
                amount: tontine.amount,
                isPaid: false
              }
            })
          )
        );
      } else {
        // 4b. Tous ont reçu - terminer la tontine
        updatedTontine = await tx.tontine.update({
          where: { id },
          data: { status: 'completed' }
        });
      }

      return { tontine: updatedTontine, hasNextRound: !!nextParticipant };
    });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'tontine.close_round',
      targetType: 'Tontine',
      targetId: id,
      details: result.hasNextRound 
        ? `Tour ${openRound.roundNumber} clôturé, passage au tour ${tontine.currentRound + 1}`
        : `Tour ${openRound.roundNumber} clôturé, tontine terminée`
    });

    // Récupérer la tontine mise à jour (même forme que O.3)
    const fullTontine = await prisma.tontine.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            member: { select: { id: true, name: true } }
          },
          orderBy: { order: 'asc' }
        },
        rounds: {
          include: {
            payments: {
              include: {
                member: { select: { id: true, name: true } }
              }
            }
          },
          orderBy: { roundNumber: 'asc' }
        }
      }
    });

    res.json(fullTontine);
  } catch (error) {
    console.error('Close tontine round error:', error);
    res.status(500).json({ error: 'Erreur lors de la clôture du tour' });
  }
});

export default router;
