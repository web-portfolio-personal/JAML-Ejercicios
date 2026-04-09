export const notFound = (req, res, next) => {
  res.status(404).json({
    error: true,
    message: `Ruta ${req.method} ${req.originalUrl} no encontrada`
  });
};

export const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: true, message: 'Token inválido' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: true, message: 'Token expirado' });
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'campo';
    return res.status(409).json({
      error: true,
      message: `Ya existe un registro con ese '${field}'`
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: true, message: 'Registro no encontrado' });
  }

  if (err.name === 'ZodError') {
    const details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return res.status(400).json({ error: true, message: 'Error de validación', details });
  }

  res.status(err.statusCode || 500).json({
    error: true,
    message: err.message || 'Error interno del servidor'
  });
};
