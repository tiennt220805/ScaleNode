function notFoundHandler(req, res, next) {
  console.log("Request Not Found", req.originalUrl);
  return res.notFound("Request Not Found");
}

function errorHandler(err, req, res, next) {
  console.error("Error: ", err);
  return res.error(
    err.message || "Internal Server Error",
    err.errors || [err.stack],
    err.status || 500,
  );
}

module.exports = {notFoundHandler, errorHandler};
