require("dotenv").config();

const express = require("express");
const {responseWrapper} = require("./middlewares/responseMiddleware");
const {
  notFoundHandler,
  errorHandler,
} = require("./middlewares/errorMiddleware");
const productRoutes = require("./routes/productRoutes");

const app = express();

app.use(express.json());
app.use(responseWrapper);

app.get("/api/health", (req, res) => {
  return res.ok("Health check OK", {status: "ok"});
});

app.use("/api/products", productRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`ScaleNode API running on port ${port}`);
});
