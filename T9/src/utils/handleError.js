export const handleHttpError = (res, message = 'ERROR', code = 500) => {
  res.status(code).json({
    error: true,
    message
  });
};
