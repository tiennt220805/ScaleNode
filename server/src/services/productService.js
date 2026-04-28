const {writePool, readPool} = require("../config/db");
const {TABLE_NAME} = require("../models/productModel");

const createProduct = async ({name, price}) => {
  const query = `INSERT INTO ${TABLE_NAME} (name, price)
    VALUES ($1, $2)
    RETURNING id, name, price, created_at`;
  const values = [name, price];
  const result = await writePool.query(query, values);
  return result.rows[0];
};

const getProducts = async () => {
  const query = `SELECT id, name, price, created_at
    FROM ${TABLE_NAME}
    ORDER BY id DESC`;
  const result = await readPool.query(query);
  return result.rows;
};

module.exports = {createProduct, getProducts};
