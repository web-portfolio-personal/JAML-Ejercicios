import PDFDocument from 'pdfkit';

/**
 * Genera el PDF de un albarán y devuelve un Buffer.
 *
 * Si el albarán está firmado y tiene signatureUrl, descarga la imagen de la firma
 * y la incrusta directamente en el PDF usando pdfkit doc.image().
 * Si la descarga falla, muestra la URL como texto de respaldo.
 *
 * @param {Object} options
 * @param {Object} options.note - Documento DeliveryNote populado
 * @param {Object} options.user - Usuario que genera el PDF
 * @param {Object} options.client - Cliente del albarán
 * @param {Object} options.project - Proyecto del albarán
 * @returns {Promise<Buffer>}
 */
export const generateDeliveryNotePdf = async ({ note, user, client, project }) => {
  // Pre-descargar la imagen de firma antes de iniciar el stream del PDF
  let signatureBuffer = null;
  if (note.signed && note.signatureUrl) {
    try {
      const response = await fetch(note.signatureUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        signatureBuffer = Buffer.from(arrayBuffer);
      }
    } catch {
      // Error de red o URL inválida — se usará texto de respaldo
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data',  (chunk) => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Cabecera ────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('ALBARÁN', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Nº: ${note._id}`, { align: 'right' })
      .text(`Fecha: ${new Date(note.workDate).toLocaleDateString('es-ES')}`, { align: 'right' })
      .moveDown(1);

    // ── Línea divisoria ─────────────────────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(0.5);

    // ── Datos del emisor ────────────────────────────────────────────────────
    doc
      .font('Helvetica-Bold').fontSize(11).text('EMISOR')
      .font('Helvetica').fontSize(10)
      .text(`${user.name || ''} ${user.lastName || ''}`.trim())
      .text(user.email || '')
      .text(user.nif ? `NIF: ${user.nif}` : '')
      .moveDown(1);

    // ── Datos del cliente ───────────────────────────────────────────────────
    doc
      .font('Helvetica-Bold').fontSize(11).text('CLIENTE')
      .font('Helvetica').fontSize(10)
      .text(client?.name || '')
      .text(client?.cif ? `CIF: ${client.cif}` : '')
      .text(client?.email || '')
      .moveDown(1);

    // ── Datos del proyecto ──────────────────────────────────────────────────
    doc
      .font('Helvetica-Bold').fontSize(11).text('PROYECTO')
      .font('Helvetica').fontSize(10)
      .text(project?.name || '')
      .text(project?.projectCode ? `Código: ${project.projectCode}` : '')
      .moveDown(1);

    // ── Línea divisoria ─────────────────────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(0.5);

    // ── Contenido del albarán ───────────────────────────────────────────────
    doc
      .font('Helvetica-Bold').fontSize(12)
      .text(`TIPO: ${note.format === 'material' ? 'MATERIAL' : 'HORAS'}`)
      .moveDown(0.5);

    if (note.description) {
      doc.font('Helvetica').fontSize(10).text(`Descripción: ${note.description}`).moveDown(0.3);
    }

    if (note.format === 'material') {
      doc
        .font('Helvetica').fontSize(10)
        .text(`Material: ${note.material || ''}`)
        .text(`Cantidad: ${note.quantity ?? ''} ${note.unit || ''}`)
        .moveDown(1);
    } else {
      // Horas
      if (note.hours != null) {
        doc.font('Helvetica').fontSize(10).text(`Horas totales: ${note.hours}`).moveDown(0.3);
      }
      if (note.workers && note.workers.length > 0) {
        doc.font('Helvetica-Bold').fontSize(10).text('Trabajadores:').moveDown(0.2);
        note.workers.forEach((w) => {
          doc.font('Helvetica').fontSize(10).text(`  • ${w.name}: ${w.hours} h`);
        });
        doc.moveDown(1);
      }
    }

    // ── Firma ───────────────────────────────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(0.5);

    if (note.signed) {
      doc
        .font('Helvetica-Bold').fontSize(10)
        .text('FIRMADO', { align: 'center' })
        .font('Helvetica')
        .text(`Fecha de firma: ${new Date(note.signedAt).toLocaleDateString('es-ES')}`, { align: 'center' })
        .moveDown(0.5);

      if (signatureBuffer) {
        // Imagen de firma descargada — incrustar directamente en el PDF
        doc.image(signatureBuffer, {
          fit:   [200, 80],
          align: 'center',
        }).moveDown(0.5);
      } else if (note.signatureUrl) {
        // Fallback: URL no descargable (error de red) — mostrar referencia de texto
        doc.text(`Firma digital: ${note.signatureUrl}`, { align: 'center' });
      }
    } else {
      doc
        .font('Helvetica').fontSize(10)
        .text('Sin firmar', { align: 'center' });
    }

    doc.end();
  });
};
