// Seed complémentaire: année + membre approuvé + paiement AVEC note
// pour tester le préchargement de la note dans l'écran cotisations.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const association = await prisma.association.findUnique({ where: { code: 'ASCB' } });
  if (!association) throw new Error('Association ASCB introuvable (lancer seed-test.js avant)');

  // Année active 2026
  let year = await prisma.year.findFirst({ where: { associationId: association.id, year: 2026 } });
  if (!year) {
    year = await prisma.year.create({
      data: { associationId: association.id, year: 2026, monthlyAmount: 5000, active: true },
    });
    console.log('Année 2026 créée (5000/mois, active)');
  } else {
    console.log('Année 2026 existante');
  }

  // Membre approuvé avec paiement + note
  const phone = '+2250700123456';
  let user = await prisma.user.findFirst({ where: { associationId: association.id, phone } });
  let member;
  if (!user) {
    const passwordHash = await bcrypt.hash('membre12345', 10);
    user = await prisma.user.create({
      data: {
        associationId: association.id,
        email: 'membre.note@ascb.local',
        phone,
        passwordHash,
        role: 'MEMBER',
        approvalStatus: 'APPROVED',
        active: true,
        passwordChangedAt: new Date(),
      },
    });
    member = await prisma.member.create({
      data: { associationId: association.id, userId: user.id, name: 'Membre Note', source: 'manual', active: true },
    });
    console.log('Membre "Membre Note" créé:', phone);
  } else {
    member = await prisma.member.findFirst({ where: { userId: user.id } });
    console.log('Membre existant:', phone);
  }

  // Paiement mois 1 AVEC note
  const existing = await prisma.monthlyPayment.findFirst({
    where: { memberId: member.id, yearId: year.id, month: 1 },
  });
  if (!existing) {
    await prisma.monthlyPayment.create({
      data: {
        memberId: member.id,
        yearId: year.id,
        month: 1,
        amountPaid: 5000,
        notes: 'Note préchargée test',
      },
    });
    console.log('Paiement mois 1 créé avec note "Note préchargée test"');
  } else {
    await prisma.monthlyPayment.update({ where: { id: existing.id }, data: { notes: 'Note préchargée test' } });
    console.log('Paiement mois 1 existant, note mise à jour');
  }

  console.log('Seed notes terminé.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
