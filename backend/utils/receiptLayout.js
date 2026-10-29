// Mise en page commune des reçus et appels de charges (PDF + Word)
// - Cadre d'en-tête automatique : nom de l'association/cité (+ "SYNDIC" si syndic) + lignes de receiptHeader
// - Bloc signature : image de signature manuscrite (si enregistrée) + ligne + texte receiptSignature

const MAX_SIGNATURE_BYTES = 300 * 1024; // 300 Ko après décodage

// Lit largeur/hauteur d'un PNG (chunk IHDR)
export function pngSize(buf) {
  if (!buf || buf.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// Valide une data URL PNG envoyée par le client. Retourne { ok, error, dataUrl }
export function validateSignatureDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    return { ok: false, error: 'Format invalide : image PNG attendue' };
  }
  const buf = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  if (buf.length > MAX_SIGNATURE_BYTES) {
    return { ok: false, error: 'Image trop lourde (300 Ko maximum)' };
  }
  const size = pngSize(buf);
  if (!size || size.w < 10 || size.h < 10 || size.w > 2000 || size.h > 2000) {
    return { ok: false, error: 'Image PNG invalide' };
  }
  return { ok: true, dataUrl };
}

// Charge la signature manuscrite et le cachet (table séparée, pour ne pas alourdir chaque requête)
// et les attache à l'objet association : _signatureImage/_signatureSize et _stampImage/_stampSize
function decodePng(dataUrl) {
  if (!dataUrl) return null;
  const buf = Buffer.from(String(dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64');
  const size = pngSize(buf);
  return size ? { buf, size } : null;
}

export async function attachSignature(prisma, association) {
  if (!association?.id) return association;
  try {
    const row = await prisma.associationSignature.findUnique({ where: { associationId: association.id } });
    const sig = decodePng(row?.imageData);
    if (sig) { association._signatureImage = sig.buf; association._signatureSize = sig.size; }
    const stamp = decodePng(row?.stampData);
    if (stamp) { association._stampImage = stamp.buf; association._stampSize = stamp.size; }
  } catch (e) {
    console.error('attachSignature error:', e.message);
  }
  return association;
}

// Lignes sous la signature : nom (gras) + titre ; sinon ancien texte libre receiptSignature
export function signerLines(association) {
  const name = String(association?.signerName || '').trim();
  const title = String(association?.signerTitle || '').trim();
  if (name || title) {
    const out = [];
    if (name) out.push({ text: name.toUpperCase(), bold: true });
    if (title) out.push({ text: title.toUpperCase(), bold: false });
    return out;
  }
  return String(association?.receiptSignature || '')
    .split('\n').map((t) => t.trim()).filter(Boolean)
    .map((t) => ({ text: t, bold: false }));
}

// Ligne "LE SYNDIC" de l'appel de charges : titre du signataire si renseigné
export function signerHeading(association) {
  const title = String(association?.signerTitle || '').trim();
  return (title || 'Le Syndic').toUpperCase();
}

// Lignes du cadre d'en-tête
export function headerLines(association) {
  const lines = [];
  const name = String(association?.name || '').trim();
  const isSyndic = /^syndic/i.test(String(association?.type || ''));
  if (isSyndic && !/syndic/i.test(name)) lines.push({ text: 'SYNDIC', style: 'label' });
  if (name) lines.push({ text: name.toUpperCase(), style: 'title' });
  String(association?.receiptHeader || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((l) => l.toLowerCase() !== name.toLowerCase())
    .forEach((t) => lines.push({ text: t, style: 'normal' }));
  return lines;
}

// ===================== PDF (pdfkit) =====================

// Cadre en haut à gauche avec le nom de la cité/association
export function renderReceiptHeader(doc, association, size) {
  const lines = headerLines(association);
  const marginX = doc.page.margins.left;
  const pageW = doc.page.width - marginX * 2;
  if (lines.length === 0) {
    doc.moveDown(1.2);
    return;
  }
  const titleSize = Math.min(size || 14, 16);
  const sizes = { label: titleSize - 3, title: titleSize, normal: titleSize - 4 };
  const fonts = { label: 'Helvetica-Bold', title: 'Helvetica-Bold', normal: 'Helvetica' };
  const pad = 8;
  const boxW = Math.min(Math.max(pageW * 0.6, 200), pageW);
  const innerW = boxW - pad * 2;

  let h = 0;
  for (const l of lines) {
    doc.fontSize(sizes[l.style]).font(fonts[l.style]);
    h += doc.heightOfString(l.text, { width: innerW, align: 'center' }) + 1;
  }
  const boxX = marginX;
  const boxY = doc.y;
  const boxH = h + pad * 2;

  doc.save();
  doc.lineWidth(1.2).strokeColor('#333333').roundedRect(boxX, boxY, boxW, boxH, 4).stroke();
  doc.restore();

  let y = boxY + pad;
  for (const l of lines) {
    doc.fontSize(sizes[l.style]).font(fonts[l.style]).fillColor(l.style === 'label' ? '#444444' : '#000000');
    doc.text(l.text, boxX + pad, y, { width: innerW, align: 'center' });
    y = doc.y + 1;
  }
  doc.fillColor('#000000').font('Helvetica');
  doc.x = marginX;
  doc.y = boxY + boxH + 10;
}

// Bloc signature en bas à droite : "Signature", image manuscrite, ligne, nom + titre.
// Le cachet (facultatif) est posé à gauche du bloc, comme un tampon à côté de la signature.
export function renderSignature(doc, association) {
  const img = association?._signatureImage;
  const imgSize = association?._signatureSize;
  const stamp = association?._stampImage;
  const stampSize = association?._stampSize;
  const lines = signerLines(association);
  const blockW = 200;
  const imgMaxH = 60;
  const stampBox = 80;

  doc.fontSize(10).font('Helvetica');
  const textH = lines.reduce((h, l) => h + doc.heightOfString(l.text, { width: blockW, align: 'center' }), 0);
  const needed = 12 + (img ? imgMaxH + 4 : 28) + 6 + textH;
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + 24 + Math.max(needed, stamp ? stampBox : 0) > bottom) {
    doc.addPage();
  } else {
    doc.y += 24;
  }

  const marginX = doc.page.margins.left;
  const rightX = doc.page.width - doc.page.margins.right;
  const startX = rightX - blockW;
  const topY = doc.y;

  doc.fontSize(9).font('Helvetica').fillColor('#666666')
    .text('Signature', startX, topY, { width: blockW, align: 'center' });
  let y = doc.y + 2;

  if (img && imgSize) {
    const ratio = Math.min((blockW - 20) / imgSize.w, imgMaxH / imgSize.h);
    const w = imgSize.w * ratio;
    const h = imgSize.h * ratio;
    try {
      doc.image(img, startX + (blockW - w) / 2, y + (imgMaxH - h), { width: w, height: h });
    } catch (e) {
      console.error('Signature image render error:', e.message);
    }
    y += imgMaxH + 4;
  } else {
    y += 28;
  }
  const lineY = y;

  doc.save();
  doc.lineWidth(1).strokeColor('#000000').moveTo(startX, lineY).lineTo(rightX, lineY).stroke();
  doc.restore();

  y = lineY + 4;
  for (const l of lines) {
    doc.fontSize(10).font(l.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000000')
      .text(l.text, startX, y, { width: blockW, align: 'center' });
    y = doc.y;
  }
  const endY = Math.max(doc.y, lineY + 4);

  if (stamp && stampSize) {
    const ratio = Math.min(stampBox / stampSize.w, stampBox / stampSize.h);
    const w = stampSize.w * ratio;
    const h = stampSize.h * ratio;
    const sx = Math.max(marginX, startX - w - 6);
    const sy = Math.max(topY, lineY - h / 2 - 6);
    try {
      doc.image(stamp, sx, sy, { width: w, height: h });
    } catch (e) {
      console.error('Stamp image render error:', e.message);
    }
    doc.y = Math.max(endY, sy + h);
  } else {
    doc.y = endY;
  }
  doc.fillColor('#000000').font('Helvetica');
  doc.x = marginX;
}

// ===================== Word (docx) =====================

const DXA_A4_CONTENT = 9026; // largeur utile A4 avec marges par défaut (1440 dxa)

// Cadre d'en-tête en tableau 1 cellule bordé, aligné à gauche
export function docxHeader(d, association) {
  const lines = headerLines(association);
  if (lines.length === 0) return [];
  const sizes = { label: 22, title: 28, normal: 20 };
  const border = { style: d.BorderStyle.SINGLE, size: 12, color: '333333' };
  const width = Math.round(DXA_A4_CONTENT * 0.6);
  const paragraphs = lines.map((l) => new d.Paragraph({
    alignment: d.AlignmentType.CENTER,
    children: [new d.TextRun({
      text: l.text,
      bold: l.style !== 'normal',
      size: sizes[l.style],
      color: l.style === 'label' ? '444444' : '000000',
    })],
  }));
  return [
    new d.Table({
      width: { size: width, type: d.WidthType.DXA },
      columnWidths: [width],
      alignment: d.AlignmentType.LEFT,
      rows: [new d.TableRow({
        children: [new d.TableCell({
          width: { size: width, type: d.WidthType.DXA },
          borders: { top: border, bottom: border, left: border, right: border },
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          children: paragraphs,
        })],
      })],
    }),
    new d.Paragraph({ children: [] }),
  ];
}

// Bloc signature : tableau sans bordure aligné à droite.
// Colonne 1 (facultative) : cachet ; colonne 2 : "Signature" / image / ligne / nom + titre.
export function docxSignature(d, association) {
  const img = association?._signatureImage;
  const imgSize = association?._signatureSize;
  const stamp = association?._stampImage;
  const stampSize = association?._stampSize;
  const lines = signerLines(association);
  const none = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: none, bottom: none, left: none, right: none };
  const sigW = 3600; // ~6,3 cm
  const stampW = 1700; // ~3 cm

  const cell = [];
  cell.push(new d.Paragraph({
    alignment: d.AlignmentType.CENTER,
    children: [new d.TextRun({ text: 'Signature', size: 18, color: '666666' })],
  }));
  if (img && imgSize) {
    const ratio = Math.min(200 / imgSize.w, 70 / imgSize.h);
    cell.push(new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      children: [new d.ImageRun({
        type: 'png',
        data: img,
        transformation: { width: Math.round(imgSize.w * ratio), height: Math.round(imgSize.h * ratio) },
      })],
    }));
  } else {
    cell.push(new d.Paragraph({ spacing: { before: 400 }, children: [] }));
  }
  cell.push(new d.Paragraph({
    border: { bottom: { style: d.BorderStyle.SINGLE, size: 8, color: '000000', space: 1 } },
    children: [],
  }));
  lines.forEach((l) => {
    cell.push(new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      children: [new d.TextRun({ text: l.text, bold: l.bold, size: 20 })],
    }));
  });

  const cells = [];
  const widths = [];
  if (stamp && stampSize) {
    const ratio = Math.min(95 / stampSize.w, 95 / stampSize.h);
    cells.push(new d.TableCell({
      width: { size: stampW, type: d.WidthType.DXA },
      borders: noBorders,
      verticalAlign: d.VerticalAlign.CENTER,
      children: [new d.Paragraph({
        alignment: d.AlignmentType.CENTER,
        children: [new d.ImageRun({
          type: 'png',
          data: stamp,
          transformation: { width: Math.round(stampSize.w * ratio), height: Math.round(stampSize.h * ratio) },
        })],
      })],
    }));
    widths.push(stampW);
  }
  cells.push(new d.TableCell({
    width: { size: sigW, type: d.WidthType.DXA },
    borders: noBorders,
    children: cell,
  }));
  widths.push(sigW);
  const total = widths.reduce((a, b) => a + b, 0);

  return [
    new d.Paragraph({ spacing: { before: 400 }, children: [] }),
    new d.Table({
      width: { size: total, type: d.WidthType.DXA },
      columnWidths: widths,
      alignment: d.AlignmentType.RIGHT,
      borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
      rows: [new d.TableRow({ children: cells })],
    }),
  ];
}
