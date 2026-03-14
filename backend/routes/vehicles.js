import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(authenticateToken);

// GET /api/vehicles/member/:memberId - Liste des véhicules d'un membre
router.get('/member/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const vehicles = await req.prisma.vehiclePlate.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(vehicles);
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des véhicules' });
  }
});

// POST /api/vehicles - Ajouter un véhicule (ADMIN uniquement)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { memberId, plateNumber, description } = req.body;
    
    if (!memberId || !plateNumber) {
      return res.status(400).json({ error: 'Membre et numéro de plaque requis' });
    }
    
    // Vérifier que le membre existe
    const member = await req.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return res.status(404).json({ error: 'Membre introuvable' });
    }
    
    const vehicle = await req.prisma.vehiclePlate.create({
      data: {
        memberId,
        plateNumber: plateNumber.toUpperCase().trim(),
        description: description || null,
        active: true
      }
    });
    
    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du véhicule' });
  }
});

// PUT /api/vehicles/:id - Modifier un véhicule (ADMIN uniquement)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { plateNumber, description, active } = req.body;
    
    const vehicle = await req.prisma.vehiclePlate.update({
      where: { id },
      data: {
        ...(plateNumber && { plateNumber: plateNumber.toUpperCase().trim() }),
        ...(description !== undefined && { description }),
        ...(typeof active === 'boolean' && { active })
      }
    });
    
    res.json(vehicle);
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du véhicule' });
  }
});

// DELETE /api/vehicles/:id - Supprimer un véhicule (ADMIN uniquement)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await req.prisma.vehiclePlate.delete({ where: { id } });
    
    res.json({ message: 'Véhicule supprimé' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du véhicule' });
  }
});

export default router;
