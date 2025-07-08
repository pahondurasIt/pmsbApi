const db = require("../config/db"); // Importa la conexión a la base de datos
const dayjs = require("dayjs"); // Librería para manejar fechas y horas
const ExcelJS = require("exceljs"); // Librería para manejar Excel
const utc = require("dayjs/plugin/utc"); // Plugin para manejar UTC
const timezone = require("dayjs/plugin/timezone"); // Plugin para manejar zonas horarias
const isoWeek = require("dayjs/plugin/isoWeek"); // Plugin para manejar semanas ISO
const { io } = require('../app'); // Importar la instancia de Socket.IO

// Extender dayjs con los plugins de UTC, Timezone e ISO Week
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

// Función auxiliar para formatear la hora con AM/PM
const formatTimeWithPeriod = (dayjsDate) => {
  return dayjsDate.format("hh:mm:ss A"); // Formato hh:mm:ss AM/PM
};

// --- NUEVO: Función auxiliar para obtener un registro de asistencia completo ---
async function getSingleAttendanceRecord(employeeID, date) {
  const attendanceQuery = `
    SELECT 
      h.hattendanceID, h.employeeID,
      CONCAT(e.firstName, ' ', COALESCE(e.middleName, ''), ' ', e.lastName) AS employeeName,
      DATE_FORMAT(h.entryTime, '%h:%i:%s %p') AS entryTime,
      DATE_FORMAT(h.exitTime, '%h:%i:%s %p') AS exitTime,
      DATE_FORMAT(h.date, '%Y-%m-%d') AS date
    FROM h_attendance_emp h
    JOIN employees_emp e ON h.employeeID = e.employeeID
    WHERE h.employeeID = ? AND h.date = ?
    LIMIT 1;
  `;
  const [attendanceRows] = await db.query(attendanceQuery, [employeeID, date]);

  if (attendanceRows.length === 0) {
    return null; // No se encontró registro
  }
  
  const attendanceRecord = attendanceRows[0];

  const permissionQuery = `
    SELECT 
      permissionID,
      DATE_FORMAT(exitPermission, '%h:%i:%s %p') AS exitPermissionTime,
      DATE_FORMAT(entryPermission, '%h:%i:%s %p') AS entryPermissionTime,
      comment
    FROM permissionattendance_emp
    WHERE employeeID = ? AND DATE(date) = ?
    ORDER BY permissionID ASC
    LIMIT 5;
  `;
  const [permissionRows] = await db.query(permissionQuery, [employeeID, date]);
  
  permissionRows.forEach((permission, index) => {
    const pNum = index + 1;
    attendanceRecord[`permissionExitTime${pNum}`] = permission.exitPermissionTime || null;
    attendanceRecord[`permissionEntryTime${pNum}`] = permission.entryPermissionTime || null;
    attendanceRecord[`permissionExitID${pNum}`] = permission.permissionID;
    attendanceRecord[`permissionEntryID${pNum}`] = permission.permissionID;
    attendanceRecord[`permissionExitComment${pNum}`] = permission.comment || '';
    attendanceRecord[`permissionEntryComment${pNum}`] = permission.comment || '';
  });

  const dispatchingQuery = `
    SELECT 
      DATE_FORMAT(exitTimeComplete, '%h:%i:%s %p') AS dispatchingTime,
      CASE WHEN comment = 1 THEN 'Cumplimiento de Meta' ELSE '' END AS dispatchingComment
    FROM dispatching_emp
    WHERE employeeID = ? AND DATE(date) = ?
    LIMIT 1;
  `;
  const [dispatchingRows] = await db.query(dispatchingQuery, [employeeID, date]);

  if (dispatchingRows.length > 0) {
    attendanceRecord.dispatchingTime = dispatchingRows[0].dispatchingTime;
    attendanceRecord.dispatchingComment = dispatchingRows[0].dispatchingComment;
  }

  return attendanceRecord;
}

// --- Funciones Auxiliares (Permisos, etc.) ---
async function checkActivePermission(employeeID) {
  try {
    const currentDateOnly = dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD");
    const [permissionResults] = await db.query(
      `SELECT permissionID, exitPermission FROM permissionattendance_emp 
       WHERE employeeID = ? AND date = ? AND isApproved = 1 AND exitPermission IS NULL`,
      [employeeID, currentDateOnly]
    );
    return {
      hasActivePermission: permissionResults.length > 0,
      permissionData: permissionResults[0],
      hasExitedWithPermission: permissionResults[0]?.exitPermission !== null
    };
  } catch (error) {
    console.error("Error al verificar permiso activo:", error);
    return { hasActivePermission: false, error: error.message };
  }
}

async function checkPendingPermissionReturn(employeeID) {
  try {
    const currentDateOnly = dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD");
    const [permissionResults] = await db.query(
      `SELECT permissionID FROM permissionattendance_emp 
       WHERE employeeID = ? AND date = ? AND exitPermission IS NOT NULL AND entryPermission IS NULL`,
      [employeeID, currentDateOnly]
    );
    return {
      hasPendingReturn: permissionResults.length > 0,
      permissionData: permissionResults[0]
    };
  } catch (error) {
    console.error("Error al verificar permiso pendiente de regreso:", error);
    return { hasPendingReturn: false, error: error.message };
  }
}

async function updatePermissionRecordWithExit(permissionID, currentTime) {
  try {
    const [result] = await db.query(
      "UPDATE permissionattendance_emp SET exitPermission = ? WHERE permissionID = ?",
      [currentTime, permissionID]
    );
    return { success: result.affectedRows > 0 };
  } catch (error) {
    console.error("Error al registrar salida con permiso:", error);
    return { success: false, error: error.message };
  }
}

async function updatePermissionRecordWithEntry(permissionID, currentTime) {
  try {
    const [result] = await db.query(
      "UPDATE permissionattendance_emp SET entryPermission = ?, isApproved = 0 WHERE permissionID = ?",
      [currentTime, permissionID]
    );
    return { success: result.affectedRows > 0 };
  } catch (error) {
    console.error("Error al registrar entrada de regreso con permiso:", error);
    return { success: false, error: error.message };
  }
}

// --- Controladores (getAttendance, updatePermissionComment) ---
exports.getAttendance = async (req, res) => {
  try {
    const { startDate, endDate, specificDate } = req.query;

    let attendanceQuery = `
      SELECT 
        h.hattendanceID,
        h.employeeID,
        CONCAT(e.firstName, ' ', COALESCE(e.middleName, ''), ' ', e.lastName) AS employeeName,
        DATE_FORMAT(h.entryTime, '%h:%i:%s %p') AS entryTime,
        DATE_FORMAT(h.exitTime, '%h:%i:%s %p') AS exitTime,
        DATE_FORMAT(h.date, '%Y-%m-%d') AS date
      FROM 
        h_attendance_emp h
      JOIN 
        employees_emp e ON h.employeeID = e.employeeID
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
      attendanceQuery += " WHERE " + conditions.join(" AND ");
    }
    attendanceQuery += " ORDER BY h.employeeID ASC, h.entryTime ASC"; 

    const [attendanceRows] = await db.query(attendanceQuery, values);

    const processedRows = [];

    for (const attendanceRecord of attendanceRows) {
      const permissionQuery = `
        SELECT 
          permissionID,
          DATE_FORMAT(exitPermission, '%h:%i:%s %p') AS exitPermissionTime,
          DATE_FORMAT(entryPermission, '%h:%i:%s %p') AS entryPermissionTime,
          comment
        FROM 
          permissionattendance_emp
        WHERE 
          employeeID = ? 
          AND DATE(date) = ?
          AND (exitPermission IS NOT NULL OR entryPermission IS NOT NULL)
        ORDER BY 
          permissionID ASC
        LIMIT 5
      `;

      const [permissionRows] = await db.query(permissionQuery, [
        attendanceRecord.employeeID,
        attendanceRecord.date
      ]);

      const dispatchingQuery = `
        SELECT 
          DATE_FORMAT(exitTimeComplete, '%h:%i:%s %p') AS dispatchingTime,
          CASE WHEN comment = 1 THEN 'Cumplimiento de Meta' ELSE '' END AS dispatchingComment
        FROM 
        dispatching_emp
        WHERE 
          employeeID = ? 
          AND DATE(date) = ?
        LIMIT 1
      `;

      const [dispatchingRows] = await db.query(dispatchingQuery, [
        attendanceRecord.employeeID,
        attendanceRecord.date
      ]);

      const processedRecord = { ...attendanceRecord };

      permissionRows.forEach((permission, index) => {
        const permissionNumber = index + 1;
        if (permission.exitPermissionTime) {
          processedRecord[`permissionExitTime${permissionNumber}`] = permission.exitPermissionTime;
          processedRecord[`permissionExitID${permissionNumber}`] = permission.permissionID;
          processedRecord[`permissionExitComment${permissionNumber}`] = permission.comment || '';
        }
        if (permission.entryPermissionTime) {
          processedRecord[`permissionEntryTime${permissionNumber}`] = permission.entryPermissionTime;
          processedRecord[`permissionEntryID${permissionNumber}`] = permission.permissionID;
          processedRecord[`permissionEntryComment${permissionNumber}`] = permission.comment || '';
        }
      });
      processedRecord.totalPermissions = permissionRows.length;

      if (dispatchingRows.length > 0) {
        processedRecord.dispatchingTime = dispatchingRows[0].dispatchingTime;
        processedRecord.dispatchingComment = dispatchingRows[0].dispatchingComment;
      }

      processedRows.push(processedRecord);
    }

    res.status(200).json(processedRows);
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({ message: "Error al obtener datos de asistencia" });
  }
};

exports.updatePermissionComment = async (req, res) => {
  try {
    const { permissionID, comment } = req.body;

    if (!permissionID) {
      return res.status(400).json({ message: "El ID del permiso es requerido" });
    }

    const query = `
      UPDATE permissionattendance_emp 
      SET comment = ?
      WHERE permissionID = ?
    `;

    const [result] = await db.query(query, [comment, permissionID]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Permiso no encontrado" });
    }

    return res.status(200).json({
      success: true,
      message: "Comentario actualizado correctamente",
      permissionID,
      comment
    });
  } catch (error) {
    console.error("Error al actualizar comentario de permiso:", error);
    res.status(500).json({ message: "Error al actualizar comentario: " + error.message });
  }
};

// Controlador interno para registrar despacho
async function registerDispatchingInternal(req, res, employeeDetails, shiftDetails) {
  const { employeeID } = req.body;
  const currentDateTimeCST = dayjs().tz("America/Tegucigalpa");
  const currentTimeSQL = currentDateTimeCST.format("YYYY-MM-DD HH:mm:ss");
  const currentDateOnly = currentDateTimeCST.format("YYYY-MM-DD");
  const currentTimeFormatted = formatTimeWithPeriod(currentDateTimeCST);

  const { employeeName, photoUrl } = employeeDetails;
  const { shiftEndTimeStr } = shiftDetails;

  try {
    const pendingReturnStatus = await checkPendingPermissionReturn(employeeID);
    if (pendingReturnStatus.hasPendingReturn) {
      return res.status(400).json({
        message: "No puedes marcar despacho mientras estás fuera con permiso. Registra tu regreso primero.",
        employeeName, photoUrl
      });
    }

    const [existingDispatch] = await db.query(
      "SELECT dispatchingID FROM dispatching_emp WHERE employeeID = ? AND DATE(date) = ?",
      [employeeID, currentDateOnly]
    );
    if (existingDispatch.length > 0) {
      return res.status(400).json({
        message: "Ya has registrado tu despacho por hoy.",
        employeeName, photoUrl
      });
    }

    const [attendanceRecordToUpdate] = await db.query(
      "SELECT hattendanceID FROM h_attendance_emp WHERE employeeID = ? AND DATE(date) = ? AND entryTime IS NOT NULL AND exitTime IS NULL LIMIT 1",
      [employeeID, currentDateOnly]
    );
    if (attendanceRecordToUpdate.length === 0) {
      return res.status(400).json({
        message: "No se encontró un registro de entrada activo para marcar el despacho. Debes marcar tu entrada primero.",
        employeeName, photoUrl
      });
    }
    const attendanceIDToUpdate = attendanceRecordToUpdate[0].hattendanceID;

    const insertDispatchQuery = `
      INSERT INTO dispatching_emp (employeeID, supervisorID, date, exitTimeComplete, comment)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const supervisorID = req.body.supervisorID || null; // Use supervisorID from request, default to null if not provided
    const comment = 1;
    const values = [employeeID, supervisorID, currentDateOnly, currentTimeSQL, comment];
    const [resultDispatch] = await db.query(insertDispatchQuery, values);

    const scheduledExitTimeSQL = `${currentDateOnly} ${shiftEndTimeStr}`;
    const updateAttendanceQuery = `
        UPDATE h_attendance_emp 
        SET exitTime = ?
        WHERE hattendanceID = ?
    `;
    const [resultAttendanceUpdate] = await db.query(updateAttendanceQuery, [scheduledExitTimeSQL, attendanceIDToUpdate]);
    if (resultAttendanceUpdate.affectedRows === 0) {
      console.error(`Error: No se pudo actualizar exitTime para hattendanceID ${attendanceIDToUpdate} después de registrar despacho.`);
    }

    // Emitir registro completo y actualizado
    const fullRecord = await getSingleAttendanceRecord(employeeID, currentDateOnly);
    if (fullRecord) {
      io.emit('newAttendanceRecord', {
        type: 'update_record',
        record: fullRecord,
      });
    }

    return res.status(201).json({
      message: "Despacho registrado exitosamente. Tu hora de salida ha sido establecida a las " + formatTimeWithPeriod(dayjs(scheduledExitTimeSQL)),
      type: 'dispatching',
      time: currentTimeFormatted,
      employeeID, employeeName, photoUrl
    });

  } catch (error) {
    console.error("Error al registrar despacho:", error);
    return res.status(500).json({ message: "Error interno al registrar despacho: " + error.message });
  }
}

// Controlador para registrar asistencia
exports.registerAttendance = async (req, res) => {
  let employeeRecords = [];
  let shiftRecords = [];
  try {
    const { employeeID, operationMode } = req.body;
    if (!employeeID) {
      return res.status(400).json({ message: "El ID del empleado es requerido" });
    }

    const currentDateTimeCST = dayjs().tz("America/Tegucigalpa");
    const currentTimeSQL = currentDateTimeCST.format("YYYY-MM-DD HH:mm:ss");
    const currentDateOnly = currentDateTimeCST.format("YYYY-MM-DD");
    const currentTimeFormatted = formatTimeWithPeriod(currentDateTimeCST);

    [employeeRecords] = await db.query(
      "SELECT firstName, middleName, lastName, photoUrl, shiftID, isActive FROM employees_emp WHERE employeeID = ?",
      [employeeID]
    );
    if (employeeRecords.length === 0) {
      return res.status(404).json({ message: "Empleado no encontrado. Verifica el ID.", statusType: 'error' });
    }
    const employee = employeeRecords[0];

    if (employee.isActive === 0) {
      const employeeNameInactive = `${employee.firstName}${employee.middleName ? " " + employee.middleName : ""} ${employee.lastName}`;
      const photoUrlInactive = employee.photoUrl || "";
      return res.status(400).json({
        message: "El empleado está inactivo. No puede registrar marcaje.",
        statusType: 'warning',
        employeeName: employeeNameInactive,
        photoUrl: photoUrlInactive
      });
    }

    const employeeName = `${employee.firstName}${employee.middleName ? " " + employee.middleName : ""} ${employee.lastName}`;
    const photoUrl = employee.photoUrl || "";
    const shiftID = employee.shiftID;

    [shiftRecords] = await db.query(
      "SELECT startTime, endTime FROM detailsshift_emp WHERE shiftID = ?",
      [shiftID]
    );
    if (shiftRecords.length === 0) {
      return res.status(400).json({ message: "No se encontró información del turno para este empleado.", employeeName, photoUrl });
    }
    const shift = shiftRecords[0];
    const shiftStartTimeStr = shift.startTime;
    const shiftEndTimeStr = shift.endTime;

    const [finalizedCheck] = await db.query(
      `SELECT h.exitTime, d.dispatchingID 
         FROM h_attendance_emp h 
         LEFT JOIN dispatching_emp d ON h.employeeID = d.employeeID AND DATE(h.date) = DATE(d.date)
         WHERE h.employeeID = ? AND DATE(h.date) = ? 
         ORDER BY h.entryTime DESC LIMIT 1`,
      [employeeID, currentDateOnly]
    );
    if (finalizedCheck.length > 0 && (finalizedCheck[0].exitTime !== null || finalizedCheck[0].dispatchingID !== null)) {
      return res.status(400).json({
        message: "Ya has finalizado tu jornada laboral para hoy (Salida o Despacho registrado). No puedes realizar más marcajes.",
        employeeName, photoUrl
      });
    }

    const pendingReturnStatus = await checkPendingPermissionReturn(employeeID);
    if (pendingReturnStatus.hasPendingReturn) {
      if (operationMode === 'DESPACHO') {
        return res.status(400).json({
          message: "No puedes marcar despacho mientras estás fuera con permiso. Registra tu regreso primero.",
          employeeName, photoUrl
        });
      } else if (operationMode !== 'permission_entry') {
        const shiftStartTime = dayjs(`${currentDateOnly} ${shiftStartTimeStr}`, "YYYY-MM-DD HH:mm:ss").tz("America/Tegucigalpa", true);
        let shiftEndTime = dayjs(`${currentDateOnly} ${shiftEndTimeStr}`, "YYYY-MM-DD HH:mm:ss").tz("America/Tegucigalpa", true);
        if (shiftEndTime.isBefore(shiftStartTime)) shiftEndTime = shiftEndTime.add(1, 'day');

        if (!currentDateTimeCST.isAfter(shiftStartTime.subtract(1, 'hour')) || !currentDateTimeCST.isBefore(shiftEndTime.add(1, 'hour'))) {
          return res.status(400).json({
            message: `No se puede registrar entrada de regreso con permiso fuera del horario extendido del turno (${shiftStartTime.subtract(1, 'hour').format("h:mm A")} - ${shiftEndTime.add(1, 'hour').format("h:mm A")}).`,
            employeeName, photoUrl
          });
        }
        const updateResult = await updatePermissionRecordWithEntry(pendingReturnStatus.permissionData.permissionID, currentTimeSQL);
        if (!updateResult.success) {
          throw new Error("No se pudo actualizar el registro de permiso para regreso: " + (updateResult.error || "Error desconocido"));
        }
        // Emitir registro completo
        const fullRecord = await getSingleAttendanceRecord(employeeID, currentDateOnly);
        if (fullRecord) {
          io.emit('newAttendanceRecord', {
            type: 'update_record',
            record: fullRecord,
          });
        }
        return res.status(201).json({
          message: "Entrada de regreso con permiso registrada exitosamente",
          type: 'permission_entry',
          time: currentTimeFormatted,
          employeeID, employeeName, photoUrl,
          isPermissionEntry: true,
          permissionEntryTime: currentTimeFormatted
        });
      } else {
        return res.status(400).json({
          message: "Debes registrar tu regreso del permiso antes de realizar cualquier otro marcaje.",
          employeeName, photoUrl
        });
      }
    }

    if (operationMode === 'DESPACHO') {
      const employeeDetails = { employeeName, photoUrl };
      const shiftDetails = { shiftEndTimeStr };
      return await registerDispatchingInternal(req, res, employeeDetails, shiftDetails);
    }

    const shiftStartTime = dayjs(`${currentDateOnly} ${shiftStartTimeStr}`, "YYYY-MM-DD HH:mm:ss").tz("America/Tegucigalpa", true);
    let shiftEndTime = dayjs(`${currentDateOnly} ${shiftEndTimeStr}`, "YYYY-MM-DD HH:mm:ss").tz("America/Tegucigalpa", true);
    if (shiftEndTime.isBefore(shiftStartTime)) {
      shiftEndTime = shiftEndTime.add(1, 'day');
    }
    const entryWindowStart = shiftStartTime.subtract(15, 'minute');
    const exitWindowEnd = shiftEndTime.add(15, 'minute');
    const exitWindowStart = shiftStartTime;
    const canMarkEntry = currentDateTimeCST.isAfter(entryWindowStart) && currentDateTimeCST.isBefore(shiftEndTime);
    const canMarkExit = currentDateTimeCST.isAfter(exitWindowStart) && currentDateTimeCST.isBefore(exitWindowEnd);
    const isAfterShiftEnd = currentDateTimeCST.isAfter(shiftEndTime);

    const [existingRecords] = await db.query(
      "SELECT hattendanceID, entryTime, exitTime FROM h_attendance_emp WHERE employeeID = ? AND DATE(date) = ? ORDER BY entryTime DESC LIMIT 1",
      [employeeID, currentDateOnly]
    );

    let registrationType = '';
    let responseMessage = '';
    let attendanceID = null;
    let isPermissionExit = false;
    let permissionExitTime = null;
    let eventType = '';

    if (existingRecords.length === 0) {
      if (!canMarkEntry) {
        return res.status(400).json({
          message: `No se puede registrar entrada fuera del horario permitido (${entryWindowStart.format("h:mm A")} - ${shiftEndTime.format("h:mm A")}).`,
          employeeName, photoUrl
        });
      }
      const query = `INSERT INTO h_attendance_emp (employeeID, entryTime, date, createdBy, updatedBy) VALUES (?, ?, ?, ?, ?)`;
      const [result] = await db.query(query, [employeeID, currentTimeSQL, currentDateOnly, "1", "1"]);
      registrationType = 'entry';
      responseMessage = "Entrada registrada exitosamente";
      attendanceID = result.insertId;
      eventType = 'new_entry';
    } else {
      const latestRecord = existingRecords[0];
      eventType = 'update_record';

      if (!isAfterShiftEnd) {
        const permissionStatus = await checkActivePermission(employeeID);
        if (permissionStatus.hasActivePermission && !permissionStatus.hasExitedWithPermission) {
          const [permissionDetails] = await db.query(
            `SELECT exitTimePermission FROM permissionattendance_emp 
             WHERE employeeID = ? AND date = ? AND isApproved = 1 AND exitPermission IS NULL`,
            [employeeID, currentDateOnly]
          );
          const allowedExitTime = dayjs(`${currentDateOnly} ${permissionDetails[0].exitTimePermission}`, "YYYY-MM-DD HH:mm:ss").tz("America/Tegucigalpa", true);
          if (currentDateTimeCST.isBefore(allowedExitTime)) {
            return res.status(400).json({
              message: `No puedes registrar la salida con permiso hasta las ${allowedExitTime.format("h:mm A")}.`,
              employeeName, photoUrl
            });
          }
          isPermissionExit = true;
          permissionExitTime = currentTimeFormatted;
          const updateResult = await updatePermissionRecordWithExit(permissionStatus.permissionData.permissionID, currentTimeSQL);
          if (!updateResult.success) {
            throw new Error("No se pudo actualizar el registro de permiso para salida: " + (updateResult.error || "Error desconocido"));
          }
          registrationType = 'permission_exit';
          responseMessage = "Salida con permiso registrada exitosamente";
          attendanceID = latestRecord.hattendanceID;
        } else {
          return res.status(400).json({
            message: `Ya has registrado tu entrada hoy. Solo puedes registrar tu salida normal después de las ${shiftEndTime.format("h:mm A")} o una salida con permiso si está aprobada.`,
            employeeName, photoUrl
          });
        }
      } else {
        if (canMarkExit) {
          const query = `UPDATE h_attendance_emp SET exitTime = ?, updatedBy = ? WHERE hattendanceID = ?`;
          const [result] = await db.query(query, [currentTimeSQL, "1", latestRecord.hattendanceID]);
          if (result.affectedRows === 0) {
            throw new Error("No se pudo actualizar el registro de asistencia para salida.");
          }
          registrationType = 'exit';
          responseMessage = "Salida registrada exitosamente";
          attendanceID = latestRecord.hattendanceID;
        } else {
          return res.status(400).json({
            message: `No se puede registrar salida fuera del horario permitido (${exitWindowStart.format("h:mm A")} - ${exitWindowEnd.format("h:mm A")}).`,
            employeeName, photoUrl
          });
        }
      }
    }

    // Emitir registro completo
    const fullRecord = await getSingleAttendanceRecord(employeeID, currentDateOnly);
    if (fullRecord) {
      io.emit('newAttendanceRecord', {
        type: eventType,
        record: fullRecord,
      });
    }

    res.status(201).json({
      message: responseMessage,
      type: registrationType,
      time: currentTimeFormatted,
      employeeID, employeeName, photoUrl, attendanceID,
      isPermissionExit: isPermissionExit,
      permissionExitTime: permissionExitTime
    });

  } catch (error) {
    console.error("Error en registerAttendance:", error);
    const employeeInfoForError = employeeRecords && employeeRecords.length > 0 ? {
      employeeName: `${employeeRecords[0].firstName}${employeeRecords[0].middleName ? " " + employeeRecords[0].middleName : ""} ${employeeRecords[0].lastName}`,
      photoUrl: employeeRecords[0].photoUrl || ""
    } : {};
    res.status(500).json({
      message: "Error interno del servidor al registrar la asistencia.",
      ...employeeInfoForError
    });
  }
};

// Controlador para exportar asistencia de un día específico a Excel
exports.exportAttendance = async (req, res) => {
  try {
    const { filteredAttendance, selectedDate } = req.body;

    if (!filteredAttendance || !Array.isArray(filteredAttendance) || filteredAttendance.length === 0) {
      throw new Error("filteredAttendance is missing or empty.");
    }
    if (!selectedDate || typeof selectedDate !== "string") {
      throw new Error("selectedDate is missing or invalid.");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Asistencia");

    let maxPermsInDay = 0;
    filteredAttendance.forEach(record => {
      let currentPerms = 0;
      for (let i = 1; i <= 5; i++) {
        if (record[`permissionExitTime${i}`] || record[`permissionEntryTime${i}`]) {
          currentPerms = i;
        }
      }
      if (currentPerms > maxPermsInDay) {
        maxPermsInDay = currentPerms;
      }
    });

    const columnHeaders = ["Correlativo", "Código", "Nombre", "Entrada"];
    const columnWidths = [10, 10, 30, 12];

    for (let i = 1; i <= maxPermsInDay; i++) {
      columnHeaders.push(`Permiso ${i} S.`);
      columnHeaders.push(`Permiso ${i} E.`);
      columnWidths.push(12, 12);
    }

    columnHeaders.push("Salida");
    columnWidths.push(12);

    columnHeaders.push("Comentarios");
    columnWidths.push(30);

    const numberOfColumns = columnHeaders.length;

    const titleBgColor = "E6F0FA";
    const subtitleBgColor = "F2F2F2";
    const headerBgColor = "D3D3D3";

    const titleText = `Reporte de Asistencia - Día ${dayjs(selectedDate).format("DD/MM/YYYY")}`;
    const titleRow = worksheet.addRow([titleText]);
    titleRow.height = 30;

    worksheet.mergeCells(titleRow.number, 1, titleRow.number, numberOfColumns);

    for (let i = 1; i <= numberOfColumns; i++) {
      const cell = worksheet.getCell(titleRow.number, i);
      cell.font = { name: "Calibri", size: 16, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: titleBgColor } };
    }

    const employeeCount = filteredAttendance.length;
    const subtitleText = `Empleados registrados: ${employeeCount}`;
    const subtitleRow = worksheet.addRow([subtitleText]);
    subtitleRow.height = 25;

    worksheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, numberOfColumns);

    for (let i = 1; i <= numberOfColumns; i++) {
      const cell = worksheet.getCell(subtitleRow.number, i);
      cell.font = { name: "Calibri", size: 12, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: subtitleBgColor } };
    }

    const headerRow = worksheet.addRow(columnHeaders);
    headerRow.height = 20;

    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 12, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBgColor } };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };
    });

    filteredAttendance.forEach((record, index) => {
      const rowData = [
        index + 1,
        record.employeeID || "",
        record.employeeName || "",
        record.entryTime || "",
      ];

      for (let i = 1; i <= maxPermsInDay; i++) {
        rowData.push(record[`permissionExitTime${i}`] || "");
        rowData.push(record[`permissionEntryTime${i}`] || "");
      }

      rowData.push(record.exitTime || "");

      const comments = [];
      for (let i = 1; i <= 5; i++) {
        if (record[`permissionExitComment${i}`]) {
          comments.push(`P${i}S: ${record[`permissionExitComment${i}`]}`);
        }
        if (record[`permissionEntryComment${i}`]) {
          comments.push(`P${i}E: ${record[`permissionEntryComment${i}`]}`);
        }
      }
      if (record.exitComment) {
        comments.push(`Salida: ${record.exitComment}`);
      }
      if (record.dispatchingComment) {
        comments.push(`Despacho: ${record.dispatchingComment}`);
      }
      rowData.push(comments.join(" | ") || "");
      worksheet.addRow(rowData);
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 3) {
        row.eachCell((cell) => {
          cell.font = { name: "Calibri", size: 11 };
          cell.alignment = { horizontal: "left", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          };
        });
        row.height = 20;
      }
    });

    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();
    const formattedDate = dayjs(selectedDate).format("YYYYMMDD");
    const filename = `asistencia_dia_${formattedDate}.xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(excelBuffer);
  } catch (error) {
    console.error("Error al exportar asistencia:", error.stack || error.message);
    res.status(500).send({ message: `Error interno del servidor al generar el archivo Excel: ${error.message}` });
  }
};

// Controlador para exportar asistencia semanal a Excel
exports.exportWeeklyAttendance = async (req, res) => {
  try {
    const { weeklyAttendance, selectedMonth, selectedWeek } = req.body;

    if (!weeklyAttendance || !Array.isArray(weeklyAttendance)) {
      throw new Error("weeklyAttendance is missing or invalid.");
    }
    if (!selectedMonth || typeof selectedMonth !== "string") {
      throw new Error("selectedMonth is missing or invalid.");
    }
    if (!selectedWeek || typeof selectedWeek !== "string") {
      throw new Error("selectedWeek is missing or invalid.");
    }

    const [activeEmployees] = await db.query(
      "SELECT employeeID, CONCAT(firstName, ' ', COALESCE(middleName, ''), ' ', lastName) AS employeeName FROM employees_emp WHERE isActive = 1"
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Asistencia Semanal");

    const headerBgColor = "1F3864";
    const subHeaderBgColor = "D6DCE4";

    const dayHeaderColors = {
      Lunes: "FFFFFF",
      Martes: "FFC0CB",
      Miércoles: "FFFFFF",
      Jueves: "FFFFFF",
      Viernes: "FFFFFF",
      Sábado: "D3D3D3",
      Domingo: "D3D3D3",
    };

    const startOfMonth = dayjs().month(parseInt(selectedMonth)).startOf("month");
    const startOfWeek = startOfMonth.isoWeek(parseInt(selectedWeek)).startOf("isoWeek");
    const daysOfWeek = [];
    for (let i = 0; i < 7; i++) {
      const day = startOfWeek.add(i, "day");
      daysOfWeek.push({
        date: day.format("YYYY-MM-DD"),
        dayName: day.format("dddd").charAt(0).toUpperCase() + day.format("dddd").slice(1),
        shortDate: day.format("DD/MM"),
        fullDate: day.format("D [DE] MMMM").toUpperCase(),
      });
    }

    const sanitizedWeeklyAttendance = weeklyAttendance.map((record) => {
      const sanitizeString = (value) => {
        if (typeof value !== "string") return value || "";
        return value
          .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
          .replace(/\n/g, " ")
          .replace(/\r/g, "")
          .replace(/[^\x20-\x7EáéíóúÁÉÍÓÚñÑ]/g, "");
      };
      return {
        employeeID: sanitizeString(record.employeeID),
        employeeName: sanitizeString(record.employeeName),
        date: sanitizeString(record.date),
        entryTime: sanitizeString(record.entryTime),
        exitTime: sanitizeString(record.exitTime),
        dispatchingTime: sanitizeString(record.dispatchingTime),
        dispatchingComment: sanitizeString(record.dispatchingComment),
        exitComment: sanitizeString(record.exitComment),
        ...(Array.from({ length: 5 }, (_, i) => ({
          [`permissionExitTime${i + 1}`]: sanitizeString(record[`permissionExitTime${i + 1}`]),
          [`permissionEntryTime${i + 1}`]: sanitizeString(record[`permissionEntryTime${i + 1}`]),
          [`permissionExitComment${i + 1}`]: sanitizeString(record[`permissionExitComment${i + 1}`]),
          [`permissionEntryComment${i + 1}`]: sanitizeString(record[`permissionEntryComment${i + 1}`]),
        })).reduce((acc, curr) => ({ ...acc, ...curr }), {})),
      };
    });

    const includeDispatchColumn = sanitizedWeeklyAttendance.some((record) => record.dispatchingTime);
    let maxPermsInWeek = 0;
    sanitizedWeeklyAttendance.forEach(record => {
      let currentPerms = 0;
      for (let i = 1; i <= 5; i++) {
        if (record[`permissionExitTime${i}`] || record[`permissionEntryTime${i}`]) {
          currentPerms = i;
        }
      }
      if (currentPerms > maxPermsInWeek) {
        maxPermsInWeek = currentPerms;
      }
    });

    const dynamicPermColumnsPerDay = maxPermsInWeek * 2;
    const columnsPerDay = 1 + dynamicPermColumnsPerDay + (includeDispatchColumn ? 1 : 0) + 1;
    const totalDataColumns = 3 + (daysOfWeek.length * columnsPerDay) + 1;

    const year = dayjs().year();
    const monthName = dayjs().month(parseInt(selectedMonth)).format("MMMM").toUpperCase();
    const title = `Reporte Semanal - Mes ${monthName} Semana ${selectedWeek}`;
    worksheet.addRow([title]);
    worksheet.mergeCells(1, 1, 1, totalDataColumns);
    worksheet.getRow(1).font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFF" } };
    worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBgColor } };
    worksheet.getRow(1).height = 30;

    const employeeCount = activeEmployees.length;
    const subtitle = `Total de empleados activos: ${employeeCount}`;
    worksheet.addRow([subtitle]);
    worksheet.mergeCells(2, 1, 2, totalDataColumns);
    worksheet.getRow(2).font = { name: "Calibri", size: 12, bold: true };
    worksheet.getRow(2).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    worksheet.getRow(2).height = 25;

    const mainHeaderRowData = ["Correlativo", "Código", "Empleado"];
    for (let i = 0; i < daysOfWeek.length; i++) {
      mainHeaderRowData.push(...Array(columnsPerDay).fill(""));
    }
    mainHeaderRowData.push("Comentarios");

    const mainHeaderRow = worksheet.addRow(mainHeaderRowData);
    mainHeaderRow.height = 20;

    const subHeaderRowData = ["", "", ""];
    daysOfWeek.forEach(() => {
      subHeaderRowData.push("E");
      for (let i = 1; i <= maxPermsInWeek; i++) {
        subHeaderRowData.push(`P${i}S`);
        subHeaderRowData.push(`P${i}E`);
      }
      if (includeDispatchColumn) {
        subHeaderRowData.push("D");
      }
      subHeaderRowData.push("S");
    });
    subHeaderRowData.push("");

    const subHeaderRow = worksheet.addRow(subHeaderRowData);
    subHeaderRow.height = 25;

    worksheet.mergeCells(3, 1, 4, 1);
    worksheet.mergeCells(3, 2, 4, 2);
    worksheet.mergeCells(3, 3, 4, 3);
    worksheet.mergeCells(3, totalDataColumns, 4, totalDataColumns);

    worksheet.getCell('A3').font = { name: "Calibri", size: 12, bold: true };
    worksheet.getCell('A3').alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell('A3').fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF" } };
    worksheet.getCell('A3').border = {
      top: { style: "thin", color: { argb: "000000" } }, bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } }, right: { style: "thin", color: { argb: "000000" } }
    };

    worksheet.getCell('B3').font = { name: "Calibri", size: 12, bold: true };
    worksheet.getCell('B3').alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell('B3').fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF" } };
    worksheet.getCell('B3').border = {
      top: { style: "thin", color: { argb: "000000" } }, bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } }, right: { style: "thin", color: { argb: "000000" } }
    };

    worksheet.getCell('C3').font = { name: "Calibri", size: 12, bold: true };
    worksheet.getCell('C3').alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell('C3').fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF" } };
    worksheet.getCell('C3').border = {
      top: { style: "thin", color: { argb: "000000" } }, bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } }, right: { style: "thin", color: { argb: "000000" } }
    };

    const commentsCell = worksheet.getCell(3, totalDataColumns);
    commentsCell.font = { name: "Calibri", size: 12, bold: true };
    commentsCell.alignment = { horizontal: "center", vertical: "middle" };
    commentsCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF" } };
    commentsCell.border = {
      top: { style: "thin", color: { argb: "000000" } }, bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } }, right: { style: "thin", color: { argb: "000000" } }
    };

    let currentMergeCol = 4;
    daysOfWeek.forEach((day) => {
      worksheet.mergeCells(3, currentMergeCol, 3, currentMergeCol + columnsPerDay - 1);
      const cell = worksheet.getCell(3, currentMergeCol);
      cell.value = `${day.dayName} ${day.shortDate}`;
      cell.font = { name: "Calibri", size: 12, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dayHeaderColors[day.dayName] || "FFFFFF" } };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };
      currentMergeCol += columnsPerDay;
    });

    subHeaderRow.font = { name: "Calibri", size: 11, bold: true };
    subHeaderRow.alignment = { horizontal: "center", vertical: "middle" };
    subHeaderRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };
      if (colNumber >= 4 && colNumber < totalDataColumns) {
        const currentDayColIndex = (colNumber - 4) % columnsPerDay;
        if (currentDayColIndex === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "C6EFCE" } };
        } else if (currentDayColIndex === (columnsPerDay - 1)) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC7CE" } };
        } else if (includeDispatchColumn && currentDayColIndex === (1 + dynamicPermColumnsPerDay)) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEB9C" } };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: subHeaderBgColor } };
        }
      }
    });

    const tableData = activeEmployees.map((employee, empIndex) => {
      const rowData = [empIndex + 1, employee.employeeID, employee.employeeName];
      const weekComments = [];

      daysOfWeek.forEach((day) => {
        const record = sanitizedWeeklyAttendance.find((att) => att.employeeID === employee.employeeID && att.date === day.date) || {};

        rowData.push(record.entryTime || "-");
        for (let i = 1; i <= maxPermsInWeek; i++) {
          rowData.push(record[`permissionExitTime${i}`] || "-");
          rowData.push(record[`permissionEntryTime${i}`] || "-");
        }
        if (includeDispatchColumn) {
          rowData.push(record.dispatchingTime || "-");
        }
        rowData.push(record.exitTime || "-");

        const dayComments = [];
        for (let i = 1; i <= 5; i++) {
          if (record[`permissionExitComment${i}`]) {
            dayComments.push(`${day.dayName.substring(0, 3)} P${i}S: ${record[`permissionExitComment${i}`]}`);
          }
          if (record[`permissionEntryComment${i}`]) {
            dayComments.push(`${day.dayName.substring(0, 3)} P${i}E: ${record[`permissionEntryComment${i}`]}`);
          }
        }
        if (record.exitComment) {
          dayComments.push(`${day.dayName.substring(0, 3)} Salida: ${record.exitComment}`);
        }
        if (record.dispatchingComment) {
          dayComments.push(`${day.dayName.substring(0, 3)} Despacho: ${record.dispatchingComment}`);
        }
        weekComments.push(...dayComments);
      });

      rowData.push(weekComments.join(" | ") || "");
      return rowData;
    });

    tableData.forEach((row) => worksheet.addRow(row));

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 4) {
        row.eachCell((cell) => {
          cell.font = { name: "Calibri", size: 11 };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          };
          row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber % 2 === 1 ? "F5F5F5" : "FFFFFF" } };
        });
        row.height = 20;
      }
    });

    const columnWidthsDefinition = [
      { width: 10 },
      { width: 10 },
      { width: 30 },
    ];
    for (let i = 0; i < daysOfWeek.length; i++) {
      columnWidthsDefinition.push({ width: 12 });
      for (let j = 1; j <= maxPermsInWeek; j++) {
        columnWidthsDefinition.push({ width: 12 });
        columnWidthsDefinition.push({ width: 12 });
      }
      if (includeDispatchColumn) {
        columnWidthsDefinition.push({ width: 12 });
      }
      columnWidthsDefinition.push({ width: 12 });
    }
    columnWidthsDefinition.push({ width: 50 });

    worksheet.columns = columnWidthsDefinition;

    const excelBuffer = await workbook.xlsx.writeBuffer();
    const filename = `asistencia_semanal_semana${selectedWeek}_${year}.xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(excelBuffer);
  } catch (error) {
    console.error("Error al exportar asistencia semanal:", error.stack || error.message);
    res.status(500).send({ message: `Error interno del servidor al generar el archivo Excel: ${error.message}` });
  }
};

// Controlador para exportar asistencia semanal con fechas automáticas
exports.exportWeeklyAttendanceAuto = async (req, res) => {
  try {
    const currentDate = dayjs().tz("America/Tegucigalpa");
    const startOfWeek = currentDate.subtract(1, 'week').startOf("isoWeek").format("YYYY-MM-DD");
    const endOfWeek = currentDate.subtract(1, 'week').endOf("isoWeek").format("YYYY-MM-DD");

    const attendanceQuery = `
      SELECT 
        h.hattendanceID,
        h.employeeID,
        CONCAT(e.firstName, ' ', COALESCE(e.middleName, ''), ' ', e.lastName) AS employeeName,
        DATE_FORMAT(h.entryTime, '%h:%i:%s %p') AS entryTime,
        DATE_FORMAT(h.exitTime, '%h:%i:%s %p') AS exitTime,
        DATE_FORMAT(h.date, '%Y-%m-%d') AS date,
        h.exitComment
      FROM 
        h_attendance_emp h
      JOIN 
        employees_emp e ON h.employeeID = e.employeeID
      WHERE 
        h.date BETWEEN ? AND ?
        AND e.isActive = 1
      ORDER BY h.employeeID, h.date DESC
    `;

    const [attendanceRows] = await db.query(attendanceQuery, [startOfWeek, endOfWeek]);

    const processedRows = [];

    for (const attendanceRecord of attendanceRows) {
      const permissionQuery = `
        SELECT 
          permissionID,
          DATE_FORMAT(exitPermission, '%h:%i:%s %p') AS exitPermissionTime,
          DATE_FORMAT(entryPermission, '%h:%i:%s %p') AS entryPermissionTime,
          comment
        FROM 
          permissionattendance_emp
        WHERE 
          employeeID = ? 
          AND DATE(date) = ?
          AND (exitPermission IS NOT NULL OR entryPermission IS NOT NULL)
        ORDER BY 
          permissionID ASC
        LIMIT 5
      `;

      const [permissionRows] = await db.query(permissionQuery, [
        attendanceRecord.employeeID,
        attendanceRecord.date
      ]);

      const dispatchingQuery = `
        SELECT 
          DATE_FORMAT(exitTimeComplete, '%h:%i:%s %p') AS dispatchingTime,
          CASE WHEN comment = 1 THEN 'Cumplimiento de Meta' ELSE '' END AS dispatchingComment
        FROM 
        dispatching_emp
        WHERE 
          employeeID = ? 
          AND DATE(date) = ?
        LIMIT 1
      `;

      const [dispatchingRows] = await db.query(dispatchingQuery, [
        attendanceRecord.employeeID,
        attendanceRecord.date
      ]);

      const processedRecord = { ...attendanceRecord };

      permissionRows.forEach((permission, index) => {
        const permissionNumber = index + 1;
        if (permission.exitPermissionTime) {
          processedRecord[`permissionExitTime${permissionNumber}`] = permission.exitPermissionTime;
          processedRecord[`permissionExitComment${permissionNumber}`] = permission.comment || '';
        }
        if (permission.entryPermissionTime) {
          processedRecord[`permissionEntryTime${permissionNumber}`] = permission.entryPermissionTime;
          processedRecord[`permissionEntryComment${permissionNumber}`] = permission.comment || '';
        }
      });

      if (dispatchingRows.length > 0) {
        processedRecord.dispatchingTime = dispatchingRows[0].dispatchingTime;
        processedRecord.dispatchingComment = dispatchingRows[0].dispatchingComment;
      }

      processedRows.push(processedRecord);
    }

    const weekNumber = currentDate.subtract(1, 'week').isoWeek();
    const monthNumber = currentDate.subtract(1, 'week').month();

    const reqBody = {
      body: {
        weeklyAttendance: processedRows,
        selectedMonth: monthNumber.toString(),
        selectedWeek: weekNumber.toString()
      }
    };

    await exports.exportWeeklyAttendance(reqBody, res);

  } catch (error) {
    console.error("Error al exportar asistencia semanal automática:", error.stack || error.message);
    res.status(500).send({ message: `Error interno del servidor al generar el archivo Excel: ${error.message}` });
  }
};