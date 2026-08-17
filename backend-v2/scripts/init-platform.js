// Script d'initialisation de la Platform (SUPER_ADMIN)
import { PrismaClient } from '../node_modules/.prisma/platform-client/index.js';
import bcrypt from 'bcryptjs';

const platformPrisma = new PrismaClient();

async function initPlatform() {
  console.log('🚀 Initialisation de la Platform V2...');

  try {
    // Créer la configuration de la plateforme
    const existingConfig = await platformPrisma.platformConfig.findFirst();
    if (!existingConfig) {
      await platformPrisma.platformConfig.create({
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
    const existingSuperAdmin = await platformPrisma.superAdmin.findUnique({
      where: { email: 'superadmin@platform.local' }
    });

    if (!existingSuperAdmin) {
      const passwordHash = await bcrypt.hash('superadmin', 10);
      await platformPrisma.superAdmin.create({
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

    // Migrer l'association V1 existante si elle existe
    const existingAssociation = await platformPrisma.association.findFirst();
    if (!existingAssociation) {
      // Créer une entrée pour l'association V1 existante
      await platformPrisma.association.create({
        data: {
          name: 'Association V1 (Migration)',
          type: 'association',
          code: 'V1-DEFAULT',
          dbName: 'assocmanager.db',
          active: true,
          adminEmail: 'admin@assocmanager.local',
          adminName: 'Administrateur V1'
        }
      });
      console.log('✅ Association V1 migrée vers la Platform');
    } else {
      console.log('ℹ️  Associations existantes dans la Platform');
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
    await platformPrisma.$disconnect();
  }
}

initPlatform();
