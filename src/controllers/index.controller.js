const { Pool } = require("pg");

const pool = new Pool({
  user: "diamond",
  host: "54.94.26.36",
  database: "hotel",
  password: "lksdfgj53fd",
  port: 5432,
});

const getQuery = async (req, res) => {
  const { id } = req.params;
  const str = String(id);
  const result = str.split("-").join(" ");
  const query = result;
  try {
    const response = await pool.query(query);
    res.status(200).json(response);
  } catch (error) {
    res.json(error);
  }
};

module.exports = {
  getQuery,
};
