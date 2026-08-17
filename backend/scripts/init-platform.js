// Script d'initialisation de la Platform (SUPER_ADMIN)
// Utilise le client Prisma unifié (PostgreSQL)
//
// Usage:
//   ADMIN_PASSWORD=mon_mdp_securise node scripts/init-platform.js
//   node scripts/init-platform.js --password=mon_mdp_securise
//   node scripts/init-platform.js  (génère un mot de passe aléatoire)

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
 * Récupère le mot de passe depuis les arguments ou l'environnement
 */
function getPassword() {
  // Vérifier les arguments de ligne de commande
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--password=')) {
      return arg.split('=')[1];
    }
  }
  
  // Vérifier la variable d'environnement
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }
  
  // Générer un mot de passe aléatoire
  return null;
}

async function initPlatform() {
  console.log('🚀 Initialisation de la Platform V2 (PostgreSQL)...');

  let password = getPassword();
  let passwordGenerated = false;
  
  if (!password) {
    password = generateSecurePassword();
    passwordGenerated = true;
    console.log('⚠️  Aucun mot de passe fourni, génération d\'un mot de passe aléatoire...');
  }

  try {
    // Créer la configuration de la plateforme
    const existingConfig = await prisma.platformConfig.findFirst();
    if (!existingConfig) {
      await prisma.platformConfig.create({
        data: {
          name: 'AssocManager Platform',
          version: '2.0.0'
        }
      });
      console.log('✅ Configuration platform créée');
    } else {
      console.log('ℹ️  Configuration platform existante');
    }

    // Créer le SUPER_ADMIN par défaut
    const existingSuperAdmin = await prisma.superAdmin.findUnique({
      where: { email: 'superadmin@platform.local' }
    });

    if (!existingSuperAdmin) {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.superAdmin.create({
        data: {
          email: 'superadmin@platform.local',
          passwordHash,
          name: 'Super Administrateur',
          active: true
        }
      });
      console.log('✅ SUPER_ADMIN créé: superadmin@platform.local');
      
      // Afficher le mot de passe UNE SEULE FOIS
      console.log('\n🔐 IMPORTANT - Notez ce mot de passe maintenant (il ne sera plus affiché):');
      console.log(`   Mot de passe: ${password}`);
      if (passwordGenerated) {
        console.log('   ⚠️  Ce mot de passe a été généré automatiquement');
      }
      console.log('\n');
    } else {
      console.log('ℹ️  SUPER_ADMIN existant (mot de passe inchangé)');
    }

    // Vérifier s'il existe des associations
    const existingAssociation = await prisma.association.findFirst();
    if (!existingAssociation) {
      console.log('ℹ️  Aucune association existante - la plateforme est prête pour créer des associations');
    } else {
      const associationCount = await prisma.association.count();
      console.log(`ℹ️  ${associationCount} association(s) existante(s) dans la Platform`);
    }

    console.log('\n✅ Platform V2 initialisée avec succès!');
    console.log('\n📋 Accès SUPER_ADMIN:');
    console.log('   URL: /platform');
    console.log('   Email: superadmin@platform.local');

  } catch (error) {
    console.error('❌ Erreur initialisation Platform:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

initPlatform();
