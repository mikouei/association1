import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_this';

// Middleware pour vérifier le JWT
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Récupérer l'utilisateur complet
    const user = await req.prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { member: true }
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Utilisateur inactif ou introuvable' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(403).json({ error: 'Token invalide' });
  }
};

// Middleware pour vérifier le rôle ADMIN
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
};

// Générer un token JWT
export const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

// Générer un token d'accès simple pour les membres (pas JWT)
export const generateAccessToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
