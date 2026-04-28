const {Pool} = require("pg");

const getEnv = (key, fallback) => {
  const value = process.env[key];
  return value !== undefined && value !== "" ? value : fallback;
};

const buildConfig = (prefix) => ({
  host: getEnv(`${prefix}_HOST`),
  port: Number(getEnv(`${prefix}_PORT`, 5432)),
  user: getEnv(`${prefix}_USER`),
  password: getEnv(`${prefix}_PASSWORD`),
  database: getEnv(`${prefix}_NAME`),
});

const writePool = new Pool(buildConfig("DB_MASTER"));
const readPool = new Pool(buildConfig("DB_SLAVE"));

writePool.on("error", (err) => {
  console.error("Write pool error:", err);
});

readPool.on("error", (err) => {
  console.error("Read pool error:", err);
});

module.exports = {writePool, readPool};
