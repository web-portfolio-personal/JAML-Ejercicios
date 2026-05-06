import Client from '../models/Client.js';
import AppError from '../utils/AppError.js';

// ── Helper: ordenación ────────────────────────────────────────────────────────

const buildSort = (sortStr) => {
  const field = sortStr.startsWith('-') ? sortStr.slice(1) : sortStr;
  const order = sortStr.startsWith('-') ? -1 : 1;
  return { [field]: order };
};

// ── 1. Crear cliente ──────────────────────────────────────────────────────────

export const createClient = async (req, res, next) => {
  if (!req.user.company) {
    return next(AppError.badRequest('Debes pertenecer a una empresa para crear clientes'));
  }

  const { name, cif, email, phone, address } = req.body;

  const existing = await Client.findOne({ company: req.user.company, cif });
  if (existing) {
    return next(AppError.conflict('Ya existe un cliente con ese CIF en tu compañía'));
  }

  const client = await Client.create({
    user:    req.user._id,
    company: req.user.company,
    name,
    cif,
    email,
    phone,
    address,
  });

  // Emitir evento Socket.IO a la sala de la compañía
  const io = req.app.get('io');
  io?.to(req.user.company.toString()).emit('client:new', { client });

  res.status(201).json({ client });
};

// ── 2. Listar clientes activos ────────────────────────────────────────────────

export const listClients = async (req, res, next) => {
  if (!req.user.company) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const { page = 1, limit = 10, name, sort = '-createdAt' } = req.query;
  const skip = (page - 1) * limit;

  const filter = { company: req.user.company, deleted: false };
  if (name) filter.name = { $regex: name, $options: 'i' };

  const [items, total] = await Promise.all([
    Client.find(filter).sort(buildSort(sort)).skip(skip).limit(Number(limit)),
    Client.countDocuments(filter),
  ]);

  res.json({
    clients: items,
    totalItems:  total,
    totalPages:  Math.ceil(total / limit),
    currentPage: Number(page),
  });
};

// ── 3. Obtener un cliente ─────────────────────────────────────────────────────

export const getClient = async (req, res, next) => {
  const client = await Client.findOne({
    _id:     req.params.id,
    company: req.user.company,
    deleted: false,
  });

  if (!client) return next(AppError.notFound('Cliente no encontrado'));

  res.json({ client });
};

// ── 4. Actualizar cliente ─────────────────────────────────────────────────────

export const updateClient = async (req, res, next) => {
  const client = await Client.findOne({
    _id:     req.params.id,
    company: req.user.company,
    deleted: false,
  });

  if (!client) return next(AppError.notFound('Cliente no encontrado'));

  // Verificar CIF duplicado si se cambia
  if (req.body.cif && req.body.cif !== client.cif) {
    const dup = await Client.findOne({ company: req.user.company, cif: req.body.cif });
    if (dup) return next(AppError.conflict('Ya existe un cliente con ese CIF'));
  }

  Object.assign(client, req.body);
  await client.save();

  res.json({ client });
};

// ── 5. Eliminar / archivar cliente ────────────────────────────────────────────

export const deleteClient = async (req, res, next) => {
  const client = await Client.findOne({
    _id:     req.params.id,
    company: req.user.company,
    deleted: false,
  });

  if (!client) return next(AppError.notFound('Cliente no encontrado'));

  const soft = req.query.soft === 'true';

  if (soft) {
    client.deleted   = true;
    client.deletedAt = new Date();
    await client.save();
    return res.json({ message: 'Cliente archivado correctamente (soft delete)' });
  }

  await client.deleteOne();
  res.json({ message: 'Cliente eliminado permanentemente' });
};

// ── 6. Listar clientes archivados ─────────────────────────────────────────────

export const listArchivedClients = async (req, res, next) => {
  if (!req.user.company) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const clients = await Client.find({ company: req.user.company, deleted: true })
    .sort('-deletedAt');

  res.json({ clients });
};

// ── 7. Restaurar cliente archivado ────────────────────────────────────────────

export const restoreClient = async (req, res, next) => {
  const client = await Client.findOne({
    _id:     req.params.id,
    company: req.user.company,
    deleted: true,
  });

  if (!client) return next(AppError.notFound('Cliente archivado no encontrado'));

  client.deleted   = false;
  client.deletedAt = null;
  await client.save();

  res.json({ message: 'Cliente restaurado correctamente', client });
};
