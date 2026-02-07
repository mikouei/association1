import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent authentification ADMIN
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/export/members
// Exporter les membres au format CSV
router.get('/members', async (req, res) => {
  try {
    const members = await req.prisma.user.findMany({
      where: { role: 'MEMBER' },
      include: { member: true },
      orderBy: { createdAt: 'asc' }
    });

    // Format CSV: Nom,Champ personnalisé,Téléphone,Actif
    let csv = 'Nom,Champ personnalisé,Téléphone,Actif\n';
    
    members.forEach(user => {
      if (user.member) {
        csv += `${user.member.name},${user.member.customFieldValue},${user.phone || ''},${user.active ? 'Oui' : 'Non'}\n`;
      }
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="membres.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export members error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

// GET /api/export/statistics/:yearId
// Exporter les statistiques d'une année
router.get('/statistics/:yearId', async (req, res) => {
  try {
    const { yearId } = req.params;

    const year = await req.prisma.year.findUnique({
      where: { id: yearId }
    });

    if (!year) {
      return res.status(404).json({ error: 'Année introuvable' });
    }

    const members = await req.prisma.member.findMany({
      where: { active: true },
      include: {
        user: true,
        payments: { where: { yearId } }
      },
      orderBy: { name: 'asc' }
    });

    // Format CSV: Nom,Champ personnalisé,Dû,Payé,Reste,%
    let csv = 'Nom,Champ personnalisé,Dû (FCFA),Payé (FCFA),Reste (FCFA),Pourcentage\n';
    
    members.forEach(member => {
      const totalPaid = member.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const totalDue = year.monthlyAmount * 12;
      const remaining = totalDue - totalPaid;
      const percentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100 * 100) / 100 : 0;

      csv += `${member.name},${member.customFieldValue},${totalDue},${totalPaid},${remaining},${percentage}%\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="statistiques_${year.year}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export statistics error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

export default router;
