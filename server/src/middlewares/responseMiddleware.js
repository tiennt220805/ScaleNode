const normalizeErrors = (errors) => {
  if (!errors) {
    return [];
  }
  return Array.isArray(errors) ? errors : [errors];
};

const buildMeta = (res, overrides = {}) => ({
  processed_by: process.env.NODE_NAME || "unknown-node",
  db_source: res.locals.dbSource || "N/A",
  timestamp: new Date().toISOString(),
  ...overrides,
});

function responseWrapper(req, res, next) {
  // -------------------------
  // SUCCESS: 200 OK
  // -------------------------
  res.ok = function (message = "Success", data = null, metaOverrides = {}) {
    return res.status(200).json({
      success: true,
      message,
      data,
      meta: buildMeta(res, metaOverrides),
    });
  };

  // -------------------------
  // SUCCESS: 201 CREATED
  // -------------------------
  res.created = function (
    message = "Created",
    data = null,
    metaOverrides = {},
  ) {
    return res.status(201).json({
      success: true,
      message,
      data,
      meta: buildMeta(res, metaOverrides),
    });
  };

  // -------------------------
  // ERROR HANDLER GENERIC
  // -------------------------
  res.error = function (
    message = "Error",
    errors = [],
    status = 400,
    metaOverrides = {},
  ) {
    return res.status(status).json({
      success: false,
      message,
      errors: normalizeErrors(errors),
      meta: buildMeta(res, metaOverrides),
    });
  };

  // -------------------------
  // ERROR 404: NOT FOUND
  // -------------------------
  res.notFound = function (message = "Not Found", metaOverrides = {}) {
    return res.status(404).json({
      success: false,
      message,
      errors: [],
      meta: buildMeta(res, metaOverrides),
    });
  };

  // -------------------------
  // NEXT
  // -------------------------
  next();
}

module.exports = {responseWrapper};
