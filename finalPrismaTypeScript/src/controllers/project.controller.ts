import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import prisma from '../lib/prisma';
import AppError from '../utils/AppError';

type AuthRequest = Request & { user: User };

const buildOrderBy = (sortStr: string): Record<string, 'asc' | 'desc'> => {
  const field = sortStr.startsWith('-') ? sortStr.slice(1) : sortStr;
  const order = sortStr.startsWith('-') ? 'desc' : 'asc';
  return { [field]: order };
};

// 1. Crear proyecto
export const createProject = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user.companyId) {
    return next(AppError.badRequest('Debes pertenecer a una empresa para crear proyectos'));
  }

  const { client, name, projectCode, address, email, notes, active } = req.body as {
    client: string;
    name: string;
    projectCode: string;
    address?: object;
    email?: string;
    notes?: string;
    active?: boolean;
  };

  // Verificar que el cliente pertenece a la misma compania
  const clientDoc = await prisma.client.findFirst({
    where: { id: client, companyId: req.user.companyId, deleted: false },
  });
  if (!clientDoc) {
    return next(AppError.notFound('Cliente no encontrado en tu compania'));
  }

  // Verificar codigo unico
  const existing = await prisma.project.findFirst({
    where: { companyId: req.user.companyId, projectCode },
  });
  if (existing) {
    return next(AppError.conflict('Ya existe un proyecto con ese codigo en tu compania'));
  }

  const project = await prisma.project.create({
    data: {
      userId:      req.user.id,
      companyId:   req.user.companyId,
      clientId:    client,
      name,
      projectCode,
      address:     address ? JSON.stringify(address) : undefined,
      email,
      notes,
      active:      active ?? true,
    },
  });

  const io = req.app.get('io');
  if (io) io.to(req.user.companyId).emit('project:new', { project });

  res.status(201).json({ project });
};

// 2. Listar proyectos activos
export const listProjects = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user.companyId) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const query = req.query as {
    page?: number;
    limit?: number;
    name?: string;
    client?: string;
    active?: boolean;
    sort?: string;
  };
  const page  = Number(query.page)  || 1;
  const limit = Number(query.limit) || 10;
  const skip  = (page - 1) * limit;

  const where = {
    companyId: req.user.companyId,
    deleted:   false,
    ...(query.name   ? { name: { contains: query.name } } : {}),
    ...(query.client ? { clientId: query.client }                               : {}),
    ...(query.active !== undefined ? { active: query.active }                   : {}),
  };

  const orderBy = buildOrderBy(query.sort || '-createdAt');

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: { client: { select: { id: true, name: true, cif: true } } },
    }),
    prisma.project.count({ where }),
  ]);

  res.json({
    projects:    items,
    totalItems:  total,
    totalPages:  Math.ceil(total / limit),
    currentPage: page,
  });
};

// 3. Obtener un proyecto
export const getProject = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const project = await prisma.project.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   false,
    },
    include: { client: { select: { id: true, name: true, cif: true, email: true } } },
  });

  if (!project) return next(AppError.notFound('Proyecto no encontrado'));

  res.json({ project });
};

// 4. Actualizar proyecto
export const updateProject = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const project = await prisma.project.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   false,
    },
  });

  if (!project) return next(AppError.notFound('Proyecto no encontrado'));

  const body = req.body as {
    client?: string;
    name?: string;
    projectCode?: string;
    address?: object;
    email?: string;
    notes?: string;
    active?: boolean;
  };

  // Verificar codigo duplicado si se cambia
  if (body.projectCode && body.projectCode !== project.projectCode) {
    const dup = await prisma.project.findFirst({
      where: { companyId: req.user.companyId ?? undefined, projectCode: body.projectCode },
    });
    if (dup) return next(AppError.conflict('Ya existe un proyecto con ese codigo'));
  }

  // Verificar cliente si se cambia
  if (body.client) {
    const clientDoc = await prisma.client.findFirst({
      where: { id: body.client, companyId: req.user.companyId ?? undefined, deleted: false },
    });
    if (!clientDoc) return next(AppError.notFound('Cliente no encontrado en tu compania'));
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      ...(body.client      !== undefined && { clientId: body.client }),
      ...(body.name        !== undefined && { name: body.name }),
      ...(body.projectCode !== undefined && { projectCode: body.projectCode }),
      ...(body.address     !== undefined && { address: JSON.stringify(body.address) }),
      ...(body.email       !== undefined && { email: body.email }),
      ...(body.notes       !== undefined && { notes: body.notes }),
      ...(body.active      !== undefined && { active: body.active }),
    },
  });

  res.json({ project: updated });
};

// 5. Eliminar / archivar proyecto
export const deleteProject = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const project = await prisma.project.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   false,
    },
  });

  if (!project) return next(AppError.notFound('Proyecto no encontrado'));

  const soft = (req.query as Record<string, string>).soft === 'true';

  if (soft) {
    await prisma.project.update({
      where: { id: project.id },
      data: { deleted: true, deletedAt: new Date() },
    });
    res.json({ message: 'Proyecto archivado correctamente (soft delete)' });
    return;
  }

  await prisma.project.delete({ where: { id: project.id } });
  res.json({ message: 'Proyecto eliminado permanentemente' });
};

// 6. Listar proyectos archivados
export const listArchivedProjects = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user.companyId) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const projects = await prisma.project.findMany({
    where: { companyId: req.user.companyId, deleted: true },
    orderBy: { deletedAt: 'desc' },
    include: { client: { select: { id: true, name: true, cif: true } } },
  });

  res.json({ projects });
};

// 7. Restaurar proyecto
export const restoreProject = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const project = await prisma.project.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   true,
    },
  });

  if (!project) return next(AppError.notFound('Proyecto archivado no encontrado'));

  const restored = await prisma.project.update({
    where: { id: project.id },
    data: { deleted: false, deletedAt: null },
  });

  res.json({ message: 'Proyecto restaurado correctamente', project: restored });
};
