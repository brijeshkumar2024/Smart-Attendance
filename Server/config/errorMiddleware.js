const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode =
    res.statusCode === 200 ? err.statusCode || err.status || 500 : res.statusCode;
  const isProd = process.env.NODE_ENV === "production";

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    ...(isProd ? {} : { stack: err.stack }),
  });
};

module.exports = errorHandler;
