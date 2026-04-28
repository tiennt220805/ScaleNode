const express = require("express");
const productController = require("../controllers/productController");
const {validateProduct} = require("../middlewares/validation");

const router = express.Router();

router.get("/", productController.getProducts);
router.post("/", validateProduct, productController.createProduct);

module.exports = router;
