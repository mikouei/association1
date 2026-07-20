import express from 'express';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent authentification ADMIN
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/activity-log
// Récupérer le journal d'activité de l'association (paginé)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before; // Curseur pour pagination (createdAt ISO string)
    
    const where = {
      associationId: req.associationId
    };
    
    // Pagination par curseur
    if (before) {
      where.createdAt = {
        lt: new Date(before)
      };
    }
    
    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1 // +1 pour savoir s'il y a une page suivante
    });
    
    const hasMore = logs.length > limit;
    const results = hasMore ? logs.slice(0, limit) : logs;
    
    res.json({
      logs: results,
      hasMore,
      nextCursor: hasMore ? results[results.length - 1].createdAt.toISOString() : null
    });
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du journal' });
  }
});

export default router;
