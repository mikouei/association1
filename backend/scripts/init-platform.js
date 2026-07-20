// Script d'initialisation de la Platform (SUPER_ADMIN)
// Utilise le client Prisma unifié (PostgreSQL)
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function initPlatform() {
  // Garde-fou : ne pas exécuter en production avec des identifiants par défaut
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Ce script ne doit pas être exécuté en production avec des identifiants par défaut');
    process.exit(1);
  }

  console.log('🚀 Initialisation de la Platform V2 (PostgreSQL)...');

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
      const passwordHash = await bcrypt.hash('superadmin', 10);
      await prisma.superAdmin.create({
        data: {
          email: 'superadmin@platform.local',
          passwordHash,
          name: 'Super Administrateur',
          active: true
        }
      });
      console.log('✅ SUPER_ADMIN créé: superadmin@platform.local / superadmin');
    } else {
      console.log('ℹ️  SUPER_ADMIN existant');
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
    console.log('   Mot de passe: superadmin');

  } catch (error) {
    console.error('❌ Erreur initialisation Platform:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

initPlatform();
