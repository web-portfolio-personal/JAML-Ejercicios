import PDFDocument from 'pdfkit';

interface Worker {
  name: string;
  hours: number;
}

interface PdfNote {
  id: string;
  workDate: Date;
  format: string;
  description?: string | null;
  material?: string | null;
  quantity?: number | null;
  unit?: string | null;
  hours?: number | null;
  workers?: unknown;
  signed: boolean;
  signedAt?: Date | null;
  signatureUrl?: string | null;
}

interface PdfUser {
  name?: string | null;
  lastName?: string | null;
  email: string;
  nif?: string | null;
}

interface PdfClient {
  name?: string | null;
  cif?: string | null;
  email?: string | null;
}

interface PdfProject {
  name?: string | null;
  projectCode?: string | null;
}

interface GeneratePdfOptions {
  note: PdfNote;
  user: PdfUser;
  client: PdfClient;
  project: PdfProject;
}

/**
 * Genera el PDF de un albaran y devuelve un Buffer.
 */
export const generateDeliveryNotePdf = ({
  note,
  user,
  client,
  project,
}: GeneratePdfOptions): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data',  (chunk: Buffer) => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Cabecera
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('ALBARAN', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`No: ${note.id}`, { align: 'right' })
      .text(`Fecha: ${new Date(note.workDate).toLocaleDateString('es-ES')}`, { align: 'right' })
      .moveDown(1);

    // Linea divisoria
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(0.5);

    // Datos del emisor
    doc
      .font('Helvetica-Bold').fontSize(11).text('EMISOR')
      .font('Helvetica').fontSize(10)
      .text(`${user.name || ''} ${user.lastName || ''}`.trim())
      .text(user.email || '')
      .text(user.nif ? `NIF: ${user.nif}` : '')
      .moveDown(1);

    // Datos del cliente
    doc
      .font('Helvetica-Bold').fontSize(11).text('CLIENTE')
      .font('Helvetica').fontSize(10)
      .text(client?.name || '')
      .text(client?.cif ? `CIF: ${client.cif}` : '')
      .text(client?.email || '')
      .moveDown(1);

    // Datos del proyecto
    doc
      .font('Helvetica-Bold').fontSize(11).text('PROYECTO')
      .font('Helvetica').fontSize(10)
      .text(project?.name || '')
      .text(project?.projectCode ? `Codigo: ${project.projectCode}` : '')
      .moveDown(1);

    // Linea divisoria
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(0.5);

    // Contenido del albaran
    doc
      .font('Helvetica-Bold').fontSize(12)
      .text(`TIPO: ${note.format === 'material' ? 'MATERIAL' : 'HORAS'}`)
      .moveDown(0.5);

    if (note.description) {
      doc.font('Helvetica').fontSize(10).text(`Descripcion: ${note.description}`).moveDown(0.3);
    }

    if (note.format === 'material') {
      doc
        .font('Helvetica').fontSize(10)
        .text(`Material: ${note.material || ''}`)
        .text(`Cantidad: ${note.quantity ?? ''} ${note.unit || ''}`)
        .moveDown(1);
    } else {
      if (note.hours != null) {
        doc.font('Helvetica').fontSize(10).text(`Horas totales: ${note.hours}`).moveDown(0.3);
      }
      const workers = note.workers as Worker[] | null;
      if (workers && workers.length > 0) {
        doc.font('Helvetica-Bold').fontSize(10).text('Trabajadores:').moveDown(0.2);
        workers.forEach((w) => {
          doc.font('Helvetica').fontSize(10).text(`  - ${w.name}: ${w.hours} h`);
        });
        doc.moveDown(1);
      }
    }

    // Firma
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
        .text(
          `Fecha de firma: ${note.signedAt ? new Date(note.signedAt).toLocaleDateString('es-ES') : ''}`,
          { align: 'center' }
        )
        .moveDown(0.5);

      if (note.signatureUrl) {
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
