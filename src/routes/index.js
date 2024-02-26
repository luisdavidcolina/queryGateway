const { Router } = require("express");
const router = Router();

const { getQuery, getInvoices, getBookings} = require("../controllers/index.controller");

router.get("/query/:id", getQuery);
router.get("/invoices", getInvoices);
router.get("/bookings", getBookings);



module.exports = router;
