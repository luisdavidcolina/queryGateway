const { Router } = require("express");
const router = Router();

const { getQuery, getInvoices, getBookings, cloneSchemaWithEmptyTables} = require("../controllers/index.controller");
const { starbucksIntegration } = require("../controllers/index.controller");
const { registrarConciliacion } = require("../controllers/conciliacion.controller");

router.get("/query/:id", getQuery);

// Corridas y correcciones de la extension que concilia el inventario con Orbe.
// Va por aca y no por /query porque ese ejecuta SQL arbitrario sin autenticacion
// y ademas convierte todo "-" en espacio, asi que rompe fechas y negativos.
router.post("/orbe/conciliacion", registrarConciliacion);
router.get("/invoices", getInvoices);
router.get("/bookings", getBookings);
router.post("/cloneSchemaWithEmptyTables/:hotelName", cloneSchemaWithEmptyTables);


router.post("/starbucks/integration", starbucksIntegration);


module.exports = router;
