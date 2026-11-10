// Génération des documents (reçus, récap, appel de charges PDF/Word) sous forme de Buffer.
// Utilisé par les routes authentifiées (téléchargement) et par les liens de partage publics.
import { prisma } from '../middleware/auth.js';
import { nombreEnLettres } from './nombreEnLettres.js';
import { renderReceiptHeader, renderSignature, attachSignature, docxHeader, docxSignature, signerHeading } from './receiptLayout.js';

export const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Montant en toutes lettres (ex: "vingt et un mille cinq cents francs CFA")
const enLettres = (n) => `${nombreEnLettres(n)} francs CFA`;
const fcfa = (n) => Number(n || 0).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');

export function getMonthlyRate(year, month) {
  if (!year.rateChanges || year.rateChanges.length === 0) return year.monthlyAmount;
  const applicable = year.rateChanges.filter(rc => rc.fromMonth <= month).sort((a, b) => b.fromMonth - a.fromMonth)[0];
  return applicable ? applicable.amount : year.monthlyAmount;
}
export function getTotalDueUpTo(year, uptoMonth) {
  let total = 0;
  for (let m = 1; m <= uptoMonth; m++) total += getMonthlyRate(year, m);
  return total;
}

const PDF_TYPE = 'application/pdf';
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Rend un PDF via pdfkit et renvoie le Buffer complet
async function renderPdf(options, render) {
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument(options);
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    render(doc);
    doc.end();
  });
}

// Corps commun d'un reçu mensuel (A5)
function renderMonthlyReceipt(doc, payment, association, receiptNo) {
  const currency = (association?.currency && association.currency !== 'XOF') ? association.currency : 'FCFA';
  const monthName = MONTHS[payment.month - 1] || `Mois ${payment.month}`;
  const remaining = Math.max(0, getMonthlyRate(payment.year, payment.month) - payment.amountPaid);
  const marginX = doc.page.margins.left;
  const pageW = doc.page.width - marginX * 2;
  renderReceiptHeader(doc, association);
  doc.moveDown(0.3);
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text('Reçu de paiement', { align: 'center' });
  doc.moveDown(0.25);
  const sepY = doc.y;
  doc.save();
  doc.lineWidth(2).strokeColor('#2E7D32')
    .moveTo(marginX + pageW / 2 - 40, sepY)
    .lineTo(marginX + pageW / 2 + 40, sepY)
    .stroke();
  doc.restore();
  doc.moveDown(0.5);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text(`N° ${receiptNo}`, { align: 'center' });
  doc.moveDown(1).fillColor('#000');
  const line = (label, value, valueColor) => {
    doc.fontSize(11).font('Helvetica').fillColor('#666').text(label, { continued: true });
    doc.fillColor(valueColor || '#000').font('Helvetica-Bold').text(`  ${value}`);
    doc.font('Helvetica');
    doc.moveDown(0.4);
  };
  line('Membre :', payment.member.name);
  line('Période :', `${monthName} ${payment.year.year}`);
  line('Montant payé :', `${fcfa(payment.amountPaid)} ${currency}`, remaining === 0 ? '#2E7D32' : '#B26A00');
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#999').text(`La somme de : ${enLettres(payment.amountPaid)}`);
  doc.moveDown(0.35);
  line('Reste à payer :', `${fcfa(remaining)} ${currency}`, remaining === 0 ? '#2E7D32' : '#B00020');
  if (payment.history && payment.history.length > 0) {
    doc.moveDown(0.2);
    const boxY = doc.y;
    const boxH = 20 + payment.history.length * 16;
    doc.save();
    doc.roundedRect(marginX, boxY, pageW, boxH, 4).fill('#F2F7F2');
    doc.restore();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#2E7D32').text('Versements', marginX + 10, boxY + 8);
    let vy = boxY + 24;
    for (const h of payment.history) {
      doc.fontSize(9).font('Helvetica').fillColor('#666')
        .text(new Date(h.paymentDate).toLocaleDateString('fr-FR'), marginX + 14, vy, { continued: true, width: pageW - 28 });
      doc.fillColor('#000').font('Helvetica-Bold')
        .text(`   ${fcfa(h.amount)} ${currency}`, { align: 'right' });
      vy += 16;
    }
    doc.y = boxY + boxH + 8;
  } else {
    line('Date de paiement :', new Date(payment.paymentDate).toLocaleDateString('fr-FR'));
  }
  doc.moveDown(1);
  doc.fontSize(9).fillColor('#666').text(`État au ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
  renderSignature(doc, association);
}

// Reçu mensuel (A5). userId optionnel : restreint aux paiements du membre connecté.
// Renvoie { buffer, contentType, filename } ou { error, status }.
export async function generateReceipt({ associationId, paymentId, userId }) {
  const payment = await prisma.monthlyPayment.findFirst({
    where: {
      id: paymentId,
      member: userId ? { userId, associationId } : { associationId }
    },
    include: { member: true, year: { include: { rateChanges: true } }, history: { orderBy: { paymentDate: 'asc' } } }
  });
  if (!payment) return { error: 'Paiement introuvable', status: 404 };

  const association = await prisma.association.findUnique({ where: { id: associationId } });
  await attachSignature(prisma, association);
  const receiptNo = `R-${payment.year.year}-${String(payment.month).padStart(2, '0')}-${payment.id.substring(0, 6).toUpperCase()}`;

  const buffer = await renderPdf({ margin: 40, size: 'A5' }, (doc) => renderMonthlyReceipt(doc, payment, association, receiptNo));
  return { buffer, contentType: PDF_TYPE, filename: `recu_${receiptNo}.pdf` };
}

// Reçu récapitulatif d'un membre : de janvier au mois calendaire actuel (année en cours)
export async function generateReceiptRecap({ associationId, memberId }) {
  const member = await prisma.member.findFirst({
    where: { id: memberId, associationId }
  });
  if (!member) return { error: 'Membre introuvable', status: 404 };

  const now = new Date();
  const currentYearNum = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12 (mois actuel inclus)

  const year = await prisma.year.findFirst({
    where: { associationId, year: currentYearNum },
    include: { rateChanges: true }
  });
  if (!year) return { error: 'Aucune année de cotisation pour l\'année en cours', status: 404 };

  const association = await prisma.association.findUnique({ where: { id: associationId } });
  await attachSignature(prisma, association);
  const payments = await prisma.monthlyPayment.findMany({
    where: { memberId: member.id, yearId: year.id },
    include: { history: { orderBy: { paymentDate: 'asc' } } }
  });

  let totalPaid = 0;
  const rows = [];
  for (let m = 1; m <= currentMonth; m++) {
    const monthPayments = payments.filter(p => p.month === m);
    const paid = monthPayments.reduce((s, p) => s + p.amountPaid, 0);
    totalPaid += paid;
    const history = monthPayments.flatMap(p => p.history || []);
    rows.push({ month: MONTHS[m - 1], paid, history });
  }
  const totalDue = getTotalDueUpTo(year, currentMonth);

  const receiptNo = `R-${currentYearNum}-RECAP-${member.id.substring(0, 6).toUpperCase()}`;

  const buffer = await renderPdf({ margin: 40, size: 'A5' }, (doc) => {
    renderReceiptHeader(doc, association, 14);
    doc.moveDown(0.3);
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text('Reçu récapitulatif', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica').fillColor('#666').text(`N° ${receiptNo}`, { align: 'center' });
    doc.moveDown(0.8).fillColor('#000');

    doc.fontSize(11).font('Helvetica-Bold').text('Membre : ', { continued: true })
       .font('Helvetica').text(member.name);
    doc.fontSize(11).font('Helvetica-Bold').text('Année : ', { continued: true })
       .font('Helvetica').text(`${currentYearNum} (Janvier à ${MONTHS[currentMonth - 1]})`);
    doc.moveDown(0.6);

    // Détail par mois (de janvier au mois actuel)
    for (const r of rows) {
      doc.fontSize(10).font('Helvetica').fillColor('#666').text(`${r.month} :`, { continued: true });
      doc.fillColor('#000').text(`  ${fcfa(r.paid)} FCFA`);
      if (r.history && r.history.length > 1) {
        for (const h of r.history) {
          if (h.amount > 0) {
            doc.fontSize(8).font('Helvetica').fillColor('#888').text(`   - ${new Date(h.paymentDate).toLocaleDateString('fr-FR')} : ${fcfa(h.amount)} FCFA`);
          }
        }
        doc.fillColor('#000');
      }
      doc.moveDown(0.2);
    }

    doc.moveDown(0.6);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(totalPaid >= totalDue ? '#2E7D32' : '#B26A00').text(`Total payé : ${fcfa(totalPaid)} FCFA`);
    doc.fontSize(9).font('Helvetica').fillColor('#444').text(`La somme de : ${enLettres(totalPaid)}`);
    doc.fillColor('#000');
    doc.fontSize(11).font('Helvetica-Bold').text(`Total dû : ${fcfa(totalDue)} FCFA`);
    doc.fontSize(10).font('Helvetica').fillColor(totalDue - totalPaid > 0 ? '#B00020' : '#2E7D32').text(`Reste à payer : ${fcfa(Math.max(0, totalDue - totalPaid))} FCFA`);
    doc.fillColor('#000');

    doc.moveDown(0.6);
    doc.fontSize(9).font('Helvetica').fillColor('#666').text(`État au ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.fillColor('#000');

    renderSignature(doc, association);
  });
  return { buffer, contentType: PDF_TYPE, filename: `recu_recap_${receiptNo}.pdf` };
}

// Calcul commun pour l'appel de charges (PDF + Word)
async function getChargeNoticeData(associationId, memberId) {
  const member = await prisma.member.findFirst({
    where: { id: memberId, associationId }
  });
  if (!member) return { error: 'Membre introuvable', status: 404 };

  const now = new Date();
  const currentYearNum = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12 (mois actuel inclus)

  const year = await prisma.year.findFirst({
    where: { associationId, year: currentYearNum },
    include: { rateChanges: true }
  });
  if (!year) return { error: 'Aucune année de cotisation pour l\'année en cours', status: 404 };

  const association = await prisma.association.findUnique({ where: { id: associationId } });
  await attachSignature(prisma, association);
  const payments = await prisma.monthlyPayment.findMany({
    where: { memberId: member.id, yearId: year.id }
  });

  let totalPaid = 0;
  for (let m = 1; m <= currentMonth; m++) {
    totalPaid += payments.filter(p => p.month === m).reduce((s, p) => s + p.amountPaid, 0);
  }
  const totalDue = getTotalDueUpTo(year, currentMonth);
  const diff = Math.abs(totalDue - totalPaid);
  const safeName = (member.name || 'membre').replace(/[^a-zA-Z0-9]/g, '_');

  return { member, association, year, currentYearNum, currentMonth, totalPaid, totalDue, diff, safeName };
}

// Appel de charges (lettre formelle A4) en PDF
export async function generateChargeNoticePdf({ associationId, memberId }) {
  const data = await getChargeNoticeData(associationId, memberId);
  if (data.error) return data;
  const { member, association, year, currentYearNum, currentMonth, totalPaid, totalDue, diff, safeName } = data;

  const buffer = await renderPdf({ margin: 50, size: 'A4' }, (doc) => {
    // En-tête + séparateur + date
    renderReceiptHeader(doc, association, 16);
    const noticeMarginX = doc.page.margins.left;
    const noticePageW = doc.page.width - noticeMarginX * 2;
    doc.fontSize(10).font('Helvetica').fillColor('#000')
       .text(`Le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(signerHeading(association));
    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold')
       .text(`Objet : Appel de charges — ${MONTHS[currentMonth - 1]} ${currentYearNum}`);
    doc.moveDown(1);
    doc.fontSize(11).font('Helvetica').text(`Monsieur/Madame ${member.name}`);
    if (member.customFieldValue) {
      doc.text(`${association?.memberFieldLabel || 'Villa'} ${member.customFieldValue}`);
    }
    doc.moveDown(1);
    doc.fontSize(11).font('Helvetica')
       .text('Je vous informe de l\'état actuel de votre compte de charges à ce jour :');
    doc.moveDown(0.6);
    const noticeBoxY = doc.y;
    const noticeBoxH = 100;
    doc.save();
    doc.roundedRect(noticeMarginX, noticeBoxY, noticePageW, noticeBoxH, 4).fill('#F2F7F2');
    doc.restore();
    let ny = noticeBoxY + 12;
    const noticeLine = (label, value, valueColor) => {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#444').text(label, noticeMarginX + 14, ny, { continued: true });
      doc.font('Helvetica').fillColor(valueColor || '#000').text(` ${value}`);
      ny += 17;
    };
    noticeLine('Charges mensuelles :', year.rateChanges?.length > 0 ? 'Cotisation variable (voir détail)' : `${fcfa(year.monthlyAmount)} FCFA`);
    noticeLine('Période :', `Janvier à ${MONTHS[currentMonth - 1]} ${currentYearNum} soit ${currentMonth} mois`);
    noticeLine('Montant dû :', `${fcfa(totalDue)} FCFA`);
    noticeLine('Montant payé :', `${fcfa(totalPaid)} FCFA`, totalPaid >= totalDue ? '#2E7D32' : '#B26A00');
    if (totalDue > totalPaid) {
      noticeLine('Reste dû :', `${fcfa(diff)} FCFA`, '#B00020');
    } else {
      noticeLine('Avance :', `${fcfa(diff)} FCFA`, '#2E7D32');
    }
    doc.y = noticeBoxY + noticeBoxH + 14;
    doc.fillColor('#000');
    doc.fontSize(11).font('Helvetica')
       .text('Nous vous rappelons que ces charges sont essentielles au bon fonctionnement et à l\'entretien de la copropriété. Merci de bien vouloir régulariser votre situation dans les meilleurs délais.', { align: 'justify' });
    if (association?.paymentInfo) {
      doc.moveDown(0.8);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2E7D32').text(association.paymentInfo);
      doc.fillColor('#000');
    }
    renderSignature(doc, association);
  });
  return { buffer, contentType: PDF_TYPE, filename: `appel_charges_${safeName}.pdf` };
}

// Même appel de charges au format Word (.docx)
export async function generateChargeNoticeWord({ associationId, memberId }) {
  const data = await getChargeNoticeData(associationId, memberId);
  if (data.error) return data;
  const { member, association, year, currentYearNum, currentMonth, totalPaid, totalDue, diff, safeName } = data;

  const d = await import('docx');
  const { Document, Paragraph, TextRun, AlignmentType, Packer } = d;

  const restLabel = totalDue > totalPaid ? 'Reste dû : ' : 'Avance : ';

  const children = [];

  // Cadre d'en-tête automatique (nom de la cité/association + lignes d'en-tête)
  children.push(...docxHeader(d, association));

  // Date du jour alignée à droite
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200 },
    children: [new TextRun(`Le ${new Date().toLocaleDateString('fr-FR')}`)]
  }));

  // LE SYNDIC
  children.push(new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ text: signerHeading(association), bold: true })]
  }));

  // Objet
  children.push(new Paragraph({
    spacing: { before: 300 },
    children: [new TextRun({ text: `Objet : Appel de charges — ${MONTHS[currentMonth - 1]} ${currentYearNum}`, bold: true })]
  }));

  // Destinataire
  children.push(new Paragraph({
    spacing: { before: 300 },
    children: [new TextRun(`Monsieur/Madame ${member.name}`)]
  }));
  if (member.customFieldValue) {
    children.push(new Paragraph({
      children: [new TextRun(`${association?.memberFieldLabel || 'Villa'} ${member.customFieldValue}`)]
    }));
  }

  // Corps
  children.push(new Paragraph({
    spacing: { before: 300 },
    children: [new TextRun('Je vous informe de l\'état actuel de votre compte de charges à ce jour :')]
  }));

  const lineBold = (label, value, before, valueColor) => new Paragraph({
    spacing: before ? { before } : undefined,
    shading: { fill: 'F2F7F2', type: 'clear', color: 'auto' },
    children: [
      new TextRun({ text: label, bold: true, color: '444444' }),
      new TextRun({ text: value, color: valueColor || '000000' })
    ]
  });
  const montantPayeColor = totalPaid >= totalDue ? '2E7D32' : 'B26A00';
  const resteColor = totalDue > totalPaid ? 'B00020' : '2E7D32';
  children.push(lineBold('Charges mensuelles : ', year.rateChanges?.length > 0 ? 'Cotisation variable (voir détail)' : `${fcfa(year.monthlyAmount)} FCFA`, 200));
  children.push(lineBold('Période : ', `Janvier à ${MONTHS[currentMonth - 1]} ${currentYearNum} soit ${currentMonth} mois`));
  children.push(lineBold('Montant dû : ', `${fcfa(totalDue)} FCFA`));
  children.push(lineBold('Montant payé : ', `${fcfa(totalPaid)} FCFA`, undefined, montantPayeColor));
  children.push(lineBold(restLabel, `${fcfa(diff)} FCFA`, undefined, resteColor));

  // Paragraphe de rappel
  children.push(new Paragraph({
    spacing: { before: 300 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun('Nous vous rappelons que ces charges sont essentielles au bon fonctionnement et à l\'entretien de la copropriété. Merci de bien vouloir régulariser votre situation dans les meilleurs délais.')]
  }));

  if (association?.paymentInfo) {
    children.push(new Paragraph({
      spacing: { before: 300 },
      children: [new TextRun({ text: association.paymentInfo, bold: true, color: '2E7D32' })]
    }));
  }

  // Bloc signature (image manuscrite + ligne + nom/titre)
  children.push(...docxSignature(d, association));

  const docx = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(docx);
  return { buffer, contentType: DOCX_TYPE, filename: `appel_charges_${safeName}.docx` };
}

// Générateur par type de lien de partage
export const SHARE_GENERATORS = {
  RECEIPT: ({ associationId, targetId }) => generateReceipt({ associationId, paymentId: targetId }),
  RECEIPT_RECAP: ({ associationId, targetId }) => generateReceiptRecap({ associationId, memberId: targetId }),
  CHARGE_NOTICE_PDF: ({ associationId, targetId }) => generateChargeNoticePdf({ associationId, memberId: targetId }),
  CHARGE_NOTICE_WORD: ({ associationId, targetId }) => generateChargeNoticeWord({ associationId, memberId: targetId }),
};

// Envoi d'un document généré (ou de son erreur) dans la réponse HTTP
export function sendDocument(res, result, disposition = 'attachment') {
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `${disposition}; filename="${result.filename}"`);
  res.send(result.buffer);
}
