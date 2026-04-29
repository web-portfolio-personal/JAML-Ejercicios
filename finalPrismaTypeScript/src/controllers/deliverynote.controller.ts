import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import prisma from '../lib/prisma';
import AppError from '../utils/AppError';
import { generateDeliveryNotePdf } from '../services/pdf.service';
import { uploadImage, uploadPdf } from '../services/storage.service';

type AuthRequest = Request & { user: User };

interface Worker {
  name: string;
  hours: number;
}

const buildOrderBy = (sortStr: string): Record<string, 'asc' | 'desc'> => {
  const field = sortStr.startsWith('-') ? sortStr.slice(1) : sortStr;
  const order = sortStr.startsWith('-') ? 'desc' : 'asc';
  return { [field]: order };
};

// 1. Crear albaran
export const createDeliveryNote = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user.companyId) {
    return next(AppError.badRequest('Debes pertenecer a una empresa para crear albaranes'));
  }

  const {
    client, project, format, description, workDate,
    material, quantity, unit, hours, workers,
  } = req.body as {
    client: string;
    project: string;
    format: string;
    description?: string;
    workDate: Date;
    material?: string;
    quantity?: number;
    unit?: string;
    hours?: number;
    workers?: Worker[];
  };

  const [clientDoc, projectDoc] = await Promise.all([
    prisma.client.findFirst({ where: { id: client, companyId: req.user.companyId, deleted: false } }),
    prisma.project.findFirst({ where: { id: project, companyId: req.user.companyId, deleted: false } }),
  ]);

  if (!clientDoc)  return next(AppError.notFound('Cliente no encontrado en tu compania'));
  if (!projectDoc) return next(AppError.notFound('Proyecto no encontrado en tu compania'));

  if (projectDoc.clientId !== clientDoc.id) {
    return next(AppError.badRequest('El proyecto no pertenece a este cliente'));
  }

  const note = await prisma.deliveryNote.create({
    data: {
      userId:      req.user.id,
      companyId:   req.user.companyId,
      clientId:    client,
      projectId:   project,
      format,
      description,
      workDate:    new Date(workDate),
      material,
      quantity,
      unit,
      hours,
      workers:     workers ? JSON.stringify(workers) : undefined,
    },
  });

  const io = req.app.get('io');
  if (io) io.to(req.user.companyId).emit('deliverynote:new', { note });

  res.status(201).json({ note });
};

// 2. Listar albaranes
export const listDeliveryNotes = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user.companyId) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const query = req.query as {
    page?: number;
    limit?: number;
    project?: string;
    client?: string;
    format?: string;
    signed?: boolean;
    from?: Date;
    to?: Date;
    sort?: string;
  };

  const page  = Number(query.page)  || 1;
  const limit = Number(query.limit) || 10;
  const skip  = (page - 1) * limit;

  const where = {
    companyId: req.user.companyId,
    deleted:   false,
    ...(query.project ? { projectId: query.project }   : {}),
    ...(query.client  ? { clientId:  query.client  }   : {}),
    ...(query.format  ? { format:    query.format   }   : {}),
    ...(query.signed !== undefined ? { signed: query.signed } : {}),
    ...((query.from || query.to) ? {
      workDate: {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to   ? { lte: new Date(query.to)   } : {}),
      },
    } : {}),
  };

  const orderBy = buildOrderBy(query.sort || '-workDate');

  const [items, total] = await Promise.all([
    prisma.deliveryNote.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        client:  { select: { id: true, name: true, cif: true } },
        project: { select: { id: true, name: true, projectCode: true } },
      },
    }),
    prisma.deliveryNote.count({ where }),
  ]);

  res.json({
    notes:       items,
    totalItems:  total,
    totalPages:  Math.ceil(total / limit),
    currentPage: page,
  });
};

// 3. Obtener albaran
export const getDeliveryNote = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const note = await prisma.deliveryNote.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   false,
    },
    include: {
      user:    { select: { id: true, name: true, lastName: true, email: true, nif: true } },
      client:  { select: { id: true, name: true, cif: true, email: true, phone: true, address: true } },
      project: { select: { id: true, name: true, projectCode: true, email: true, address: true } },
    },
  });

  if (!note) return next(AppError.notFound('Albaran no encontrado'));

  res.json({ note });
};

// 4. Descargar PDF
export const downloadPdf = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const note = await prisma.deliveryNote.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   false,
    },
    include: {
      user:    { select: { id: true, name: true, lastName: true, email: true, nif: true } },
      client:  { select: { id: true, name: true, cif: true, email: true } },
      project: { select: { id: true, name: true, projectCode: true } },
    },
  });

  if (!note) return next(AppError.notFound('Albaran no encontrado'));

  // Si ya tiene PDF firmado en la nube, redirigir
  if (note.signed && note.pdfUrl) {
    res.redirect(note.pdfUrl);
    return;
  }

  const pdfBuffer = await generateDeliveryNotePdf({
    note: {
      id:           note.id,
      workDate:     note.workDate,
      format:       note.format,
      description:  note.description,
      material:     note.material,
      quantity:     note.quantity,
      unit:         note.unit,
      hours:        note.hours,
      workers:      note.workers,
      signed:       note.signed,
      signedAt:     note.signedAt,
      signatureUrl: note.signatureUrl,
    },
    user:    note.user,
    client:  note.client,
    project: note.project,
  });

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `inline; filename="albaran-${note.id}.pdf"`,
    'Content-Length':      String(pdfBuffer.length),
  });
  res.send(pdfBuffer);
};

// 5. Firmar albaran
export const signDeliveryNote = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const note = await prisma.deliveryNote.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   false,
    },
  });

  if (!note) return next(AppError.notFound('Albaran no encontrado'));
  if (note.signed) return next(AppError.badRequest('El albaran ya esta firmado'));

  if (!req.file) {
    return next(AppError.badRequest('Se requiere la imagen de la firma'));
  }

  const signatureUrl = await uploadImage(
    req.file.buffer,
    'bildyapp/signatures',
    `signature-${note.id}`
  );

  const signedNote = await prisma.deliveryNote.update({
    where: { id: note.id },
    data: {
      signed:       true,
      signedAt:     new Date(),
      signatureUrl,
    },
    include: {
      user:    { select: { id: true, name: true, lastName: true, email: true, nif: true } },
      client:  { select: { id: true, name: true, cif: true, email: true } },
      project: { select: { id: true, name: true, projectCode: true } },
    },
  });

  const pdfBuffer = await generateDeliveryNotePdf({
    note: {
      id:           signedNote.id,
      workDate:     signedNote.workDate,
      format:       signedNote.format,
      description:  signedNote.description,
      material:     signedNote.material,
      quantity:     signedNote.quantity,
      unit:         signedNote.unit,
      hours:        signedNote.hours,
      workers:      signedNote.workers,
      signed:       signedNote.signed,
      signedAt:     signedNote.signedAt,
      signatureUrl: signedNote.signatureUrl,
    },
    user:    signedNote.user,
    client:  signedNote.client,
    project: signedNote.project,
  });

  const pdfUrl = await uploadPdf(pdfBuffer, 'bildyapp/pdfs', `albaran-${signedNote.id}`);

  const finalNote = await prisma.deliveryNote.update({
    where: { id: signedNote.id },
    data: { pdfUrl },
  });

  const io = req.app.get('io');
  if (io) io.to(req.user.companyId!).emit('deliverynote:signed', { noteId: finalNote.id });

  res.json({ message: 'Albaran firmado correctamente', note: finalNote });
};

// 6. Eliminar albaran
export const deleteDeliveryNote = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const note = await prisma.deliveryNote.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   false,
    },
  });

  if (!note) return next(AppError.notFound('Albaran no encontrado'));
  if (note.signed) return next(AppError.badRequest('No se puede eliminar un albaran firmado'));

  await prisma.deliveryNote.delete({ where: { id: note.id } });
  res.json({ message: 'Albaran eliminado correctamente' });
};
