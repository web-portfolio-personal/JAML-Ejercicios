import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import prisma from '../lib/prisma';
import AppError from '../utils/AppError';

type AuthRequest = Request & { user: User };

// Helper: parse sort string to Prisma orderBy
const buildOrderBy = (sortStr: string): Record<string, 'asc' | 'desc'> => {
  const field = sortStr.startsWith('-') ? sortStr.slice(1) : sortStr;
  const order = sortStr.startsWith('-') ? 'desc' : 'asc';
  return { [field]: order };
};

// 1. Crear cliente
export const createClient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user.companyId) {
    return next(AppError.badRequest('Debes pertenecer a una empresa para crear clientes'));
  }

  const { name, cif, email, phone, address } = req.body as {
    name: string;
    cif: string;
    email?: string;
    phone?: string;
    address?: object;
  };

  const existing = await prisma.client.findFirst({
    where: { companyId: req.user.companyId, cif },
  });
  if (existing) {
    return next(AppError.conflict('Ya existe un cliente con ese CIF en tu compania'));
  }

  const client = await prisma.client.create({
    data: {
      userId:    req.user.id,
      companyId: req.user.companyId,
      name,
      cif,
      email,
      phone,
      address:   address ? JSON.stringify(address) : undefined,
    },
  });

  // Emitir evento Socket.IO a la sala de la compania
  const io = req.app.get('io');
  if (io) io.to(req.user.companyId).emit('client:new', { client });

  res.status(201).json({ client });
};

// 2. Listar clientes activos
export const listClients = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user.companyId) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const query = req.query as { page?: number; limit?: number; name?: string; sort?: string };
  const page  = Number(query.page)  || 1;
  const limit = Number(query.limit) || 10;
  const skip  = (page - 1) * limit;

  const where = {
    companyId: req.user.companyId,
    deleted:   false,
    ...(query.name ? { name: { contains: query.name } } : {}),
  };

  const orderBy = buildOrderBy(query.sort || '-createdAt');

  const [items, total] = await Promise.all([
    prisma.client.findMany({ where, orderBy, skip, take: limit }),
    prisma.client.count({ where }),
  ]);

  res.json({
    clients:     items,
    totalItems:  total,
    totalPages:  Math.ceil(total / limit),
    currentPage: page,
  });
};

// 3. Obtener un cliente
export const getClient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const client = await prisma.client.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   false,
    },
  });

  if (!client) return next(AppError.notFound('Cliente no encontrado'));

  res.json({ client });
};

// 4. Actualizar cliente
export const updateClient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const client = await prisma.client.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   false,
    },
  });

  if (!client) return next(AppError.notFound('Cliente no encontrado'));

  const body = req.body as { name?: string; cif?: string; email?: string; phone?: string; address?: object };

  // Verificar CIF duplicado si se cambia
  if (body.cif && body.cif !== client.cif) {
    const dup = await prisma.client.findFirst({
      where: { companyId: req.user.companyId ?? undefined, cif: body.cif },
    });
    if (dup) return next(AppError.conflict('Ya existe un cliente con ese CIF'));
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      ...(body.name    !== undefined && { name: body.name }),
      ...(body.cif     !== undefined && { cif: body.cif }),
      ...(body.email   !== undefined && { email: body.email }),
      ...(body.phone   !== undefined && { phone: body.phone }),
      ...(body.address !== undefined && { address: JSON.stringify(body.address) }),
    },
  });

  res.json({ client: updated });
};

// 5. Eliminar / archivar cliente
export const deleteClient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const client = await prisma.client.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   false,
    },
  });

  if (!client) return next(AppError.notFound('Cliente no encontrado'));

  const soft = (req.query as Record<string, string>).soft === 'true';

  if (soft) {
    await prisma.client.update({
      where: { id: client.id },
      data: { deleted: true, deletedAt: new Date() },
    });
    res.json({ message: 'Cliente archivado correctamente (soft delete)' });
    return;
  }

  await prisma.client.delete({ where: { id: client.id } });
  res.json({ message: 'Cliente eliminado permanentemente' });
};

// 6. Listar clientes archivados
export const listArchivedClients = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user.companyId) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const clients = await prisma.client.findMany({
    where: { companyId: req.user.companyId, deleted: true },
    orderBy: { deletedAt: 'desc' },
  });

  res.json({ clients });
};

// 7. Restaurar cliente archivado
export const restoreClient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const client = await prisma.client.findFirst({
    where: {
      id:        String(req.params.id),
      companyId: req.user.companyId ?? undefined,
      deleted:   true,
    },
  });

  if (!client) return next(AppError.notFound('Cliente archivado no encontrado'));

  const restored = await prisma.client.update({
    where: { id: client.id },
    data: { deleted: false, deletedAt: null },
  });

  res.json({ message: 'Cliente restaurado correctamente', client: restored });
};
