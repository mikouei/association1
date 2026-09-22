import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const assoc = await prisma.association.findUnique({ where: { code: 'ASCB' } });

  // MEMBER user + profile
  const phone = '+2250700000010';
  let user = await prisma.user.findFirst({ where: { associationId: assoc.id, phone } });
  if (!user) {
    const passwordHash = await bcrypt.hash('motdepasse123', 10);
    user = await prisma.user.create({
      data: {
        associationId: assoc.id,
        email: 'membre1@ascb.local',
        phone,
        passwordHash,
        role: 'MEMBER',
        approvalStatus: 'APPROVED',
        active: true,
        passwordChangedAt: new Date(),
      },
    });
  }
  let member = await prisma.member.findUnique({ where: { userId: user.id } });
  if (!member) {
    member = await prisma.member.create({
      data: { associationId: assoc.id, userId: user.id, name: 'Jean Kouassi', source: 'manual', active: true },
    });
  }

  // A second member (for the "other member payment -> 404" test)
  const phone2 = '+2250700000011';
  let user2 = await prisma.user.findFirst({ where: { associationId: assoc.id, phone: phone2 } });
  if (!user2) {
    const passwordHash = await bcrypt.hash('motdepasse123', 10);
    user2 = await prisma.user.create({
      data: { associationId: assoc.id, email: 'membre2@ascb.local', phone: phone2, passwordHash, role: 'MEMBER', approvalStatus: 'APPROVED', active: true, passwordChangedAt: new Date() },
    });
  }
  let member2 = await prisma.member.findUnique({ where: { userId: user2.id } });
  if (!member2) {
    member2 = await prisma.member.create({ data: { associationId: assoc.id, userId: user2.id, name: 'Awa Traore', source: 'manual', active: true } });
  }

  // Year 2026
  let year = await prisma.year.findFirst({ where: { associationId: assoc.id, year: 2026 } });
  if (!year) {
    year = await prisma.year.create({ data: { associationId: assoc.id, year: 2026, monthlyAmount: 5000, active: true } });
  }

  // Monthly payment for member (month 1)
  let mp = await prisma.monthlyPayment.findFirst({ where: { memberId: member.id, yearId: year.id, month: 1 } });
  if (!mp) {
    mp = await prisma.monthlyPayment.create({ data: { memberId: member.id, yearId: year.id, month: 1, amountPaid: 5000 } });
  }
  // Monthly payment for member2 (month 1) -> used for cross-member test
  let mp2 = await prisma.monthlyPayment.findFirst({ where: { memberId: member2.id, yearId: year.id, month: 1 } });
  if (!mp2) {
    mp2 = await prisma.monthlyPayment.create({ data: { memberId: member2.id, yearId: year.id, month: 1, amountPaid: 5000 } });
  }

  // Exceptional contribution + payment for member
  let contrib = await prisma.exceptionalContribution.findFirst({ where: { associationId: assoc.id, title: 'Décès Test' } });
  if (!contrib) {
    contrib = await prisma.exceptionalContribution.create({ data: { associationId: assoc.id, title: 'Décès Test', type: 'décès', hasCollection: true, active: true } });
  }
  let ep = await prisma.exceptionalPayment.findFirst({ where: { contributionId: contrib.id, memberId: member.id } });
  if (!ep) {
    ep = await prisma.exceptionalPayment.create({ data: { contributionId: contrib.id, memberId: member.id, amount: 10000 } });
  }
  let ep2 = await prisma.exceptionalPayment.findFirst({ where: { contributionId: contrib.id, memberId: member2.id } });
  if (!ep2) {
    ep2 = await prisma.exceptionalPayment.create({ data: { contributionId: contrib.id, memberId: member2.id, amount: 8000 } });
  }

  console.log(JSON.stringify({
    memberPhone: phone,
    memberId: member.id,
    monthlyPaymentId: mp.id,
    exceptionalPaymentId: ep.id,
    contributionId: contrib.id,
    otherMonthlyPaymentId: mp2.id,
    otherExceptionalPaymentId: ep2.id,
    member2Phone: phone2,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
