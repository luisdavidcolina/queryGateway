const { Router } = require("express");
const router = Router();

const { getQuery, getInvoices} = require("../controllers/index.controller");

router.get("/query/:id", getQuery);
router.get("/invoices", getInvoices);



module.exports = router;
