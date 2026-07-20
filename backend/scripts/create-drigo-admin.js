// Script pour créer le compte Super Admin drigo
// Exécuter avec: node scripts/create-drigo-admin.js
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

async function createDrigoAdmin() {
  console.log('🔧 Création du compte Super Admin drigo...');

  try {
    // Vérifier si le compte existe déjà
    const existing = await prisma.superAdmin.findUnique({
      where: { email: 'drigo@drigo.local' }
    });

    if (existing) {
      console.log('ℹ️  Compte drigo existe déjà — aucune modification apportée');
      console.log('   (pour réinitialiser le mot de passe, supprimez le compte et relancez ce script)');
    } else {
      const passwordHash = await bcrypt.hash('drigo123', 10);
      console.log('📝 Création du nouveau compte...');
      await prisma.superAdmin.create({
        data: {
          email: 'drigo@drigo.local',
          passwordHash,
          name: 'Drigo Admin',
          active: true
        }
      });
      console.log('✅ Compte créé');
      console.log('\n✅ Connexion Super Admin:');
      console.log('   Email: drigo@drigo.local');
      console.log('   Mot de passe: drigo123');
    }

    // Lister tous les super admins
    const admins = await prisma.superAdmin.findMany({
      select: { email: true, name: true, active: true }
    });
    console.log('\n📋 Super Admins existants:');
    admins.forEach(a => console.log(`   - ${a.email} (${a.name}) - ${a.active ? 'Actif' : 'Inactif'}`));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createDrigoAdmin();
