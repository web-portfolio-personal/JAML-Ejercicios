import Project from '../models/Project.js';
import Client from '../models/Client.js';
import AppError from '../utils/AppError.js';

const buildSort = (sortStr) => {
  const field = sortStr.startsWith('-') ? sortStr.slice(1) : sortStr;
  const order = sortStr.startsWith('-') ? -1 : 1;
  return { [field]: order };
};

// ── 1. Crear proyecto ─────────────────────────────────────────────────────────

export const createProject = async (req, res, next) => {
  if (!req.user.company) {
    return next(AppError.badRequest('Debes pertenecer a una empresa para crear proyectos'));
  }

  const { client, name, projectCode, address, email, notes, active } = req.body;

  // Verificar que el cliente pertenece a la misma compañía
  const clientDoc = await Client.findOne({
    _id:     client,
    company: req.user.company,
    deleted: false,
  });
  if (!clientDoc) {
    return next(AppError.notFound('Cliente no encontrado en tu compañía'));
  }

  // Verificar código único
  const existing = await Project.findOne({ company: req.user.company, projectCode });
  if (existing) {
    return next(AppError.conflict('Ya existe un proyecto con ese código en tu compañía'));
  }

  const project = await Project.create({
    user:    req.user._id,
    company: req.user.company,
    client,
    name,
    projectCode,
    address,
    email,
    notes,
    active: active ?? true,
  });

  // Emitir evento Socket.IO
  const io = req.app.get('io');
  io?.to(req.user.company.toString()).emit('project:new', { project });

  res.status(201).json({ project });
};

// ── 2. Listar proyectos activos ───────────────────────────────────────────────

export const listProjects = async (req, res, next) => {
  if (!req.user.company) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const { page = 1, limit = 10, name, client, active, sort = '-createdAt' } = req.query;
  const skip = (page - 1) * limit;

  const filter = { company: req.user.company, deleted: false };
  if (name)   filter.name   = { $regex: name, $options: 'i' };
  if (client) filter.client = client;
  if (active !== undefined) filter.active = active === 'true';

  const [items, total] = await Promise.all([
    Project.find(filter)
      .populate('client', 'name cif')
      .sort(buildSort(sort))
      .skip(skip)
      .limit(Number(limit)),
    Project.countDocuments(filter),
  ]);

  res.json({
    projects:    items,
    totalItems:  total,
    totalPages:  Math.ceil(total / limit),
    currentPage: Number(page),
  });
};

// ── 3. Obtener un proyecto ────────────────────────────────────────────────────

export const getProject = async (req, res, next) => {
  const project = await Project.findOne({
    _id:     req.params.id,
    company: req.user.company,
    deleted: false,
  }).populate('client', 'name cif email');

  if (!project) return next(AppError.notFound('Proyecto no encontrado'));

  res.json({ project });
};

// ── 4. Actualizar proyecto ────────────────────────────────────────────────────

export const updateProject = async (req, res, next) => {
  const project = await Project.findOne({
    _id:     req.params.id,
    company: req.user.company,
    deleted: false,
  });

  if (!project) return next(AppError.notFound('Proyecto no encontrado'));

  // Verificar código duplicado si se cambia
  if (req.body.projectCode && req.body.projectCode !== project.projectCode) {
    const dup = await Project.findOne({ company: req.user.company, projectCode: req.body.projectCode });
    if (dup) return next(AppError.conflict('Ya existe un proyecto con ese código'));
  }

  // Verificar cliente si se cambia
  if (req.body.client) {
    const clientDoc = await Client.findOne({
      _id:     req.body.client,
      company: req.user.company,
      deleted: false,
    });
    if (!clientDoc) return next(AppError.notFound('Cliente no encontrado en tu compañía'));
  }

  Object.assign(project, req.body);
  await project.save();

  res.json({ project });
};

// ── 5. Eliminar / archivar proyecto ──────────────────────────────────────────

export const deleteProject = async (req, res, next) => {
  const project = await Project.findOne({
    _id:     req.params.id,
    company: req.user.company,
    deleted: false,
  });

  if (!project) return next(AppError.notFound('Proyecto no encontrado'));

  const soft = req.query.soft === 'true';

  if (soft) {
    project.deleted   = true;
    project.deletedAt = new Date();
    await project.save();
    return res.json({ message: 'Proyecto archivado correctamente (soft delete)' });
  }

  await project.deleteOne();
  res.json({ message: 'Proyecto eliminado permanentemente' });
};

// ── 6. Listar proyectos archivados ────────────────────────────────────────────

export const listArchivedProjects = async (req, res, next) => {
  if (!req.user.company) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const projects = await Project.find({ company: req.user.company, deleted: true })
    .populate('client', 'name cif')
    .sort('-deletedAt');

  res.json({ projects });
};

// ── 7. Restaurar proyecto ─────────────────────────────────────────────────────

export const restoreProject = async (req, res, next) => {
  const project = await Project.findOne({
    _id:     req.params.id,
    company: req.user.company,
    deleted: true,
  });

  if (!project) return next(AppError.notFound('Proyecto archivado no encontrado'));

  project.deleted   = false;
  project.deletedAt = null;
  await project.save();

  res.json({ message: 'Proyecto restaurado correctamente', project });
};
