const validateProduct = (req, res, next) => {
  const {name, price} = req.body || {};
  const errors = [];

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.push("Name must be a non-empty string.");
  }

  const priceNumber = Number(price);
  if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
    errors.push("Price must be a number greater than 0.");
  }

  if (errors.length > 0) {
    return res.error("Validation failed", errors, 400);
  }

  req.body.name = name.trim();
  req.body.price = priceNumber;

  return next();
};

module.exports = {validateProduct};
