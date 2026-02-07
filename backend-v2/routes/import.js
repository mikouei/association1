import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, requireAdmin, generateAccessToken } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent authentification ADMIN
router.use(authenticateToken);
router.use(requireAdmin);

// POST /api/import/members/preview
// Prévisualiser l'import avant validation
router.post('/members/preview', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Contenu requis' });
    }

    // Parser le contenu (CSV/TXT avec format: nom;champ_personnalise;telephone)
    const lines = content.trim().split('\n');
    const preview = [];
    const errors = [];
    const duplicates = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Ignorer les lignes vides et les commentaires
      if (!line || line.startsWith('#') || line.startsWith('//')) {
        continue;
      }

      const parts = line.split(';').map(p => p.trim());
      
      if (parts.length < 2) {
        errors.push({
          line: i + 1,
          content: line,
          error: 'Format invalide (minimum: nom;champ_personnalise)'
        });
        continue;
      }

      const [name, customFieldValue, phone] = parts;
      
      // Ignorer si le nom est vide
      if (!name) {
        errors.push({
          line: i + 1,
          content: line,
          error: 'Le nom est requis'
        });
        continue;
      }

      // Nettoyer le numéro de téléphone (enlever espaces supplémentaires)
      const cleanPhone = phone ? phone.replace(/\s+/g, ' ').trim() : null;

      // Vérifier les doublons dans la base par téléphone
      if (cleanPhone) {
        const existing = await req.prisma.user.findFirst({
          where: { phone: cleanPhone },
          include: { member: true }
        });

        if (existing) {
          duplicates.push({
            line: i + 1,
            name,
            phone: cleanPhone,
            existingMember: existing.member?.name
          });
          continue;
        }
      }

      preview.push({
        line: i + 1,
        name,
        customFieldValue,
        phone: cleanPhone,
        status: 'ok'
      });
    }

    res.json({
      total: lines.filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('//')).length,
      valid: preview.length,
      duplicates: duplicates.length,
      errors: errors.length,
      preview,
      duplicates,
      errors
    });
  } catch (error) {
    console.error('Import preview error:', error);
    res.status(500).json({ error: 'Erreur lors de la prévisualisation' });
  }
});

// POST /api/import/members
// Importer les membres (après validation)
router.post('/members', async (req, res) => {
  try {
    const { members } = req.body;

    if (!members || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Liste de membres requise' });
    }

    const results = [];
    const errors = [];

    for (const memberData of members) {
      try {
        const { name, customFieldValue, phone } = memberData;

        // Générer email par défaut si pas de téléphone
        const email = phone 
          ? `${phone.replace(/[^0-9]/g, '')}@temp.local`
          : `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@temp.local`;

        // Vérifier unicité email
        const emailExists = await req.prisma.user.findUnique({ where: { email } });
        if (emailExists) {
          errors.push({
            name,
            error: 'Email déjà utilisé (doublon détecté)'
          });
          continue;
        }

        // Générer credentials
        const password = Math.random().toString(36).slice(-8);
        const passwordHash = await bcrypt.hash(password, 10);
        
        let accessToken = generateAccessToken();
        let tokenExists = true;
        while (tokenExists) {
          const existing = await req.prisma.user.findUnique({ where: { token: accessToken } });
          if (!existing) tokenExists = false;
          else accessToken = generateAccessToken();
        }

        // Créer utilisateur et membre
        const result = await req.prisma.$transaction(async (prisma) => {
          const user = await prisma.user.create({
            data: {
              email,
              phone: phone || null,
              passwordHash,
              role: 'MEMBER',
              token: accessToken,
              active: true
            }
          });

          const member = await prisma.member.create({
            data: {
              userId: user.id,
              name,
              customFieldValue,
              active: true
            }
          });

          return { user, member, password, token: accessToken };
        });

        results.push({
          name: result.member.name,
          customFieldValue: result.member.customFieldValue,
          phone: result.user.phone,
          email: result.user.email,
          password: result.password,
          token: result.token,
          status: 'created'
        });
      } catch (error) {
        console.error('Import member error:', error);
        errors.push({
          name: memberData.name,
          error: error.message
        });
      }
    }

    res.json({
      success: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Import members error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'importation' });
  }
});

export default router;
