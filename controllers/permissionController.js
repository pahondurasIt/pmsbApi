const db = require("../config/db");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { camposAuditoriaUPDATE } = require("../helpers/columnasAuditoria");
require("dayjs/locale/es");

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
      `SELECT DISTINCT
        e.employeeID,
        CONCAT(e.employeeID, ' - ', e.firstName, ' ', COALESCE(e.middleName, ''), ' ', e.lastName) AS fullName
      FROM
          employees_emp e
          INNER JOIN h_attendance_emp a ON e.employeeID = a.employeeID
      WHERE
          a.date = ?
          AND NOT EXISTS (
              SELECT 1
              FROM dispatching_emp d
        WHERE d.employeeID = e.employeeID
          AND d.date = ?
    );`,
      [currentDate, currentDate]
    );

    let currentTime = dayjs().format("HH:mm:ss");

    const [shiftDetail] = await db.query(
      `
        SELECT 
          s.shiftID, ds.day, s.shiftName, ds.startTime, ds.endTime
        FROM detailsshift_emp ds
        INNER JOIN shifts_emp s ON ds.shiftID = s.shiftID
        WHERE s.companyID = 1
          AND ds.day = '${dayjs().locale("es").format("dddd").toUpperCase()}'
          AND (
          (ds.startTime < ds.endTime AND '${currentTime}' BETWEEN ds.startTime AND ds.endTime)
          OR
          (ds.startTime > ds.endTime AND 
          ('${currentTime}' >= ds.startTime OR '${currentTime}' <= ds.endTime))
        )
      `
    );

    res.json({
      permissions: permissionResults,
      employees: employeeResults,
      shiftDetail,
    });
  } catch (err) {
    console.error("Error fetching permission data:", err);
    res.status(500).json({
      message: "Error al cargar datos iniciales para permisos",
      error: err.message,
    });
  }
};

// Función para obtener todos los permisos registrados
exports.getAllPermissions = async (req, res) => {
  try {
    const [results] = await db.query(`
     SELECT 
        CONCAT(e.employeeID, ' - ', e.firstName, ' ', COALESCE(e.middleName, ''), 
        ' ', e.lastName,  ' ', e.secondLastName) as fullName,
        e.employeeID, j.jobName, pa.permissionID, p.permissionTypeID, p.permissionTypeName,
        pa.date, pa.exitTimePermission, pa.entryTimePermission,
        pa.exitPermission, pa.entryPermission, pa.IsApproved, pa.isPaid
    FROM
    permissionattendance_emp pa
            INNER JOIN permissiontype_emp p on p.permissionTypeID = pa.permissionTypeID
            INNER JOIN employees_emp e on e.employeeID = pa.employeeID
            INNER JOIN jobs_emp j on e.jobID = j.jobID
    where pa.date = DATE(NOW())
    ORDER BY pa.permissionID desc;
    `);
    res.json(results);
  } catch (err) {
    console.error("Error fetching all permissions:", err);
    res.status(500).json({
      message: "Error al cargar todos los permisos",
      error: err.message,
    });
  }
};

// Función para obtener todos los permisos registrados
exports.markPermissionAsPaid = async (req, res) => {
  try {
    const { permissionID } = req.params;
    const { isPaid } = req.body;
    const [results] = await db.query(
      `
      UPDATE permissionattendance_emp
      SET isPaid = ?, updatedDate = ?, updatedBy = ?
      WHERE permissionID = ?
    `,
      [isPaid, ...camposAuditoriaUPDATE(req), permissionID]
    );
    if (results.affectedRows === 0) {
      return res.status(500).json({
        message: "Permiso no encontrado o ya está marcado como pagado.",
      });
    }
    res.json(results);
  } catch (err) {
    console.error("Error fetching all permissions:", err);
    res.status(500).json({
      message: "Error al cargar todos los permisos",
      error: err.message,
    });
  }
};

// Controlador para autorizar y registrar un permiso
// ACTUALIZADO: Ahora recibe y guarda los campos de hora exitTimePermission y entryTimePermission
exports.authorizePermission = async (req, res) => {
  try {
    // Extraemos también los nuevos campos de hora del cuerpo de la solicitud
    const {
      employeeID,
      permissionType,
      exitTimePermission,
      entryTimePermission,
    } = req.body;

    // Validación actualizada para incluir los nuevos campos obligatorios
    if (
      !employeeID ||
      !permissionType ||
      !exitTimePermission ||
      !entryTimePermission
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Datos incompletos. Se requiere ID de empleado, tipo de permiso, hora de salida y hora de entrada.",
      });
    }

    const [permissionResults] = await db.query(
      `
        SELECT * FROM permissionattendance_emp pa
          where pa.date = DATE(NOW()) and IsApproved
          and pa.employeeID = ? and isnull(pa.exitPermission)
        `,
      [employeeID]
    );

    if (permissionResults.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Ya existe un permiso pendiente de autorización para este empleado.",
      });
    }

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
      dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD"), // Fecha actual en formato YYYY-MM-DD
      dayjs(exitTimePermission).tz("America/Tegucigalpa").format("HH:mm"), // NUEVO: Hora de salida
      dayjs(entryTimePermission).tz("America/Tegucigalpa").format("HH:mm"), // NUEVO: Hora de entrada de regreso
      commentValue,
      isPaidValue,
      isApprovedValue,
      createdByValue,
      updatedByValue,
    ];

    const [result] = await db.query(query, values);

    if (result.affectedRows === 1) {
      const insertedId = result.insertId;
      res.status(201).json({
        success: true,
        message: "Permiso autorizado y registrado correctamente.",
        permissionId: insertedId,
      });
    } else {
      throw new Error(
        "No se pudo guardar el registro del permiso en la base de datos."
      );
    }
  } catch (error) {
    console.error("Error en authorizePermission:", error);
    res.status(500).json({
      success: false,
      message:
        "Ocurrió un error en el servidor al intentar autorizar el permiso.",
      error: error.message,
    });
  }
};
