const { Router } = require("express");
const router = Router();

const { getQuery} = require("../controllers/index.controller");

router.get("/query/:id", getQuery);

module.exports = router;
