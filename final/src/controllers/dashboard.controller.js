import DeliveryNote from '../models/DeliveryNote.js';
import Project from '../models/Project.js';
import Client from '../models/Client.js';
import AppError from '../utils/AppError.js';

/**
 * GET /api/dashboard
 * Estadísticas globales de la compañía usando aggregation pipeline.
 */
export const getDashboard = async (req, res, next) => {
  if (!req.user.company) {
    return next(AppError.badRequest('Debes pertenecer a una empresa'));
  }

  const company = req.user.company;
  const matchBase = { company, deleted: false };

  // Ejecutar todos los pipelines en paralelo
  const [
    notesByMonth,
    hoursByProject,
    materialsByClient,
    summary,
  ] = await Promise.all([

    // ── 1. Total de albaranes por mes (últimos 12 meses) ──────────────────────
    DeliveryNote.aggregate([
      { $match: matchBase },
      {
        $group: {
          _id: {
            year:  { $year:  '$workDate' },
            month: { $month: '$workDate' },
          },
          total:   { $sum: 1 },
          signed:  { $sum: { $cond: ['$signed', 1, 0] } },
          unsigned:{ $sum: { $cond: ['$signed', 0, 1] } },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          year:     '$_id.year',
          month:    '$_id.month',
          total:    1,
          signed:   1,
          unsigned: 1,
        },
      },
    ]),

    // ── 2. Horas totales por proyecto ─────────────────────────────────────────
    DeliveryNote.aggregate([
      { $match: { ...matchBase, format: 'hours' } },
      {
        $group: {
          _id:        '$project',
          totalHours: { $sum: '$hours' },
          noteCount:  { $sum: 1 },
        },
      },
      {
        $lookup: {
          from:         'projects',
          localField:   '_id',
          foreignField: '_id',
          as:           'project',
        },
      },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id:         0,
          projectId:   '$_id',
          projectName: '$project.name',
          projectCode: '$project.projectCode',
          totalHours:  1,
          noteCount:   1,
        },
      },
      { $sort: { totalHours: -1 } },
      { $limit: 10 },
    ]),

    // ── 3. Materiales por cliente ─────────────────────────────────────────────
    DeliveryNote.aggregate([
      { $match: { ...matchBase, format: 'material' } },
      {
        $group: {
          _id:          '$client',
          noteCount:    { $sum: 1 },
          totalQuantity:{ $sum: '$quantity' },
          materials:    { $addToSet: '$material' },
        },
      },
      {
        $lookup: {
          from:         'clients',
          localField:   '_id',
          foreignField: '_id',
          as:           'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id:           0,
          clientId:      '$_id',
          clientName:    '$client.name',
          clientCif:     '$client.cif',
          noteCount:     1,
          totalQuantity: 1,
          materials:     1,
        },
      },
      { $sort: { noteCount: -1 } },
      { $limit: 10 },
    ]),

    // ── 4. Resumen global ─────────────────────────────────────────────────────
    Promise.all([
      DeliveryNote.countDocuments(matchBase),
      DeliveryNote.countDocuments({ ...matchBase, signed: true }),
      DeliveryNote.countDocuments({ ...matchBase, format: 'hours' }),
      DeliveryNote.countDocuments({ ...matchBase, format: 'material' }),
      Project.countDocuments({ company, deleted: false }),
      Client.countDocuments({ company, deleted: false }),
    ]),
  ]);

  const [totalNotes, signedNotes, hourNotes, materialNotes, totalProjects, totalClients] = summary;

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
    notesByMonth,
    hoursByProject,
    materialsByClient,
  });
};
