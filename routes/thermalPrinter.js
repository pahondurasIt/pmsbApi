const express = require("express");
const router = express.Router();
const thermalPrinterPermissions = require("../controllers/thermalPrinterController");

// Ruta para obtener tipos de permisos y empleados
router.post(
  "/printPermissionTicket",
  thermalPrinterPermissions.printTicketPermission
);
router.post(
  "/printTicketRequestPermission",
  thermalPrinterPermissions.printTicketRequestPermission
);

module.exports = router;
