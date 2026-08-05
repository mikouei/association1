import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireAdmin, requireRole, generateAccessToken, prisma } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLog.js';
import { checkMemberLimit } from '../utils/planLimits.js';

const router = express.Router();

// Authentification requise pour toutes les routes
router.use(authenticateToken);

// Désactiver le cache HTTP pour toutes les routes members
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
});

// GET /api/members
// Liste tous les membres de l'association (avec recherche) - ADMIN ONLY
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { search, active } = req.query;

    const where = {
      associationId: req.associationId,
      role: 'MEMBER'
    };

    // Filtre actif/inactif
    if (active !== undefined) {
      where.active = active === 'true';
    }

    // Recherche par nom ou champ personnalisé
    if (search) {
      where.OR = [
        { member: { name: { contains: search, mode: 'insensitive' } } },
        { member: { customFieldValue: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Requête avec fresh data
    const members = await prisma.user.findMany({
      where,
      include: {
        member: true
      },
      orderBy: { createdAt: 'desc' },
      take: 1000
    });

    // Formatter les résultats avec accès sécurisé aux propriétés
    const formatted = members.map(user => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      active: user.active,
      token: req.user.role === 'ADMIN' ? user.token : undefined,
      name: user.member?.name || null,
      customFieldValue: user.member?.customFieldValue || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.json(formatted);
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des membres' });
  }
});

// POST /api/members
// Créer un nouveau membre (ADMIN uniquement)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, customFieldValue, email, phone, password } = req.body;

    if (!name || !customFieldValue) {
      return res.status(400).json({ error: 'Nom et champ personnalisé requis' });
    }

    if (!email && !phone) {
      return res.status(400).json({ error: 'Email ou téléphone requis' });
    }

    // Valider le format de l'email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Format email invalide' });
    }

    // Vérifier unicité email dans l'association
    if (email) {
      const existing = await prisma.user.findFirst({ 
        where: { 
          associationId: req.associationId,
          email 
        } 
      });
      if (existing) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }
    }

    // Vérifier unicité téléphone dans l'association
    if (phone) {
      const existingPhone = await prisma.user.findFirst({
        where: { associationId: req.associationId, phone }
      });
      if (existingPhone) {
        return res.status(400).json({ error: 'Ce téléphone est déjà utilisé' });
      }
    }

    // Vérifier le plafond de membres selon le plan
    const association = await prisma.association.findUnique({
      where: { id: req.associationId },
      select: { plan: true, createdAt: true, launchPeriodMonths: true }
    });
    const memberCount = await prisma.user.count({
      where: { associationId: req.associationId, role: 'MEMBER' }
    });
    const limitCheck = checkMemberLimit(association, memberCount, 1);
    if (!limitCheck.canAdd) {
      return res.status(403).json({ error: limitCheck.message });
    }

    // Valider la longueur du mot de passe si fourni
    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe trop court (minimum 8 caractères)' });
    }

    // Générer un mot de passe aléatoire si non fourni
    const finalPassword = password || crypto.randomBytes(6).toString('base64url');
    const passwordHash = await bcrypt.hash(finalPassword, 10);

    // Générer un token d'accès unique
    let accessToken = generateAccessToken();
    let tokenExists = true;
    
    // S'assurer que le token est unique
    while (tokenExists) {
      const existing = await prisma.user.findFirst({ where: { token: accessToken } });
      if (!existing) tokenExists = false;
      else accessToken = generateAccessToken();
    }

    // Créer l'utilisateur et le membre en transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          associationId: req.associationId,
          email: email || `member_${Date.now()}@temp.local`,
          phone: phone || null,
          passwordHash,
          passwordChangedAt: new Date(),
          role: 'MEMBER',
          token: accessToken,
          active: true
        }
      });

      const member = await tx.member.create({
        data: {
          associationId: req.associationId,
          userId: user.id,
          name,
          customFieldValue,
          active: true,
          qrCode: uuidv4(), // Génération du QR code unique
          qrGeneratedAt: new Date()
        }
      });

      return { user, member };
    });

    res.status(201).json({
      id: result.user.id,
      email: result.user.email,
      phone: result.user.phone,
      token: result.user.token,
      password: finalPassword, // Retourner le password généré
      name: result.member.name,
      customFieldValue: result.member.customFieldValue,
      active: result.user.active
    });

    // Log de l'activité (après réponse pour ne pas bloquer)
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'member.create',
      targetType: 'Member',
      targetId: result.member.id,
      details: `Nouveau membre créé: ${result.member.name}`
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du membre' });
  }
});

// GET /api/members/:id
// Récupérer un membre spécifique - ADMIN ONLY
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { 
        id, 
        role: 'MEMBER',
        associationId: req.associationId
      },
      include: { member: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Membre introuvable' });
    }

    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      active: user.active,
      token: req.user.role === 'ADMIN' ? user.token : undefined,
      name: user.member?.name,
      customFieldValue: user.member?.customFieldValue,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du membre' });
  }
});

// PUT /api/members/:id
// Modifier un membre (ADMIN uniquement)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, customFieldValue, email, phone } = req.body;

    // Vérifier que le membre existe dans l'association
    const existing = await prisma.user.findFirst({
      where: { 
        id, 
        role: 'MEMBER',
        associationId: req.associationId
      },
      include: { member: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Membre introuvable' });
    }

    // Vérifier unicité email si changé
    if (email && email !== existing.email) {
      const emailExists = await prisma.user.findFirst({ 
        where: { 
          email,
          associationId: req.associationId
        } 
      });
      if (emailExists) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }
    }

    // Vérifier unicité téléphone si changé
    if (phone && phone !== existing.phone) {
      const phoneExists = await prisma.user.findFirst({
        where: { phone, associationId: req.associationId }
      });
      if (phoneExists) {
        return res.status(400).json({ error: 'Ce téléphone est déjà utilisé' });
      }
    }

    // Mettre à jour en transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          email: email || existing.email,
          phone: phone !== undefined ? phone : existing.phone
        }
      });

      const member = await tx.member.update({
        where: { userId: id },
        data: {
          name: name || existing.member.name,
          customFieldValue: customFieldValue || existing.member.customFieldValue
        }
      });

      return { user, member };
    });

    res.json({
      id: result.user.id,
      email: result.user.email,
      phone: result.user.phone,
      active: result.user.active,
      token: result.user.token,
      name: result.member.name,
      customFieldValue: result.member.customFieldValue
    });

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'member.update',
      targetType: 'Member',
      targetId: result.member.id,
      details: `Membre modifié: ${result.member.name}`
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du membre' });
  }
});

// PUT /api/members/:id/deactivate
// Désactiver un membre (ADMIN uniquement)
router.put('/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le membre pour le log
    const memberData = await prisma.user.findFirst({
      where: { id, role: 'MEMBER', associationId: req.associationId },
      include: { member: true }
    });

    await prisma.user.updateMany({
      where: { 
        id, 
        role: 'MEMBER',
        associationId: req.associationId
      },
      data: { active: false }
    });

    res.json({ message: 'Membre désactivé avec succès' });

    // Log de l'activité
    if (memberData) {
      logActivity({
        associationId: req.associationId,
        userId: req.user.id,
        userName: req.user.member?.name || req.user.email || 'Admin',
        action: 'member.deactivate',
        targetType: 'Member',
        targetId: memberData.member?.id,
        details: `Membre désactivé: ${memberData.member?.name || 'Inconnu'}`
      });
    }
  } catch (error) {
    console.error('Deactivate member error:', error);
    res.status(500).json({ error: 'Erreur lors de la désactivation du membre' });
  }
});

// PUT /api/members/:id/activate
// Réactiver un membre (ADMIN uniquement)
router.put('/:id/activate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le membre pour le log
    const memberData = await prisma.user.findFirst({
      where: { id, role: 'MEMBER', associationId: req.associationId },
      include: { member: true }
    });

    await prisma.user.updateMany({
      where: { 
        id, 
        role: 'MEMBER',
        associationId: req.associationId
      },
      data: { active: true }
    });

    res.json({ message: 'Membre réactivé avec succès' });

    // Log de l'activité
    if (memberData) {
      logActivity({
        associationId: req.associationId,
        userId: req.user.id,
        userName: req.user.member?.name || req.user.email || 'Admin',
        action: 'member.activate',
        targetType: 'Member',
        targetId: memberData.member?.id,
        details: `Membre réactivé: ${memberData.member?.name || 'Inconnu'}`
      });
    }
  } catch (error) {
    console.error('Activate member error:', error);
    res.status(500).json({ error: 'Erreur lors de la réactivation du membre' });
  }
});

// POST /api/members/:id/reset-password
// Réinitialiser le mot de passe d'un membre (ADMIN uniquement)
router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Mot de passe trop court (minimum 8 caractères)' });
    }

    // Récupérer le membre pour le log
    const memberData = await prisma.user.findFirst({
      where: { id, role: 'MEMBER', associationId: req.associationId },
      include: { member: true }
    });

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.updateMany({
      where: { 
        id, 
        role: 'MEMBER',
        associationId: req.associationId
      },
      data: { 
        passwordHash, 
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    res.json({ message: 'Mot de passe réinitialisé', newPassword });

    // Log de l'activité
    if (memberData) {
      logActivity({
        associationId: req.associationId,
        userId: req.user.id,
        userName: req.user.member?.name || req.user.email || 'Admin',
        action: 'member.reset_password',
        targetType: 'Member',
        targetId: memberData.member?.id,
        details: `Mot de passe réinitialisé pour: ${memberData.member?.name || 'Inconnu'}`
      });
    }
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

// POST /api/members/:id/regenerate-token
// Régénérer le token d'accès d'un membre (ADMIN uniquement)
router.post('/:id/regenerate-token', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Générer un nouveau token unique
    let accessToken = generateAccessToken();
    let tokenExists = true;
    
    while (tokenExists) {
      const existing = await prisma.user.findFirst({ where: { token: accessToken } });
      if (!existing) tokenExists = false;
      else accessToken = generateAccessToken();
    }

    await prisma.user.updateMany({
      where: { 
        id, 
        role: 'MEMBER',
        associationId: req.associationId
      },
      data: { token: accessToken }
    });

    res.json({ message: 'Token régénéré', token: accessToken });
  } catch (error) {
    console.error('Regenerate token error:', error);
    res.status(500).json({ error: 'Erreur lors de la régénération du token' });
  }
});

// DELETE /api/members/:id
// Supprimer un membre et son compte utilisateur
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Trouver le membre via son userId dans l'association
    const user = await prisma.user.findFirst({
      where: { 
        id,
        associationId: req.associationId
      },
      include: { member: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    // Supprimer dans une transaction : paiements → membre → utilisateur
    await prisma.$transaction(async (tx) => {
      if (user.member) {
        // Supprimer les paiements mensuels du membre
        await tx.monthlyPayment.deleteMany({
          where: { memberId: user.member.id }
        });

        // Supprimer les paiements exceptionnels du membre
        await tx.exceptionalPayment.deleteMany({
          where: { memberId: user.member.id }
        });

        // Supprimer les véhicules du membre
        await tx.vehiclePlate.deleteMany({
          where: { memberId: user.member.id }
        });

        // Supprimer le membre
        await tx.member.delete({
          where: { id: user.member.id }
        });
      }

      // Supprimer l'utilisateur
      await tx.user.delete({
        where: { id }
      });
    });

    res.json({ message: 'Membre supprimé avec succès' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du membre' });
  }
});

// DELETE /api/members/bulk-delete
// Suppression multiple de membres (ADMIN uniquement)
router.delete('/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Liste des IDs requise' });
    }

    // Récupérer tous les utilisateurs à supprimer
    const users = await prisma.user.findMany({
      where: { 
        id: { in: ids },
        associationId: req.associationId,
        role: 'MEMBER'
      },
      include: { member: true }
    });

    if (users.length === 0) {
      return res.status(404).json({ error: 'Aucun membre trouvé' });
    }

    // Supprimer en transaction
    await prisma.$transaction(async (tx) => {
      for (const user of users) {
        if (user.member) {
          // Supprimer les paiements mensuels
          await tx.monthlyPayment.deleteMany({
            where: { memberId: user.member.id }
          });

          // Supprimer les paiements exceptionnels
          await tx.exceptionalPayment.deleteMany({
            where: { memberId: user.member.id }
          });

          // Supprimer les véhicules
          await tx.vehiclePlate.deleteMany({
            where: { memberId: user.member.id }
          });

          // Supprimer le membre
          await tx.member.delete({
            where: { id: user.member.id }
          });
        }

        // Supprimer l'utilisateur
        await tx.user.delete({
          where: { id: user.id }
        });
      }
    });

    res.json({ 
      message: `${users.length} membre(s) supprimé(s) avec succès`,
      deletedCount: users.length
    });
  } catch (error) {
    console.error('Bulk delete members error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression des membres' });
  }
});

// GET /api/members/:id/export-pdf
// Exporter le résumé des paiements d'un membre en PDF
router.get('/:id/export-pdf', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { year } = req.query; // Optionnel: filtrer par année

    // Récupérer le membre
    const user = await prisma.user.findFirst({
      where: {
        id,
        associationId: req.associationId,
        role: 'MEMBER'
      },
      include: {
        member: true
      }
    });

    if (!user || !user.member) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    // Récupérer l'association
    const association = await prisma.association.findUnique({
      where: { id: req.associationId }
    });

    // Récupérer les années avec paiements
    const yearsQuery = year 
      ? { year: parseInt(year) }
      : {};

    const years = await prisma.year.findMany({
      where: {
        associationId: req.associationId,
        ...yearsQuery
      },
      orderBy: { year: 'desc' }
    });

    // Récupérer les paiements mensuels via les années de l'association
    const yearIds = years.map(y => y.id);
    const monthlyPayments = await prisma.monthlyPayment.findMany({
      where: {
        memberId: user.member.id,
        yearId: { in: yearIds }
      },
      include: {
        year: true
      },
      orderBy: { month: 'asc' }
    });

    // Récupérer les cotisations exceptionnelles avec paiements
    const exceptionalContributions = await prisma.exceptionalContribution.findMany({
      where: {
        associationId: req.associationId,
        active: true
      },
      include: {
        payments: {
          where: { memberId: user.member.id }
        }
      }
    });

    // Générer le PDF
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Headers pour le téléchargement
    const fileName = `releve-${user.member.name.replace(/\s+/g, '_')}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    doc.pipe(res);

    // === EN-TÊTE ===
    doc.fontSize(20).font('Helvetica-Bold')
       .text(association.name, { align: 'center' });
    doc.fontSize(12).font('Helvetica')
       .text('Relevé des paiements', { align: 'center' });
    doc.moveDown();

    // Infos membre
    doc.fontSize(11).font('Helvetica-Bold')
       .text('Membre: ', { continued: true })
       .font('Helvetica')
       .text(user.member.name);
    
    if (user.member.customFieldValue) {
      doc.font('Helvetica-Bold')
         .text(`${association.memberFieldLabel || 'Info'}: `, { continued: true })
         .font('Helvetica')
         .text(user.member.customFieldValue);
    }
    
    if (user.phone) {
      doc.font('Helvetica-Bold')
         .text('Téléphone: ', { continued: true })
         .font('Helvetica')
         .text(user.phone);
    }

    doc.font('Helvetica-Bold')
       .text('Date: ', { continued: true })
       .font('Helvetica')
       .text(new Date().toLocaleDateString('fr-FR'));
    
    doc.moveDown(2);

    // === PAIEMENTS MENSUELS ===
    doc.fontSize(14).font('Helvetica-Bold')
       .text('Cotisations Mensuelles', { underline: true });
    doc.moveDown(0.5);

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    let totalMonthlyPaid = 0;
    let totalMonthlyDue = 0;

    for (const yearData of years) {
      const yearPayments = monthlyPayments.filter(p => p.yearId === yearData.id);
      const paidMonths = yearPayments.filter(p => p.amountPaid > 0).length;
      const yearPaid = yearPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const yearDue = 12 * yearData.monthlyAmount;
      
      totalMonthlyPaid += yearPaid;
      totalMonthlyDue += yearDue;

      doc.fontSize(11).font('Helvetica-Bold')
         .text(`Année ${yearData.year} - ${yearData.monthlyAmount.toLocaleString('fr-FR')} FCFA/mois`);
      
      // Tableau des mois
      let monthLine = '';
      for (let m = 1; m <= 12; m++) {
        const payment = yearPayments.find(p => p.month === m);
        const status = payment && payment.amountPaid > 0 ? '✓' : '○';
        monthLine += `${monthNames[m-1]}:${status}  `;
        if (m === 6) {
          doc.fontSize(9).font('Helvetica').text(monthLine.trim());
          monthLine = '';
        }
      }
      if (monthLine) {
        doc.fontSize(9).font('Helvetica').text(monthLine.trim());
      }
      
      doc.fontSize(10).font('Helvetica')
         .text(`Payé: ${yearPaid.toLocaleString('fr-FR')} / ${yearDue.toLocaleString('fr-FR')} FCFA (${paidMonths}/12 mois)`);
      doc.moveDown(0.5);
    }

    // Total mensuels
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold')
       .text(`Total cotisations mensuelles: ${totalMonthlyPaid.toLocaleString('fr-FR')} FCFA payés`);
    
    doc.moveDown(2);

    // === COTISATIONS EXCEPTIONNELLES ===
    if (exceptionalContributions.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold')
         .text('Cotisations Exceptionnelles', { underline: true });
      doc.moveDown(0.5);

      let totalExceptionalPaid = 0;

      for (const contrib of exceptionalContributions) {
        const payment = contrib.payments[0];
        const amountPaid = payment?.amount || 0;
        totalExceptionalPaid += amountPaid;
        
        const status = amountPaid >= contrib.amount ? '✓ Complet' 
                     : amountPaid > 0 ? `◐ Partiel (${amountPaid.toLocaleString('fr-FR')})` 
                     : '○ Non payé';

        doc.fontSize(10).font('Helvetica-Bold')
           .text(`${contrib.title}: `, { continued: true })
           .font('Helvetica')
           .text(`${contrib.amount.toLocaleString('fr-FR')} FCFA - ${status}`);
      }

      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold')
         .text(`Total exceptionnelles: ${totalExceptionalPaid.toLocaleString('fr-FR')} FCFA payés`);
      
      doc.moveDown(2);
    }

    // === TOTAL GÉNÉRAL ===
    const grandTotal = totalMonthlyPaid + exceptionalContributions.reduce((sum, c) => 
      sum + (c.payments[0]?.amount || 0), 0);

    doc.fontSize(12).font('Helvetica-Bold')
       .text(`═══════════════════════════════════`);
    doc.fontSize(14).font('Helvetica-Bold')
       .text(`TOTAL GÉNÉRAL: ${grandTotal.toLocaleString('fr-FR')} FCFA`);
    doc.fontSize(12).font('Helvetica-Bold')
       .text(`═══════════════════════════════════`);

    // Pied de page
    doc.moveDown(3);
    doc.fontSize(8).font('Helvetica')
       .fillColor('#666666')
       .text(`Document généré le ${new Date().toLocaleString('fr-FR')} via Kotiz`, { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
  }
});

// POST /api/members/link-admin
// Attacher un profil Membre à un compte ADMIN déjà existant (au lieu de créer un second compte)
router.post('/link-admin', requireAdmin, async (req, res) => {
  try {
    const { adminUserId, name, customFieldValue } = req.body;

    if (!adminUserId || !name) {
      return res.status(400).json({ error: 'Administrateur et nom requis' });
    }

    const adminUser = await prisma.user.findFirst({
      where: {
        id: adminUserId,
        associationId: req.associationId,
        role: 'ADMIN'
      },
      include: { member: true }
    });

    if (!adminUser) {
      return res.status(404).json({ error: 'Administrateur introuvable' });
    }

    if (adminUser.member) {
      return res.status(400).json({ error: 'Cet administrateur a déjà un profil membre' });
    }

    const member = await prisma.member.create({
      data: {
        associationId: req.associationId,
        userId: adminUser.id,
        name,
        customFieldValue: customFieldValue || null,
        active: true
      }
    });

    res.status(201).json(member);

    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'member.link_admin',
      targetType: 'Member',
      targetId: member.id,
      details: `Profil membre créé pour l'administrateur existant: ${name}`
    });
  } catch (error) {
    console.error('Link admin as member error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du profil membre' });
  }
});

// ============================================
// CARTE MEMBRE QR CODE
// ============================================

// POST /api/members/verify-qr
// Vérifier un membre par QR code - ADMIN et SCANNER uniquement
router.post('/verify-qr', requireRole(['ADMIN', 'SCANNER']), async (req, res) => {
  try {
    const { qrCode } = req.body;

    if (!qrCode) {
      return res.status(400).json({ error: 'Code QR requis' });
    }

    // Chercher le membre par son QR code, uniquement dans l'association de l'admin
    const member = await prisma.member.findFirst({
      where: {
        qrCode,
        associationId: req.associationId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            active: true
          }
        }
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Membre non trouvé ou QR code invalide' });
    }

    // Vérifier le statut de cotisation du mois en cours
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Trouver l'année active
    const activeYear = await prisma.year.findFirst({
      where: {
        associationId: req.associationId,
        active: true
      }
    });

    let cotisationStatus = 'unknown';
    let cotisationMessage = 'Aucune année de cotisation active';
    let monthlyAmount = 0;
    let paidAmount = 0;

    if (activeYear && activeYear.year === currentYear) {
      monthlyAmount = activeYear.monthlyAmount;
      
      // Chercher le paiement du mois en cours
      const payment = await prisma.monthlyPayment.findFirst({
        where: {
          memberId: member.id,
          yearId: activeYear.id,
          month: currentMonth
        }
      });

      if (payment) {
        paidAmount = payment.amountPaid;
        if (payment.amountPaid >= activeYear.monthlyAmount) {
          cotisationStatus = 'paid';
          cotisationMessage = `À jour pour ${getMonthName(currentMonth)} ${currentYear}`;
        } else {
          cotisationStatus = 'partial';
          cotisationMessage = `Paiement partiel pour ${getMonthName(currentMonth)} ${currentYear}`;
        }
      } else {
        cotisationStatus = 'unpaid';
        cotisationMessage = `En retard pour ${getMonthName(currentMonth)} ${currentYear}`;
      }
    }

    // Log de l'activité
    logActivity({
      associationId: req.associationId,
      userId: req.user.id,
      userName: req.user.member?.name || req.user.email || 'Admin',
      action: 'member.qr_verify',
      targetType: 'Member',
      targetId: member.id,
      details: `Vérification QR: ${member.name} - ${cotisationStatus}`
    });

    res.json({
      id: member.id,
      userId: member.userId,
      name: member.name,
      customFieldValue: member.customFieldValue,
      active: member.active && member.user.active,
      phone: member.user.phone,
      cotisation: {
        status: cotisationStatus,
        message: cotisationMessage,
        monthlyAmount,
        paidAmount,
        month: currentMonth,
        year: currentYear
      },
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Verify QR error:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

// GET /api/members/my-qr
// Obtenir son propre QR code (MEMBRE uniquement)
router.get('/my-qr', async (req, res) => {
  try {
    // Cette route est accessible par tous les utilisateurs authentifiés
    const member = await prisma.member.findFirst({
      where: {
        userId: req.user.id,
        associationId: req.associationId
      },
      select: {
        id: true,
        name: true,
        customFieldValue: true,
        qrCode: true,
        qrGeneratedAt: true
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Profil membre non trouvé' });
    }

    // Générer le QR code si absent (pour les membres existants)
    if (!member.qrCode) {
      const updatedMember = await prisma.member.update({
        where: { id: member.id },
        data: {
          qrCode: uuidv4(),
          qrGeneratedAt: new Date()
        },
        select: {
          qrCode: true,
          qrGeneratedAt: true
        }
      });
      member.qrCode = updatedMember.qrCode;
      member.qrGeneratedAt = updatedMember.qrGeneratedAt;
    }

    res.json({
      name: member.name,
      customFieldValue: member.customFieldValue,
      qrCode: member.qrCode,
      qrGeneratedAt: member.qrGeneratedAt
    });
  } catch (error) {
    console.error('Get my QR error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du QR code' });
  }
});

// Utilitaire pour le nom du mois
function getMonthName(month) {
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return months[month - 1] || '';
}

export default router;
