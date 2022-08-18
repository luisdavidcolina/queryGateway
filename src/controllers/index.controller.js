const { Pool } = require("pg");

const pool = new Pool({
  user: "diamond",
  host: "127.0.0.1",
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

const getInvoices = async (req, res) => {
  try {
    const response = await pool.query("SELECT * FROM master.tbl_consumos");
    const invoices = response.rows.map((invoice) => {
      return {
        ...invoice,
        price: [invoice.price],
      };
    });
    res.status(200).json(invoices);
  } catch (error) {
    res.json(error);
  }
};

module.exports = {
  getQuery,
  getInvoices,
};
