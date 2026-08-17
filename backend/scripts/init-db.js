// Script pour initialiser la base de données PostgreSQL
// Crée le SuperAdmin et une association par défaut
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// ⚠️ Ce script contient des identifiants par défaut faibles
// NE JAMAIS exécuter en production sans avoir changé les mots de passe
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Ce script ne doit pas être exécuté en production avec des identifiants par défaut');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Initialisation de la base de données AssocManager...');

  // 1. Créer le SuperAdmin
  const superAdminEmail = 'superadmin@platform.local';
  const superAdminPassword = 'superadmin';

  const existingSuperAdmin = await prisma.superAdmin.findUnique({
    where: { email: superAdminEmail }
  });

  if (!existingSuperAdmin) {
    const passwordHash = await bcrypt.hash(superAdminPassword, 10);
    await prisma.superAdmin.create({
      data: {
        email: superAdminEmail,
        passwordHash,
        name: 'Super Administrateur',
        active: true
      }
    });
    console.log('✅ SuperAdmin créé:');
    console.log(`   Email: ${superAdminEmail}`);
    console.log(`   Password: ${superAdminPassword}`);
  } else {
    console.log('ℹ️  SuperAdmin existe déjà');
  }

  // 2. Créer une association par défaut (SYNDIC BNI)
  const defaultAssociationCode = 'SYNDIC-BNI';

  const existingAssociation = await prisma.association.findUnique({
    where: { code: defaultAssociationCode }
  });

  if (!existingAssociation) {
    const adminEmail = 'drigo@drigo.local';
    const adminPassword = 'drigo';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

    const association = await prisma.association.create({
      data: {
        name: 'SYNDIC BNI',
        type: 'syndicat',
        code: defaultAssociationCode,
        active: true,
        adminEmail,
        adminName: 'Administrateur BNI',
        memberFieldLabel: 'Villa',
        enableVehiclePlates: true
      }
    });

    // Créer l'admin de l'association
    await prisma.user.create({
      data: {
        associationId: association.id,
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        active: true
      }
    });

    console.log('✅ Association par défaut créée:');
    console.log(`   Nom: ${association.name}`);
    console.log(`   Code: ${association.code}`);
    console.log(`   Admin Email: ${adminEmail}`);
    console.log(`   Admin Password: ${adminPassword}`);
  } else {
    console.log('ℹ️  Association par défaut existe déjà');
  }

  // 3. Créer la config de la plateforme
  const existingConfig = await prisma.platformConfig.findFirst();
  if (!existingConfig) {
    await prisma.platformConfig.create({
      data: {
        name: 'AssocManager Platform',
        version: '2.0.0'
      }
    });
    console.log('✅ Configuration plateforme créée');
  }

  console.log('\n🎉 Base de données initialisée avec succès!');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
