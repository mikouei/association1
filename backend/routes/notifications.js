import express from 'express';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLog.js';
import {
  sendPushNotifications,
  sendToAssociationMembers,
  sendToSpecificMembers,
  sendPaymentReminder,
} from '../utils/pushNotifications.js';

const router = express.Router();

// Authentification requise pour toutes les routes
router.use(authenticateToken);

// ============================================
// GESTION DES TOKENS PUSH
// ============================================

/**
 * POST /api/notifications/register
 * Enregistrer un token push pour l'utilisateur connecté
 */
router.post('/register', async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token requis' });
    }

    // Vérifier le format du token Expo
    if (!token.startsWith('ExponentPushToken[')) {
      return res.status(400).json({ error: 'Format de token invalide' });
    }

    // Upsert le token (évite les doublons)
    await prisma.pushToken.upsert({
      where: {
        userId_token: {
          userId: req.user.id,
          token,
        },
      },
      update: {
        platform: platform || null,
        updatedAt: new Date(),
      },
      create: {
        userId: req.user.id,
        token,
        platform: platform || null,
      },
    });

    res.json({ success: true, message: 'Token enregistré' });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du token' });
  }
});

/**
 * DELETE /api/notifications/unregister
 * Supprimer un token push
 */
router.delete('/unregister', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requis' });
    }

    await prisma.pushToken.deleteMany({
      where: {
        userId: req.user.id,
        token,
      },
    });

    res.json({ success: true, message: 'Token supprimé' });
  } catch (error) {
    console.error('Unregister push token error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du token' });
  }
});

// ============================================
// ANNONCES (ADMIN ONLY)
// ============================================

/**
 * GET /api/notifications/announcements
 * Liste des annonces de l'association (historique)
 */
router.get('/announcements', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const announcements = await prisma.announcement.findMany({
      where: { associationId: req.associationId },
      include: {
        sender: {
          select: { id: true, email: true, member: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.announcement.count({
      where: { associationId: req.associationId },
    });

    // Formatter les résultats
    const formatted = announcements.map(a => ({
      id: a.id,
      title: a.title,
      body: a.body,
      type: a.type,
      targetType: a.targetType,
      targetCount: a.targetIds ? JSON.parse(a.targetIds).length : null,
      sentCount: a.sentCount,
      senderName: a.sender.member?.name || a.sender.email,
      createdAt: a.createdAt,
    }));

    res.json({ announcements: formatted, total });
  } catch (error) {
    console.error('List announcements error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des annonces' });
  }
});

/**
 * POST /api/notifications/announcements
 * Envoyer une nouvelle annonce
 */
router.post('/announcements', requireAdmin, async (req, res) => {
  try {
    // Vérifier si les annonces sont activées pour cette association
    const association = await prisma.association.findUnique({
      where: { id: req.associationId },
      select: { announcementsEnabled: true }
    });
    if (!association?.announcementsEnabled) {
      return res.status(403).json({ error: 'La fonctionnalité Annonces n\'est pas activée pour votre association. Contactez le support pour l\'activer.' });
    }

    const { title, body, targetType = 'all', targetIds = [] } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Titre et message requis' });
    }

    if (title.length > 100) {
      return res.status(400).json({ error: 'Titre trop long (max 100 caractères)' });
    }

    if (body.length > 500) {
      return res.status(400).json({ error: 'Message trop long (max 500 caractères)' });
    }

    // Valider targetType
    if (!['all', 'selected'].includes(targetType)) {
      return res.status(400).json({ error: 'Type de cible invalide' });
    }

    if (targetType === 'selected' && (!Array.isArray(targetIds) || targetIds.length === 0)) {
      return res.status(400).json({ error: 'Sélectionnez au moins un membre' });
    }

    let result;
    let sentToCount = 0;

    if (targetType === 'all') {
      // Envoyer à tous les membres
      result = await sendToAssociationMembers(
        prisma,
        req.associationId,
        title,
        body,
        { type: 'announcement' }
      );
      
      // Compter les membres actifs
      const memberCount = await prisma.user.count({
        where: { associationId: req.associationId, active: true },
      });
      sentToCount = memberCount;
    } else {
      // SÉCURITÉ IDOR: Vérifier que TOUS les IDs appartiennent à l'association de l'admin
      // D'abord essayer de trouver par User ID
      const members = await prisma.member.findMany({
        where: {
          OR: [
            { userId: { in: targetIds } },
            { id: { in: targetIds } },
          ],
          associationId: req.associationId, // Filtre association obligatoire
        },
        select: { userId: true },
      });

      // Si aucun membre trouvé ou moins que demandé → certains IDs sont invalides/hors association
      if (members.length === 0) {
        return res.status(400).json({ error: 'Aucun membre valide sélectionné' });
      }

      // Utiliser UNIQUEMENT les userIds validés (appartenant à l'association)
      const validUserIds = members.map(m => m.userId);

      result = await sendToSpecificMembers(
        prisma,
        validUserIds,
        title,
        body,
        { type: 'announcement' }
      );
      sentToCount = validUserIds.length;
    }

    // Sauvegarder l'annonce
    const announcement = await prisma.announcement.create({
      data: {
        associationId: req.associationId,
        senderId: req.user.id,
        title,
        body,
        type: 'general',
        targetType,
        targetIds: targetType === 'selected' ? JSON.stringify(targetIds) : null,
        sentCount: result.success,
      },
    });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'announcement.send',
      targetType: 'Announcement',
      targetId: announcement.id,
      details: `Annonce envoyée: "${title}" (${targetType === 'all' ? 'tous les membres' : `${targetIds.length} membres sélectionnés`})`,
    });

    res.status(201).json({
      success: true,
      announcement: {
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        targetType: announcement.targetType,
        sentCount: result.success,
        failedCount: result.failed,
      },
      pushResult: result,
    });
  } catch (error) {
    console.error('Send announcement error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'annonce' });
  }
});

/**
 * POST /api/notifications/reminder
 * Envoyer un rappel de cotisation aux membres en retard
 */
router.post('/reminder', requireAdmin, async (req, res) => {
  try {
    // Vérifier si les annonces sont activées pour cette association
    const association = await prisma.association.findUnique({
      where: { id: req.associationId },
      select: { announcementsEnabled: true }
    });
    if (!association?.announcementsEnabled) {
      return res.status(403).json({ error: 'La fonctionnalité Annonces n\'est pas activée pour votre association. Contactez le support pour l\'activer.' });
    }

    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: 'Mois et année requis' });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Mois invalide' });
    }

    const result = await sendPaymentReminder(prisma, req.associationId, monthNum, yearNum);

    if (result.errors && result.errors.length > 0 && result.success === 0) {
      return res.status(400).json({ error: result.errors[0] });
    }

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'reminder.send',
      targetType: 'PaymentReminder',
      details: `Rappel cotisation envoyé: ${monthNum}/${yearNum} (${result.targetedMembers || 0} membres ciblés)`,
    });

    // Sauvegarder comme annonce
    await prisma.announcement.create({
      data: {
        associationId: req.associationId,
        senderId: req.user.id,
        title: 'Rappel de cotisation',
        body: `Rappel pour le mois ${monthNum}/${yearNum}`,
        type: 'reminder',
        targetType: 'selected',
        sentCount: result.success,
      },
    });

    res.json({
      success: true,
      targetedMembers: result.targetedMembers || 0,
      pushResult: result,
    });
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du rappel' });
  }
});

/**
 * GET /api/notifications/stats
 * Statistiques des notifications (nombre de tokens enregistrés, etc.)
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Compter les tokens par plateforme
    const tokenStats = await prisma.pushToken.groupBy({
      by: ['platform'],
      where: {
        user: { associationId: req.associationId, active: true },
      },
      _count: true,
    });

    // Nombre total de tokens uniques
    const totalTokens = await prisma.pushToken.count({
      where: {
        user: { associationId: req.associationId, active: true },
      },
    });

    // Nombre d'utilisateurs avec au moins un token
    const usersWithTokens = await prisma.user.count({
      where: {
        associationId: req.associationId,
        active: true,
        pushTokens: { some: {} },
      },
    });

    // Nombre total d'utilisateurs actifs
    const totalActiveUsers = await prisma.user.count({
      where: { associationId: req.associationId, active: true },
    });

    // Dernières annonces
    const recentAnnouncements = await prisma.announcement.count({
      where: {
        associationId: req.associationId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 derniers jours
      },
    });

    res.json({
      totalTokens,
      usersWithTokens,
      totalActiveUsers,
      coverage: totalActiveUsers > 0 ? Math.round((usersWithTokens / totalActiveUsers) * 100) : 0,
      byPlatform: tokenStats.reduce((acc, s) => {
        acc[s.platform || 'unknown'] = s._count;
        return acc;
      }, {}),
      recentAnnouncements,
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

export default router;
