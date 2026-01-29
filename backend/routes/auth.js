import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
// Login avec email/phone + password OU token d'accès
router.post('/login', async (req, res) => {
  try {
    const { identifier, password, accessToken } = req.body;

    // Cas 1: Login avec token d'accès (pour les membres)
    if (accessToken) {
      const user = await req.prisma.user.findFirst({
        where: { 
          token: accessToken,
          active: true
        },
        include: { member: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Token d\'accès invalide' });
      }

      const token = generateToken(user.id);
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          member: user.member
        }
      });
    }

    // Cas 2: Login avec email/phone + password
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }

    // Chercher par email ou téléphone
    const user = await req.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier }
        ],
        active: true
      },
      include: { member: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Générer le token JWT
    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        member: user.member
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// GET /api/auth/me
// Récupérer les infos de l'utilisateur connecté
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      id: req.user.id,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      member: req.user.member
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des informations' });
  }
});

export default router;
