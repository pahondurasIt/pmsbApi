const db = require("../config/db");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

// Extender dayjs con plugins de UTC y Timezone
dayjs.extend(utc);
dayjs.extend(timezone);

// Función para obtener tipos de permisos y lista de empleados que marcaron hoy
exports.getPermissionData = async (req, res) => {
  try {
    const [permissionResults] = await db.query(
      "SELECT permissionTypeID, permissionTypeName FROM permissiontype_emp"
    );
    const currentDate = dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD");
    const [employeeResults] = await db.query(
      `SELECT DISTINCT e.employeeID, CONCAT(e.firstName, ' ', COALESCE(e.middleName, ''), ' ', e.lastName) as fullName 
       FROM employees_emp e
       JOIN h_attendance_emp a ON e.employeeID = a.employeeID 
       WHERE DATE(a.date) = ?`,
      [currentDate]
    );
    res.json({ permissions: permissionResults, employees: employeeResults });
  } catch (err) {
    console.error("Error fetching permission data:", err);
    res.status(500).json({
      message: "Error al cargar datos iniciales para permisos",
      error: err.message,
    });
  }
};

// Controlador para autorizar y registrar un permiso
// ACTUALIZADO: Ahora recibe y guarda los campos de hora exitTimePermission y entryTimePermission
exports.authorizePermission = async (req, res) => {
  try {
    // Extraemos también los nuevos campos de hora del cuerpo de la solicitud
    const { employeeID, permissionType, exitTimePermission, entryTimePermission } = req.body;

    // Validación actualizada para incluir los nuevos campos obligatorios
    if (!employeeID || !permissionType || !exitTimePermission || !entryTimePermission) {
      return res.status(400).json({
        success: false,
        message: "Datos incompletos. Se requiere ID de empleado, tipo de permiso, hora de salida y hora de entrada.",
      });
    }

    const currentDateTimeCST = dayjs().tz("America/Tegucigalpa");
    const currentDateOnly = currentDateTimeCST.format("YYYY-MM-DD");

    // Query actualizado para incluir los nuevos campos de hora
    const query = `
      INSERT INTO permissionattendance_emp (
        employeeID, 
        permissionTypeID, 
        date, 
        exitTimePermission,
        entryTimePermission,
        comment, 
        isPaid, 
        isApproved, 
        createdDate, 
        createdBy, 
        updatedDate, 
        updatedBy
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NULL, ?)
    `;

    const commentValue = null;
    const isPaidValue = 0;
    const isApprovedValue = 1;
    const createdByValue = 1;
    const updatedByValue = 1;

    // Array de valores actualizado para incluir los nuevos campos de hora
    const values = [
      employeeID,
      permissionType,
      currentDateOnly,
      exitTimePermission,     // NUEVO: Hora de salida
      entryTimePermission,    // NUEVO: Hora de entrada de regreso
      commentValue,
      isPaidValue,
      isApprovedValue,
      createdByValue,
      updatedByValue,
    ];

    const [result] = await db.query(query, values);

    if (result.affectedRows === 1) {
      const insertedId = result.insertId;
      console.log(
        `Permiso autorizado y guardado con ID: ${insertedId} para empleado ${employeeID} en fecha ${currentDateOnly} con hora de salida ${exitTimePermission} y hora de entrada ${entryTimePermission}`
      );

      res.status(201).json({
        success: true,
        message: "Permiso autorizado y registrado correctamente.",
        permissionId: insertedId,
        savedData: {
          permissionID: insertedId,
          employeeID,
          permissionTypeID: permissionType,
          date: currentDateOnly,
          exitTimePermission,     // NUEVO: Incluimos la hora de salida en la respuesta
          entryTimePermission,    // NUEVO: Incluimos la hora de entrada en la respuesta
          isApproved: isApprovedValue,
        },
      });
    } else {
      throw new Error("No se pudo guardar el registro del permiso en la base de datos.");
    }
  } catch (error) {
    console.error("Error en authorizePermission:", error);
    res.status(500).json({
      success: false,
      message: "Ocurrió un error en el servidor al intentar autorizar el permiso.",
      error: error.message,
    });
  }
};