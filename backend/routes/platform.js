// Routes Platform - Gestion des associations par SUPER_ADMIN
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as PlatformPrismaClient } from '../node_modules/.prisma/platform-client/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Client Prisma pour la Platform (base séparée)
let platformPrisma = null;

// Initialiser le client Platform avec la bonne base de données
async function getPlatformPrisma() {
  if (!platformPrisma) {
    platformPrisma = new PlatformPrismaClient();
  }
  return platformPrisma;
}

// Middleware pour vérifier le token SUPER_ADMIN
const authenticateSuperAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    if (decoded.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Accès SUPER_ADMIN requis' });
    }

    const prisma = await getPlatformPrisma();
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: decoded.id }
    });

    if (!superAdmin || !superAdmin.active) {
      return res.status(403).json({ error: 'Compte SUPER_ADMIN invalide ou désactivé' });
    }

    req.superAdmin = superAdmin;
    next();
  } catch (error) {
    console.error('Auth SUPER_ADMIN error:', error);
    return res.status(403).json({ error: 'Token invalide' });
  }
};

// ============ AUTH SUPER_ADMIN ============

// POST /api/platform/login - Connexion SUPER_ADMIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const prisma = await getPlatformPrisma();
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email }
    });

    if (!superAdmin) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    if (!superAdmin.active) {
      return res.status(401).json({ error: 'Compte désactivé' });
    }

    const validPassword = await bcrypt.compare(password, superAdmin.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = jwt.sign(
      { id: superAdmin.id, email: superAdmin.email, role: 'SUPER_ADMIN' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: 'SUPER_ADMIN'
      }
    });
  } catch (error) {
    console.error('Erreur login SUPER_ADMIN:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/platform/me - Profil SUPER_ADMIN
router.get('/me', authenticateSuperAdmin, async (req, res) => {
  res.json({
    id: req.superAdmin.id,
    email: req.superAdmin.email,
    name: req.superAdmin.name,
    role: 'SUPER_ADMIN'
  });
});

// ============ GESTION DES ASSOCIATIONS ============

// GET /api/platform/associations - Liste des associations
router.get('/associations', authenticateSuperAdmin, async (req, res) => {
  try {
    const prisma = await getPlatformPrisma();
    const associations = await prisma.association.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json(associations);
  } catch (error) {
    console.error('Erreur liste associations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/platform/associations/:id - Détail d'une association
router.get('/associations/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const prisma = await getPlatformPrisma();
    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    res.json(association);
  } catch (error) {
    console.error('Erreur détail association:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/platform/associations - Créer une association
router.post('/associations', authenticateSuperAdmin, async (req, res) => {
  try {
    const { name, type, code, adminEmail, adminPassword, adminName } = req.body;

    if (!name || !code || !adminEmail || !adminPassword) {
      return res.status(400).json({ 
        error: 'Nom, code, email admin et mot de passe admin requis' 
      });
    }

    const prisma = await getPlatformPrisma();

    // Vérifier que le code est unique
    const existingCode = await prisma.association.findUnique({
      where: { code }
    });
    if (existingCode) {
      return res.status(400).json({ error: 'Ce code existe déjà' });
    }

    // Générer le nom de la base de données
    const dbName = `assoc_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.db`;

    // Créer l'association dans la Platform DB
    const association = await prisma.association.create({
      data: {
        name,
        type: type || 'association',
        code,
        dbName,
        active: true,
        adminEmail,
        adminName: adminName || 'Administrateur'
      }
    });

    // Créer la base de données de l'association
    await createAssociationDatabase(dbName, {
      name,
      type,
      adminEmail,
      adminPassword,
      adminName
    });

    res.status(201).json({
      message: 'Association créée avec succès',
      association,
      credentials: {
        email: adminEmail,
        password: adminPassword
      }
    });
  } catch (error) {
    console.error('Erreur création association:', error);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/platform/associations/:id - Modifier une association
router.put('/associations/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { name, type, active } = req.body;
    const prisma = await getPlatformPrisma();

    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    const updated = await prisma.association.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(typeof active === 'boolean' && { active })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Erreur modification association:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/platform/associations/:id/toggle - Activer/Désactiver
router.put('/associations/:id/toggle', authenticateSuperAdmin, async (req, res) => {
  try {
    const prisma = await getPlatformPrisma();

    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    const updated = await prisma.association.update({
      where: { id: req.params.id },
      data: { active: !association.active }
    });

    res.json({
      message: updated.active ? 'Association activée' : 'Association désactivée',
      association: updated
    });
  } catch (error) {
    console.error('Erreur toggle association:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/platform/associations/:id - Supprimer une association
router.delete('/associations/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const prisma = await getPlatformPrisma();

    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    // Ne pas permettre la suppression de l'association V1 par défaut
    if (association.code === 'V1-DEFAULT') {
      return res.status(400).json({ error: 'Impossible de supprimer l\'association par défaut' });
    }

    // Supprimer le fichier de base de données
    const dbPath = path.join(__dirname, '../prisma', association.dbName);
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Supprimer l'entrée dans la Platform
    await prisma.association.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Association supprimée' });
  } catch (error) {
    console.error('Erreur suppression association:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============ GESTION DES ADMINS ============

// GET /api/platform/associations/:id/admins - Lister les admins d'une association
router.get('/associations/:id/admins', authenticateSuperAdmin, async (req, res) => {
  try {
    const prisma = await getPlatformPrisma();
    
    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    // Charger la DB de l'association pour lister les admins
    const Database = (await import('better-sqlite3')).default;
    const dbPath = path.join(__dirname, '../prisma', association.dbName);
    
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Base de données non trouvée' });
    }
    
    const db = new Database(dbPath);
    const admins = db.prepare("SELECT id, email, phone, active, createdAt FROM User WHERE role = 'ADMIN'").all();
    db.close();
    
    res.json(admins.map(admin => ({
      ...admin,
      active: !!admin.active
    })));
  } catch (error) {
    console.error('Erreur liste admins:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/platform/associations/:id/admins - Ajouter un admin à une association
router.post('/associations/:id/admins', authenticateSuperAdmin, async (req, res) => {
  try {
    const { email, password, phone } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const prisma = await getPlatformPrisma();
    
    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    // Charger la DB de l'association
    const Database = (await import('better-sqlite3')).default;
    const dbPath = path.join(__dirname, '../prisma', association.dbName);
    
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Base de données non trouvée' });
    }
    
    const db = new Database(dbPath);
    
    // Vérifier si l'email existe déjà
    const existing = db.prepare("SELECT id FROM User WHERE email = ?").get(email);
    if (existing) {
      db.close();
      return res.status(400).json({ error: 'Cet email existe déjà' });
    }
    
    // Créer le nouvel admin
    const passwordHash = await bcrypt.hash(password, 10);
    const adminId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO User (id, email, phone, passwordHash, role, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'ADMIN', 1, ?, ?)
    `).run(adminId, email, phone || null, passwordHash, now, now);
    
    db.close();
    
    res.status(201).json({
      message: 'Admin ajouté avec succès',
      admin: { id: adminId, email, phone }
    });
  } catch (error) {
    console.error('Erreur ajout admin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/platform/associations/:id/admins/:adminId/password - Changer mot de passe admin
router.put('/associations/:id/admins/:adminId/password', authenticateSuperAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Mot de passe requis (minimum 4 caractères)' });
    }

    const prisma = await getPlatformPrisma();
    
    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    // Charger la DB de l'association
    const Database = (await import('better-sqlite3')).default;
    const dbPath = path.join(__dirname, '../prisma', association.dbName);
    
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Base de données non trouvée' });
    }
    
    const db = new Database(dbPath);
    
    // Vérifier si l'admin existe
    const admin = db.prepare("SELECT id, email FROM User WHERE id = ? AND role = 'ADMIN'").get(req.params.adminId);
    if (!admin) {
      db.close();
      return res.status(404).json({ error: 'Admin non trouvé' });
    }
    
    // Mettre à jour le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    
    db.prepare("UPDATE User SET passwordHash = ?, updatedAt = ? WHERE id = ?").run(passwordHash, now, req.params.adminId);
    
    db.close();
    
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('Erreur modification mot de passe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/platform/associations/:id/admins/:adminId - Supprimer un admin
router.delete('/associations/:id/admins/:adminId', authenticateSuperAdmin, async (req, res) => {
  try {
    const prisma = await getPlatformPrisma();
    
    const association = await prisma.association.findUnique({
      where: { id: req.params.id }
    });

    if (!association) {
      return res.status(404).json({ error: 'Association non trouvée' });
    }

    // Charger la DB de l'association
    const Database = (await import('better-sqlite3')).default;
    const dbPath = path.join(__dirname, '../prisma', association.dbName);
    
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Base de données non trouvée' });
    }
    
    const db = new Database(dbPath);
    
    // Compter le nombre d'admins
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM User WHERE role = 'ADMIN'").get().count;
    
    if (adminCount <= 1) {
      db.close();
      return res.status(400).json({ error: 'Impossible de supprimer le dernier admin' });
    }
    
    // Supprimer l'admin
    db.prepare("DELETE FROM User WHERE id = ? AND role = 'ADMIN'").run(req.params.adminId);
    
    db.close();
    
    res.json({ message: 'Admin supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression admin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/platform/stats - Statistiques de la plateforme
router.get('/stats', authenticateSuperAdmin, async (req, res) => {
  try {
    const prisma = await getPlatformPrisma();

    const totalAssociations = await prisma.association.count();
    const activeAssociations = await prisma.association.count({
      where: { active: true }
    });
    const inactiveAssociations = totalAssociations - activeAssociations;

    res.json({
      totalAssociations,
      activeAssociations,
      inactiveAssociations
    });
  } catch (error) {
    console.error('Erreur stats platform:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============ HELPER: Créer la base de données d'une association ============

async function createAssociationDatabase(dbName, config) {
  const { name, type, adminEmail, adminPassword, adminName } = config;
  
  // Le chemin vers le fichier de schéma et la nouvelle base
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  const dbPath = path.join(__dirname, '../prisma', dbName);
  
  // Lire le schéma existant et modifier l'URL de la datasource
  let schema = fs.readFileSync(schemaPath, 'utf-8');
  schema = schema.replace(
    /url\s*=\s*"file:\.\/[^"]+"/,
    `url = "file:./${dbName}"`
  );
  
  // Créer un fichier de schéma temporaire
  const tempSchemaPath = path.join(__dirname, `../prisma/schema.${dbName}.prisma`);
  fs.writeFileSync(tempSchemaPath, schema);
  
  // Exécuter prisma db push avec le schéma temporaire
  const { execSync } = await import('child_process');
  try {
    execSync(`cd ${path.join(__dirname, '..')} && npx prisma db push --schema=${tempSchemaPath} --skip-generate`, {
      stdio: 'pipe'
    });
  } catch (e) {
    console.error('Erreur création DB:', e.message);
  }
  
  // Supprimer le schéma temporaire
  fs.unlinkSync(tempSchemaPath);
  
  // Maintenant, initialiser la base avec l'admin et la config
  // On utilise better-sqlite3 directement pour éviter les conflits de client Prisma
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(dbPath);
  
  // Hasher le mot de passe admin
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminId = `admin_${Date.now()}`;
  
  // Créer l'utilisateur admin
  db.exec(`
    INSERT INTO User (id, email, phone, passwordHash, role, active, createdAt, updatedAt)
    VALUES ('${adminId}', '${adminEmail}', NULL, '${passwordHash}', 'ADMIN', 1, datetime('now'), datetime('now'))
  `);
  
  // Créer la configuration de l'association
  db.exec(`
    INSERT INTO AssociationConfig (id, name, type, memberFieldLabel, createdAt, updatedAt)
    VALUES ('config_${Date.now()}', '${name}', '${type || 'association'}', 'Villa', datetime('now'), datetime('now'))
  `);
  
  db.close();
  
  console.log(`✅ Base de données créée: ${dbName}`);
  return true;
}

export default router;
