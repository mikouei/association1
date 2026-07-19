// Routes publiques (sans authentification)
// Pour les demandes de suppression de compte accessibles sans l'app
import express from 'express';
import { prisma } from '../middleware/auth.js';

const router = express.Router();

// POST /api/public/deletion-request
// Soumettre une demande de suppression de compte
router.post('/deletion-request', async (req, res) => {
  try {
    const { email, phone, associationCode, message } = req.body;

    // Validation
    if (!email && !phone) {
      return res.status(400).json({ error: 'Email ou téléphone requis' });
    }

    if (!associationCode) {
      return res.status(400).json({ error: 'Code association requis' });
    }

    // Vérifier que l'association existe
    const association = await prisma.association.findUnique({
      where: { code: associationCode }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée avec ce code' });
    }

    // Créer la demande
    const request = await prisma.deletionRequest.create({
      data: {
        email: email || null,
        phone: phone || null,
        associationCode,
        message: message || null,
        status: 'pending'
      }
    });

    res.status(201).json({ 
      message: 'Votre demande de suppression a été enregistrée. Elle sera traitée sous 30 jours.',
      requestId: request.id
    });
  } catch (error) {
    console.error('Deletion request error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la demande' });
  }
});

// GET /api/public/associations
// Liste des associations (pour le formulaire de demande)
router.get('/associations', async (req, res) => {
  try {
    const associations = await prisma.association.findMany({
      where: { active: true },
      select: {
        code: true,
        name: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(associations);
  } catch (error) {
    console.error('List associations error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
