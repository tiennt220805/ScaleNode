const productService = require("../services/productService");

const createProduct = async (req, res, next) => {
  res.locals.dbSource = "Master";

  try {
    const {name, price} = req.body;
    const created = await productService.createProduct({name, price});
    return res.created("Product created", created);
  } catch (err) {
    console.error("createProduct error:", err);
    err.status = err.status || 500;
    err.message = err.message || "Failed to create product";
    return next(err);
  }
};

const getProducts = async (req, res, next) => {
  res.locals.dbSource = "Slave";

  try {
    const products = await productService.getProducts();
    return res.ok("Products fetched", products);
  } catch (err) {
    console.error("getProducts error:", err);
    err.status = err.status || 500;
    err.message = err.message || "Failed to fetch products";
    return next(err);
  }
};

module.exports = {createProduct, getProducts};
