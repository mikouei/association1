// Seed de test local pour la fonctionnalité "inscription en attente"
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

// Garde-fou explicite : ce script crée un compte admin.
// Il refuse de s'exécuter sauf si SEED_CONFIRM=yes est fourni.
if (process.env.SEED_CONFIRM !== 'yes') {
  console.error('❌ Refus d\'exécution : définissez SEED_CONFIRM=yes pour lancer ce script de seed.');
  process.exit(1);
}

// Mot de passe admin : via ADMIN_PASSWORD sinon généré aléatoirement (20 caractères).
const generatePassword = () => crypto.randomBytes(20).toString('base64url').slice(0, 20);
const adminPassword = process.env.ADMIN_PASSWORD || generatePassword();

const prisma = new PrismaClient();

async function main() {
  const code = 'ASCB';

  // Association
  let association = await prisma.association.findUnique({ where: { code } });
  if (!association) {
    association = await prisma.association.create({
      data: {
        name: 'Association ASCB',
        type: 'association',
        code,
        active: true,
        source: 'manual',
        currency: 'XOF',
        plan: 'LAUNCH',
      },
    });
    console.log('Association créée:', association.code);
  } else {
    console.log('Association existante:', association.code);
  }

  // Admin
  const adminPhone = '+2250708510832';
  let admin = await prisma.user.findFirst({
    where: { associationId: association.id, phone: adminPhone },
  });
  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    admin = await prisma.user.create({
      data: {
        associationId: association.id,
        email: 'admin@ascb.local',
        phone: adminPhone,
        passwordHash,
        role: 'ADMIN',
        approvalStatus: 'APPROVED',
        active: true,
        passwordChangedAt: new Date(),
      },
    });
    await prisma.member.create({
      data: {
        associationId: association.id,
        userId: admin.id,
        name: 'Admin ASCB',
        source: 'manual',
        active: true,
      },
    });
    console.log('Admin créé:', adminPhone, '/', adminPassword);
  } else {
    console.log('Admin existant:', adminPhone);
  }

  console.log('Seed terminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
