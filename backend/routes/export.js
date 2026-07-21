import express from 'express';
import { authenticateToken, requireAdmin, prisma } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent authentification ADMIN
router.use(authenticateToken);
router.use(requireAdmin);

// Helper pour formater les nombres
const formatNumber = (num) => {
  return new Intl.NumberFormat('fr-FR').format(Math.round(num));
};

// Helper pour échapper le HTML (sécurité XSS)
const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Helper pour protéger les valeurs CSV contre l'injection de formules
const escapeCsv = (value) => {
  let str = String(value ?? '');
  const needsQuote = /[",\r\n]/.test(str) || /^[=+\-@\t\r]/.test(str);
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  str = str.replace(/"/g, '""');
  return needsQuote ? `"${str}"` : str;
};

// GET /api/export/members
// Exporter les membres au format CSV
router.get('/members', async (req, res) => {
  try {
    const members = await prisma.user.findMany({
      where: { 
        associationId: req.associationId,
        role: 'MEMBER' 
      },
      include: { member: true },
      orderBy: { createdAt: 'asc' }
    });

    // Format CSV: Nom,Champ personnalisé,Téléphone,Actif
    let csv = 'Nom,Champ personnalisé,Téléphone,Actif\n';
    
    members.forEach(user => {
      if (user.member) {
        csv += `${escapeCsv(user.member.name)},${escapeCsv(user.member.customFieldValue)},${escapeCsv(user.phone || '')},${user.active ? 'Oui' : 'Non'}\n`;
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
// Exporter les statistiques d'une année (ancien endpoint, conservé pour compatibilité)
router.get('/statistics/:yearId', async (req, res) => {
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

    const members = await prisma.member.findMany({
      where: { 
        associationId: req.associationId,
        active: true 
      },
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

      csv += `${escapeCsv(member.name)},${escapeCsv(member.customFieldValue)},${totalDue},${totalPaid},${remaining},${percentage}%\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="statistiques_${year.year}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export statistics error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

// GET /api/export/stats/csv
// Export statistiques au format CSV (texte)
router.get('/stats/csv', async (req, res) => {
  try {
    // Trouver l'année active
    const activeYear = await prisma.year.findFirst({
      where: { 
        associationId: req.associationId,
        active: true
      }
    });

    if (!activeYear) {
      return res.status(404).json({ error: 'Aucune année active' });
    }

    const members = await prisma.member.findMany({
      where: { 
        associationId: req.associationId,
        active: true 
      },
      include: {
        user: true,
        payments: { where: { yearId: activeYear.id } }
      },
      orderBy: { name: 'asc' }
    });

    // Format TXT avec séparateurs
    let content = `STATISTIQUES DES COTISATIONS - ANNÉE ${activeYear.year}\n`;
    content += `Montant mensuel: ${formatNumber(activeYear.monthlyAmount)} FCFA\n`;
    content += `=`.repeat(80) + '\n\n';
    content += `Nom;Identifiant;Montant dû;Montant payé;Reste;Pourcentage\n`;
    content += `-`.repeat(80) + '\n';

    let totalDueAll = 0;
    let totalPaidAll = 0;
    
    members.forEach(member => {
      const totalPaid = member.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const totalDue = activeYear.monthlyAmount * 12;
      const remaining = totalDue - totalPaid;
      const percentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

      totalDueAll += totalDue;
      totalPaidAll += totalPaid;

      // SÉCURITÉ: Appliquer escapeCsv sur les champs texte pour éviter l'injection CSV
      content += `${escapeCsv(member.name)};${escapeCsv(member.customFieldValue)};${formatNumber(totalDue)} FCFA;${formatNumber(totalPaid)} FCFA;${formatNumber(remaining)} FCFA;${percentage}%\n`;
    });

    content += `-`.repeat(80) + '\n';
    const totalPercentage = totalDueAll > 0 ? Math.round((totalPaidAll / totalDueAll) * 100) : 0;
    content += `TOTAL;;${formatNumber(totalDueAll)} FCFA;${formatNumber(totalPaidAll)} FCFA;${formatNumber(totalDueAll - totalPaidAll)} FCFA;${totalPercentage}%\n`;
    content += `\nGénéré le ${new Date().toLocaleDateString('fr-FR')}\n`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="statistiques_${activeYear.year}.txt"`);
    res.send(content);
  } catch (error) {
    console.error('Export stats CSV error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export CSV' });
  }
});

// GET /api/export/stats/pdf
// Export statistiques au format PDF (HTML pour génération côté client)
router.get('/stats/pdf', async (req, res) => {
  try {
    // Trouver l'année active
    const activeYear = await prisma.year.findFirst({
      where: { 
        associationId: req.associationId,
        active: true
      }
    });

    if (!activeYear) {
      return res.status(404).json({ error: 'Aucune année active' });
    }

    // Récupérer la config de l'association
    const association = req.association;

    const members = await prisma.member.findMany({
      where: { 
        associationId: req.associationId,
        active: true 
      },
      include: {
        user: true,
        payments: { where: { yearId: activeYear.id } }
      },
      orderBy: { name: 'asc' }
    });

    // Calculer les totaux
    let totalDueAll = 0;
    let totalPaidAll = 0;

    const membersData = members.map(member => {
      const totalPaid = member.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const totalDue = activeYear.monthlyAmount * 12;
      const remaining = totalDue - totalPaid;
      const percentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

      totalDueAll += totalDue;
      totalPaidAll += totalPaid;

      return {
        name: member.name,
        identifier: member.customFieldValue,
        due: totalDue,
        paid: totalPaid,
        remaining,
        percentage
      };
    });

    const totalPercentage = totalDueAll > 0 ? Math.round((totalPaidAll / totalDueAll) * 100) : 0;

    // Générer le HTML pour le PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Statistiques ${activeYear.year}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2196F3; padding-bottom: 20px; }
    .header h1 { color: #2196F3; font-size: 28px; margin-bottom: 10px; }
    .header h2 { color: #666; font-size: 18px; font-weight: normal; }
    .info { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
    .info p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th { background: #2196F3; color: white; padding: 12px 8px; text-align: left; font-weight: 600; }
    td { padding: 10px 8px; border-bottom: 1px solid #e0e0e0; }
    tr:nth-child(even) { background: #fafafa; }
    tr:hover { background: #f0f7ff; }
    .text-right { text-align: right; }
    .paid-100 { color: #4CAF50; font-weight: bold; }
    .paid-partial { color: #FF9800; font-weight: bold; }
    .paid-zero { color: #f44336; font-weight: bold; }
    .total-row { background: #e3f2fd !important; font-weight: bold; }
    .total-row td { border-top: 2px solid #2196F3; }
    .footer { margin-top: 30px; text-align: center; color: #999; font-size: 11px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(association?.name || 'Association')}</h1>
    <h2>Statistiques des cotisations - Année ${activeYear.year}</h2>
  </div>
  
  <div class="info">
    <p><strong>Montant mensuel:</strong> ${formatNumber(activeYear.monthlyAmount)} FCFA</p>
    <p><strong>Montant annuel:</strong> ${formatNumber(activeYear.monthlyAmount * 12)} FCFA</p>
    <p><strong>Nombre de membres:</strong> ${members.length}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Identifiant</th>
        <th class="text-right">Montant dû</th>
        <th class="text-right">Montant payé</th>
        <th class="text-right">Reste</th>
        <th class="text-right">%</th>
      </tr>
    </thead>
    <tbody>
      ${membersData.map(m => {
        const statusClass = m.percentage >= 100 ? 'paid-100' : m.percentage > 0 ? 'paid-partial' : 'paid-zero';
        return `
          <tr>
            <td>${escapeHtml(m.name)}</td>
            <td>${escapeHtml(m.identifier)}</td>
            <td class="text-right">${formatNumber(m.due)} FCFA</td>
            <td class="text-right ${statusClass}">${formatNumber(m.paid)} FCFA</td>
            <td class="text-right">${formatNumber(m.remaining)} FCFA</td>
            <td class="text-right ${statusClass}">${m.percentage}%</td>
          </tr>
        `;
      }).join('')}
      <tr class="total-row">
        <td colspan="2"><strong>TOTAL</strong></td>
        <td class="text-right">${formatNumber(totalDueAll)} FCFA</td>
        <td class="text-right">${formatNumber(totalPaidAll)} FCFA</td>
        <td class="text-right">${formatNumber(totalDueAll - totalPaidAll)} FCFA</td>
        <td class="text-right">${totalPercentage}%</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Export stats PDF error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export PDF' });
  }
});

export default router;
