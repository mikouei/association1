// Script pour créer le compte Super Admin drigo
// Exécuter avec: node scripts/create-drigo-admin.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createDrigoAdmin() {
  console.log('🔧 Création du compte Super Admin drigo...');

  try {
    // Vérifier si le compte existe déjà
    const existing = await prisma.superAdmin.findUnique({
      where: { email: 'drigo@drigo.local' }
    });

    const passwordHash = await bcrypt.hash('drigo123', 10);

    if (existing) {
      console.log('ℹ️  Compte drigo existe déjà, mise à jour du mot de passe...');
      await prisma.superAdmin.update({
        where: { email: 'drigo@drigo.local' },
        data: { passwordHash, active: true }
      });
      console.log('✅ Mot de passe mis à jour');
    } else {
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
    }

    // Lister tous les super admins
    const admins = await prisma.superAdmin.findMany({
      select: { email: true, name: true, active: true }
    });
    console.log('\n📋 Super Admins existants:');
    admins.forEach(a => console.log(`   - ${a.email} (${a.name}) - ${a.active ? 'Actif' : 'Inactif'}`));

    console.log('\n✅ Connexion Super Admin:');
    console.log('   Email: drigo@drigo.local');
    console.log('   Mot de passe: drigo123');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createDrigoAdmin();
