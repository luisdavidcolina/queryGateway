const { Router } = require("express");
const router = Router();

const { getQuery, getInvoices, getBookings, cloneSchemaWithEmptyTables} = require("../controllers/index.controller");

router.get("/query/:id", getQuery);
router.get("/invoices", getInvoices);
router.get("/bookings", getBookings);
router.get("/cloneSchemaWithEmptyTables/:hotelName", cloneSchemaWithEmptyTables);




module.exports = router;
