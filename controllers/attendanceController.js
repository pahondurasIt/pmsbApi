const db = require("../config/db");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

// Extender dayjs con los plugins de UTC y Timezone
dayjs.extend(utc);
dayjs.extend(timezone);

// Función auxiliar para formatear la hora con AM/PM
const formatTimeWithPeriod = (dayjsDate) => {
  return dayjsDate.format("h:mm:ss A"); // Formato: 9:30:25 AM
};

// Controlador para obtener registros de asistencia
exports.getAttendance = async (req, res) => {
  try {
    const { startDate, endDate, specificDate } = req.query;
    let query = `
      SELECT 
        h.employeeID,
        CONCAT(e.firstName, ' ', COALESCE(e.middleName, ''), ' ', e.lastName) AS employeeName,
        DATE_FORMAT(h.entryTime, '%h:%i:%s %p') AS entryTime,
        DATE_FORMAT(h.exitTime, '%h:%i:%s %p') AS exitTime,
        DATE_FORMAT(h.date, '%Y-%m-%d') AS date,
        p.exitPermission AS exitPermission
      FROM 
        h_attendance_emp h
      JOIN 
        employees_emp e ON h.employeeID = e.employeeID
      LEFT JOIN 
        permissionattendance_emp p ON h.employeeID = p.employeeID AND DATE(h.date) = DATE(p.date) AND p.isApproved = 1
    `;
    const conditions = [];
    const values = [];

    if (startDate && endDate) {
      conditions.push("h.date BETWEEN ? AND ?");
      values.push(startDate, endDate);
    }
    if (specificDate) {
      conditions.push("h.date = ?");
      values.push(specificDate);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY h.employeeID, h.date DESC";

    const [rows] = await db.query(query, values);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({ message: "Error al obtener datos de asistencia" });
  }
};

// NUEVA FUNCIÓN UNIFICADA PARA REGISTRAR ENTRADA O SALIDA CON PERMISOS
exports.registerAttendance = async (req, res) => {
  try {
    const { employeeID } = req.body;
    if (!employeeID) {
      return res.status(400).json({ message: "El ID del empleado es requerido" });
    }

    // Obtener fecha y hora actual en Honduras
    const currentDateTimeCST = dayjs().tz("America/Tegucigalpa");
    const currentTimeSQL = currentDateTimeCST.format("YYYY-MM-DD HH:mm:ss");
    const currentDateOnly = currentDateTimeCST.format("YYYY-MM-DD");
    const currentTimeFormatted = formatTimeWithPeriod(currentDateTimeCST);
    const currentHour = currentDateTimeCST.hour();
    const currentMinute = currentDateTimeCST.minute();

    // Verificar si el empleado existe y obtener datos
    const [employeeRecords] = await db.query(
      "SELECT firstName, middleName, lastName, photoUrl FROM employees_emp WHERE employeeID = ?",
      [employeeID]
    );

    if (employeeRecords.length === 0) {
      return res.status(404).json({ message: "Empleado no encontrado. Verifica el ID." });
    }

    const employee = employeeRecords[0];
    const employeeName = `${employee.firstName}${employee.middleName ? " " + employee.middleName : ""} ${employee.lastName}`;
    const photoUrl = employee.photoUrl || "";

    // Buscar registro de asistencia y permiso para hoy
    const [existingRecords] = await db.query(
      "SELECT hattendanceID, entryTime, exitTime FROM h_attendance_emp WHERE employeeID = ? AND DATE(date) = ? ORDER BY entryTime DESC LIMIT 1",
      [employeeID, currentDateOnly]
    );

    const [activePermission] = await db.query(
      "SELECT permissionTypeID, exitPermission FROM permissionattendance_emp WHERE employeeID = ? AND DATE(date) = ? AND isApproved = 1 AND exitPermission IS NULL",
      [employeeID, currentDateOnly]
    );

    let registrationType = '';
    let responseMessage = '';
    let attendanceID = null;

    // Restricción: No permitir entrada si ya hay una entrada sin salida
    if (existingRecords.length > 0 && existingRecords[0].entryTime && !existingRecords[0].exitTime && !activePermission.length) {
      return res.status(400).json({
        message: "Ya registraste tu entrada. Necesitas un permiso activo para registrar salida o reingreso.",
        employeeName,
        photoUrl
      });
    }

    // Verificar ventana de 3:00 PM a 4:45 PM para permisos
    const isPermissionWindow = currentHour >= 15 && currentHour < 16 && (currentHour !== 15 || currentMinute >= 0) && (currentHour !== 16 || currentMinute <= 45);
    if (isPermissionWindow && activePermission.length > 0) {
      if (!existingRecords.length || (existingRecords[0].exitTime && !existingRecords[0].entryTime)) {
        // Registrar entrada si no hay registro o hay salida previa
        const query = `
          INSERT INTO h_attendance_emp (employeeID, entryTime, date, createdBy, updatedBy)
          VALUES (?, ?, ?, ?, ?)
        `;
        const createdBy = "1";
        const updatedBy = "1";
        const values = [employeeID, currentTimeSQL, currentDateOnly, createdBy, updatedBy];
        const [result] = await db.query(query, values);

        registrationType = 'entry';
        responseMessage = "Reingreso registrado exitosamente";
        attendanceID = result.insertId;
      } else if (existingRecords[0].entryTime && !existingRecords[0].exitTime) {
        // Registrar salida con permiso
        const query = `
          UPDATE h_attendance_emp 
          SET exitTime = ?, updatedBy = ?
          WHERE hattendanceID = ?
        `;
        const updatedBy = "1";
        const values = [currentTimeSQL, updatedBy, existingRecords[0].hattendanceID];
        await db.query(query, values);

        // Actualizar exitPermission en permissionattendance_emp
        await db.query(
          "UPDATE permissionattendance_emp SET exitPermission = ? WHERE employeeID = ? AND DATE(date) = ? AND isApproved = 1 AND exitPermission IS NULL",
          [currentTimeSQL, employeeID, currentDateOnly]
        );

        registrationType = 'exit';
        responseMessage = "Salida por permiso registrada exitosamente";
        attendanceID = existingRecords[0].hattendanceID;
      }
    } else if (!existingRecords.length) {
      // Registrar entrada si no hay registros previos
      const query = `
        INSERT INTO h_attendance_emp (employeeID, entryTime, date, createdBy, updatedBy)
        VALUES (?, ?, ?, ?, ?)
      `;
      const createdBy = "1";
      const updatedBy = "1";
      const values = [employeeID, currentTimeSQL, currentDateOnly, createdBy, updatedBy];
      const [result] = await db.query(query, values);

      registrationType = 'entry';
      responseMessage = "Entrada registrada exitosamente";
      attendanceID = result.insertId;
    } else if (existingRecords[0].entryTime && !existingRecords[0].exitTime) {
      // Registrar salida normal
      const query = `
        UPDATE h_attendance_emp 
        SET exitTime = ?, updatedBy = ?
        WHERE hattendanceID = ?
      `;
      const updatedBy = "1";
      const values = [currentTimeSQL, updatedBy, existingRecords[0].hattendanceID];
      await db.query(query, values);

      registrationType = 'exit';
      responseMessage = "Salida registrada exitosamente";
      attendanceID = existingRecords[0].hattendanceID;
    } else {
      return res.status(400).json({
        message: "Ya se registró tanto la entrada como la salida para hoy.",
        employeeName,
        photoUrl
      });
    }

    res.status(201).json({
      message: responseMessage,
      type: registrationType,
      time: currentTimeFormatted,
      hattendanceID: attendanceID,
      employeeName,
      photoUrl
    });
  } catch (error) {
    console.error("Error registering attendance:", error);
    res.status(500).json({ message: "Error al procesar el registro. Intenta de nuevo." });
  }
};