// Liens de partage publics des documents (reçus, récap, appel de charges)
import express from 'express';
import crypto from 'crypto';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';
import { SHARE_GENERATORS } from '../utils/documents.js';

const router = express.Router();

const SHARE_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

// POST /api/share-links  { kind, targetId } -> { url, expiresAt } - ADMIN
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { kind, targetId } = req.body || {};
    if (!SHARE_GENERATORS[kind] || typeof targetId !== 'string' || !targetId) {
      return res.status(400).json({ error: 'Type de document ou cible invalide' });
    }

    // La cible doit appartenir à l'association de l'admin
    const target = kind === 'RECEIPT'
      ? await prisma.monthlyPayment.findFirst({ where: { id: targetId, member: { associationId: req.associationId } }, select: { id: true } })
      : await prisma.member.findFirst({ where: { id: targetId, associationId: req.associationId }, select: { id: true } });
    if (!target) {
      return res.status(404).json({ error: 'Document introuvable' });
    }

    const link = await prisma.shareLink.create({
      data: {
        token: crypto.randomBytes(32).toString('base64url'),
        associationId: req.associationId,
        kind,
        targetId,
        createdById: req.user.id,
        expiresAt: new Date(Date.now() + SHARE_LINK_TTL_MS),
      },
    });

    res.status(201).json({
      url: `${req.protocol}://${req.get('host')}/api/public/d/${link.token}`,
      expiresAt: link.expiresAt,
    });
  } catch (error) {
    console.error('Create share link error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du lien de partage' });
  }
});

export default router;
