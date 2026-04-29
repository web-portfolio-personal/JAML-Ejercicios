import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import prisma from '../lib/prisma';
import AppError from '../utils/AppError';

type AuthRequest = Request & { user: User };

interface NotesByMonthRow {
  year: number;
  month: number;
  total: bigint;
  signed: bigint;
  unsigned: bigint;
}

interface HoursByProjectRow {
  projectId: string;
  projectName: string | null;
  projectCode: string | null;
  totalHours: number | null;
  noteCount: bigint;
}

interface MaterialsByClientRow {
  clientId: string;
  clientName: string | null;
  clientCif: string | null;
  noteCount: bigint;
  totalQuantity: number | null;
}

/**
 * GET /api/dashboard
 * Estadisticas globales de la compania usando Prisma groupBy y raw queries.
 */
export const getDashboard = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user.companyId) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const companyId = req.user.companyId;

  // Run all queries in parallel
  const [
    notesByMonth,
    hoursByProject,
    materialsByClient,
    totalNotes,
    signedNotes,
    hourNotes,
    materialNotes,
    totalProjects,
    totalClients,
  ] = await Promise.all([

    // 1. Total de albaranes por mes (ultimos 12 meses) — SQLite raw SQL
    // Para PostgreSQL: usar EXTRACT(YEAR FROM "workDate") y EXTRACT(MONTH FROM "workDate")
    prisma.$queryRaw<NotesByMonthRow[]>`
        SELECT
          CAST(strftime('%Y', workDate) AS INTEGER) AS year,
          CAST(strftime('%m', workDate) AS INTEGER) AS month,
          COUNT(*)                                  AS total,
          SUM(CASE WHEN signed = 1 THEN 1 ELSE 0 END) AS signed,
          SUM(CASE WHEN signed = 0 THEN 1 ELSE 0 END) AS unsigned
        FROM DeliveryNote
        WHERE companyId = ${companyId}
          AND deleted = 0
          AND workDate >= datetime('now', '-12 months')
        GROUP BY year, month
        ORDER BY year DESC, month DESC
        LIMIT 12
      `,

    // 2. Horas totales por proyecto (groupBy)
    prisma.deliveryNote.groupBy({
      by: ['projectId'],
      where: { companyId, deleted: false, format: 'hours' },
      _sum: { hours: true },
      _count: { id: true },
      orderBy: { _sum: { hours: 'desc' } },
      take: 10,
    }),

    // 3. Materiales por cliente (groupBy)
    prisma.deliveryNote.groupBy({
      by: ['clientId'],
      where: { companyId, deleted: false, format: 'material' },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),

    // 4. Summary counts
    prisma.deliveryNote.count({ where: { companyId, deleted: false } }),
    prisma.deliveryNote.count({ where: { companyId, deleted: false, signed: true } }),
    prisma.deliveryNote.count({ where: { companyId, deleted: false, format: 'hours' } }),
    prisma.deliveryNote.count({ where: { companyId, deleted: false, format: 'material' } }),
    prisma.project.count({ where: { companyId, deleted: false } }),
    prisma.client.count({ where: { companyId, deleted: false } }),
  ]);

  // Enrich hoursByProject with project names
  const projectIds = hoursByProject.map((r) => r.projectId);
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true, projectCode: true },
  });
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const enrichedHoursByProject: HoursByProjectRow[] = hoursByProject.map((r) => {
    const proj = projectMap.get(r.projectId);
    return {
      projectId:   r.projectId,
      projectName: proj?.name ?? null,
      projectCode: proj?.projectCode ?? null,
      totalHours:  r._sum.hours,
      noteCount:   BigInt(r._count.id),
    };
  });

  // Enrich materialsByClient with client names
  const clientIds = materialsByClient.map((r) => r.clientId);
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, name: true, cif: true },
  });
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const enrichedMaterialsByClient: MaterialsByClientRow[] = materialsByClient.map((r) => {
    const cli = clientMap.get(r.clientId);
    return {
      clientId:      r.clientId,
      clientName:    cli?.name ?? null,
      clientCif:     cli?.cif ?? null,
      noteCount:     BigInt(r._count.id),
      totalQuantity: r._sum.quantity,
    };
  });

  // Serialize notesByMonth (convert BigInt to number)
  const notesByMonthSerialized = notesByMonth.map((row) => ({
    year:     row.year,
    month:    row.month,
    total:    Number(row.total),
    signed:   Number(row.signed),
    unsigned: Number(row.unsigned),
  }));

  const hoursByProjectSerialized = enrichedHoursByProject.map((r) => ({
    ...r,
    noteCount: Number(r.noteCount),
  }));

  const materialsByClientSerialized = enrichedMaterialsByClient.map((r) => ({
    ...r,
    noteCount: Number(r.noteCount),
  }));

  res.json({
    summary: {
      totalNotes,
      signedNotes,
      unsignedNotes: totalNotes - signedNotes,
      hourNotes,
      materialNotes,
      totalProjects,
      totalClients,
    },
    notesByMonth:      notesByMonthSerialized,
    hoursByProject:    hoursByProjectSerialized,
    materialsByClient: materialsByClientSerialized,
  });
};
