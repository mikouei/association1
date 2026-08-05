// Script pour créer un compte Super Admin personnalisé
//
// Usage:
//   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret node scripts/create-drigo-admin.js
//   node scripts/create-drigo-admin.js --email=admin@example.com --password=secret
//   node scripts/create-drigo-admin.js --email=admin@example.com  (génère un mot de passe aléatoire)

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Génère un mot de passe aléatoire sécurisé
 */
function generateSecurePassword(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

/**
 * Récupère les paramètres depuis les arguments ou l'environnement
 */
function getParams() {
  const params = {
    email: null,
    password: null,
    name: 'Super Admin'
  };
  
  // Vérifier les arguments de ligne de commande
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--email=')) {
      params.email = arg.split('=')[1];
    } else if (arg.startsWith('--password=')) {
      params.password = arg.split('=')[1];
    } else if (arg.startsWith('--name=')) {
      params.name = arg.split('=')[1];
    }
  }
  
  // Variables d'environnement en fallback
  params.email = params.email || process.env.ADMIN_EMAIL;
  params.password = params.password || process.env.ADMIN_PASSWORD;
  params.name = params.name || process.env.ADMIN_NAME || 'Super Admin';
  
  return params;
}

async function createSuperAdmin() {
  console.log('🔧 Création d\'un compte Super Admin...\n');

  const params = getParams();
  let passwordGenerated = false;
  
  // Valider l'email
  if (!params.email) {
    console.error('❌ Email requis. Usage:');
    console.error('   ADMIN_EMAIL=admin@example.com node scripts/create-drigo-admin.js');
    console.error('   node scripts/create-drigo-admin.js --email=admin@example.com');
    process.exit(1);
  }
  
  // Générer un mot de passe si non fourni
  if (!params.password) {
    params.password = generateSecurePassword();
    passwordGenerated = true;
    console.log('⚠️  Aucun mot de passe fourni, génération d\'un mot de passe aléatoire...');
  }

  try {
    // Vérifier si le compte existe déjà
    const existing = await prisma.superAdmin.findUnique({
      where: { email: params.email }
    });

    if (existing) {
      console.log(`ℹ️  Compte ${params.email} existe déjà — aucune modification apportée`);
      console.log('   (pour réinitialiser le mot de passe, supprimez le compte et relancez ce script)');
    } else {
      const passwordHash = await bcrypt.hash(params.password, 10);
      console.log('📝 Création du nouveau compte...');
      await prisma.superAdmin.create({
        data: {
          email: params.email,
          passwordHash,
          name: params.name,
          active: true
        }
      });
      console.log('✅ Compte créé');
      
      // Afficher le mot de passe UNE SEULE FOIS
      console.log('\n🔐 IMPORTANT - Notez ces identifiants maintenant (le mot de passe ne sera plus affiché):');
      console.log(`   Email: ${params.email}`);
      console.log(`   Mot de passe: ${params.password}`);
      if (passwordGenerated) {
        console.log('   ⚠️  Ce mot de passe a été généré automatiquement');
      }
      console.log('\n');
    }

    // Lister tous les super admins
    const admins = await prisma.superAdmin.findMany({
      select: { email: true, name: true, active: true }
    });
    console.log('📋 Super Admins existants:');
    admins.forEach(a => console.log(`   - ${a.email} (${a.name}) - ${a.active ? 'Actif' : 'Inactif'}`));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
