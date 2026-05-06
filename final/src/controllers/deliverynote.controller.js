import DeliveryNote from '../models/DeliveryNote.js';
import Project from '../models/Project.js';
import Client from '../models/Client.js';
import AppError from '../utils/AppError.js';
import { generateDeliveryNotePdf } from '../services/pdf.service.js';
import { uploadImage, uploadPdf } from '../services/storage.service.js';

const buildSort = (sortStr) => {
  const field = sortStr.startsWith('-') ? sortStr.slice(1) : sortStr;
  const order = sortStr.startsWith('-') ? -1 : 1;
  return { [field]: order };
};

// ── Helper: verificar que nota pertenece a la compañía ────────────────────────

const findNote = async (id, company, allowDeleted = false) => {
  const filter = { _id: id, company };
  if (!allowDeleted) filter.deleted = false;
  return DeliveryNote.findOne(filter);
};

// ── 1. Crear albarán ──────────────────────────────────────────────────────────

export const createDeliveryNote = async (req, res, next) => {
  if (!req.user.company) {
    return next(AppError.badRequest('Debes pertenecer a una empresa para crear albaranes'));
  }

  const { client, project, format, description, workDate,
          material, quantity, unit, hours, workers } = req.body;

  // Verificar que cliente y proyecto pertenecen a la compañía
  const [clientDoc, projectDoc] = await Promise.all([
    Client.findOne({ _id: client, company: req.user.company, deleted: false }),
    Project.findOne({ _id: project, company: req.user.company, deleted: false }),
  ]);

  if (!clientDoc)  return next(AppError.notFound('Cliente no encontrado en tu compañía'));
  if (!projectDoc) return next(AppError.notFound('Proyecto no encontrado en tu compañía'));

  // Verificar que el proyecto pertenece al cliente
  if (projectDoc.client.toString() !== clientDoc._id.toString()) {
    return next(AppError.badRequest('El proyecto no pertenece a este cliente'));
  }

  const note = await DeliveryNote.create({
    user:    req.user._id,
    company: req.user.company,
    client,
    project,
    format,
    description,
    workDate,
    material,
    quantity,
    unit,
    hours,
    workers,
  });

  // Emitir evento Socket.IO
  const io = req.app.get('io');
  io?.to(req.user.company.toString()).emit('deliverynote:new', { note });

  res.status(201).json({ note });
};

// ── 2. Listar albaranes ───────────────────────────────────────────────────────

export const listDeliveryNotes = async (req, res, next) => {
  if (!req.user.company) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const { page = 1, limit = 10, project, client, format, signed, from, to, sort = '-workDate' } = req.query;
  const skip = (page - 1) * limit;

  const filter = { company: req.user.company, deleted: false };
  if (project) filter.project = project;
  if (client)  filter.client  = client;
  if (format)  filter.format  = format;
  if (signed !== undefined) filter.signed = signed === 'true';
  if (from || to) {
    filter.workDate = {};
    if (from) filter.workDate.$gte = new Date(from);
    if (to)   filter.workDate.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    DeliveryNote.find(filter)
      .populate('client',  'name cif')
      .populate('project', 'name projectCode')
      .sort(buildSort(sort))
      .skip(skip)
      .limit(Number(limit)),
    DeliveryNote.countDocuments(filter),
  ]);

  res.json({
    notes:       items,
    totalItems:  total,
    totalPages:  Math.ceil(total / limit),
    currentPage: Number(page),
  });
};

// ── 3. Obtener albarán ────────────────────────────────────────────────────────

export const getDeliveryNote = async (req, res, next) => {
  const note = await DeliveryNote.findOne({
    _id:     req.params.id,
    company: req.user.company,
    deleted: false,
  })
    .populate('user',    'name lastName email nif')
    .populate('client',  'name cif email phone address')
    .populate('project', 'name projectCode email address');

  if (!note) return next(AppError.notFound('Albarán no encontrado'));

  res.json({ note });
};

// ── 4. Descargar PDF ──────────────────────────────────────────────────────────

export const downloadPdf = async (req, res, next) => {
  const note = await DeliveryNote.findOne({
    _id:     req.params.id,
    company: req.user.company,
    deleted: false,
  })
    .populate('user',    'name lastName email nif')
    .populate('client',  'name cif email')
    .populate('project', 'name projectCode');

  if (!note) return next(AppError.notFound('Albarán no encontrado'));

  // Si ya tiene PDF firmado en la nube, redirigir
  if (note.signed && note.pdfUrl) {
    return res.redirect(note.pdfUrl);
  }

  // Generar PDF al vuelo
  const pdfBuffer = await generateDeliveryNotePdf({
    note,
    user:    note.user,
    client:  note.client,
    project: note.project,
  });

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `inline; filename="albaran-${note._id}.pdf"`,
    'Content-Length':      pdfBuffer.length,
  });
  res.send(pdfBuffer);
};

// ── 5. Firmar albarán ─────────────────────────────────────────────────────────

export const signDeliveryNote = async (req, res, next) => {
  const note = await findNote(req.params.id, req.user.company);

  if (!note) return next(AppError.notFound('Albarán no encontrado'));
  if (note.signed) return next(AppError.badRequest('El albarán ya está firmado'));

  if (!req.file) {
    return next(AppError.badRequest('Se requiere la imagen de la firma'));
  }

  /* c8 ignore start */ /* istanbul ignore next -- Requiere Cloudinary, no disponible en tests */
  // Subir firma a Cloudinary (Sharp aplica resize + WebP en uploadImage)
  const signatureUrl = await uploadImage(
    req.file.buffer,
    'bildyapp/signatures',
    `signature-${note._id}`
  );

  note.signed       = true;
  note.signedAt     = new Date();
  note.signatureUrl = signatureUrl;

  await note.save();

  // Poblar para generar PDF
  await note.populate([
    { path: 'user',    select: 'name lastName email nif' },
    { path: 'client',  select: 'name cif email' },
    { path: 'project', select: 'name projectCode' },
  ]);

  // Generar y subir PDF firmado
  const pdfBuffer = await generateDeliveryNotePdf({
    note,
    user:    note.user,
    client:  note.client,
    project: note.project,
  });

  const pdfUrl = await uploadPdf(
    pdfBuffer,
    'bildyapp/pdfs',
    `albaran-${note._id}`
  );

  note.pdfUrl = pdfUrl;
  await note.save();

  // Emitir evento Socket.IO
  const io = req.app.get('io');
  io?.to(req.user.company.toString()).emit('deliverynote:signed', { noteId: note._id });

  res.json({ message: 'Albarán firmado correctamente', note });
  /* c8 ignore stop */
};

// ── 6. Eliminar albarán ───────────────────────────────────────────────────────

export const deleteDeliveryNote = async (req, res, next) => {
  const note = await findNote(req.params.id, req.user.company);

  if (!note) return next(AppError.notFound('Albarán no encontrado'));
  if (note.signed) return next(AppError.badRequest('No se puede eliminar un albarán firmado'));

  await note.deleteOne();
  res.json({ message: 'Albarán eliminado correctamente' });
};
