import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Initialisation de la base de données...');

  // Vérifier si des utilisateurs existent
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    console.log('📝 Création de l\'administrateur par défaut...');

    // Créer l'ADMIN par défaut
    const passwordHash = await bcrypt.hash('admin', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@assocmanager.local',
        passwordHash,
        role: 'ADMIN',
        active: true
      }
    });

    console.log('✅ Administrateur créé:');
    console.log('   Email: admin@assocmanager.local');
    console.log('   Mot de passe: admin');
    console.log('   ⚠️  Pensez à changer le mot de passe après la première connexion!');
  } else {
    console.log(`ℹ️  ${userCount} utilisateur(s) déjà existant(s)`);
  }

  // Vérifier la configuration de l'association
  let config = await prisma.associationConfig.findFirst();

  if (!config) {
    console.log('📝 Création de la configuration par défaut...');
    config = await prisma.associationConfig.create({
      data: {
        name: 'Mon Association',
        type: 'Association',
        memberFieldLabel: 'Villa'
      }
    });
    console.log('✅ Configuration créée');
  } else {
    console.log('ℹ️  Configuration déjà existante');
  }

  console.log('\n✅ Initialisation terminée!');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
