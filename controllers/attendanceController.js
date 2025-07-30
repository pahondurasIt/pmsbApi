const db = require("../config/db"); // Importa la conexión a la base de datos
const dayjs = require("dayjs"); // Librería para manejar fechas y horas
const ExcelJS = require("exceljs"); // Librería para manejar Excel
const utc = require("dayjs/plugin/utc"); // Plugin para manejar UTC
const timezone = require("dayjs/plugin/timezone"); // Plugin para manejar zonas horarias
const isoWeek = require("dayjs/plugin/isoWeek"); // Plugin para manejar semanas ISO
const { io } = require("../app"); // Importar la instancia de Socket.IO
const jwt = require("jsonwebtoken"); // Para decodificar el token JWT

// Extender dayjs con los plugins de UTC, Timezone e ISO Week
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

// Función de ayuda para formatear la hora con AM/PM
const formatTimeWithPeriod = (dayjsDate) => {
  return dayjsDate.format("hh:mm:ss A"); // Formato hh:mm:ss AM/PM
};

// Función de ayuda para obtener el ID de usuario del token JWT
const getUserIdFromToken = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7); // Remover 'Bearer '
    const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";
    const decoded = jwt.verify(token, JWT_SECRET);

    return decoded.id; // Retorna el userID del token
  } catch (error) {
    console.error("Error al decodificar token JWT:", error);
    return null;
  }
};

// Función de ayuda para recuperar un registro completo de asistencia
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
    attendanceRecord[`permissionExitTime${pNum}`] =
      permission.exitPermissionTime || null;
    attendanceRecord[`permissionEntryTime${pNum}`] =
      permission.entryPermissionTime || null;
    attendanceRecord[`permissionExitID${pNum}`] = permission.permissionID;
    attendanceRecord[`permissionEntryID${pNum}`] = permission.permissionID;
    attendanceRecord[`permissionExitComment${pNum}`] = permission.comment || "";
    attendanceRecord[`permissionEntryComment${pNum}`] =
      permission.comment || "";
  });

  const dispatchingQuery = `
    SELECT 
      DATE_FORMAT(exitTimeComplete, '%h:%i:%s %p') AS dispatchingTime,
      CASE WHEN comment = 1 THEN 'Meta' ELSE '' END AS dispatchingComment
    FROM dispatching_emp
    WHERE employeeID = ? AND DATE(date) = ?
    LIMIT 1;
  `;
  const [dispatchingRows] = await db.query(dispatchingQuery, [
    employeeID,
    date,
  ]);

  if (dispatchingRows.length > 0) {
    attendanceRecord.dispatchingTime = dispatchingRows[0].dispatchingTime;
    attendanceRecord.dispatchingComment = dispatchingRows[0].dispatchingComment;
  }

  return attendanceRecord;
}

// Funciones de ayuda para verificaciones y actualizaciones de permisos
async function checkActivePermission(employeeID) {
  try {
    const currentDateOnly = dayjs()
      .tz("America/Tegucigalpa")
      .format("YYYY-MM-DD");
    const [permissionResults] = await db.query(
      `SELECT permissionID, exitPermission FROM permissionattendance_emp 
       WHERE employeeID = ? AND date = ? AND isApproved = 1 AND exitPermission IS NULL`,
      [employeeID, currentDateOnly]
    );
    return {
      hasActivePermission: permissionResults.length > 0,
      permissionData: permissionResults[0],
      hasExitedWithPermission: permissionResults[0]?.exitPermission !== null,
    };
  } catch (error) {
    console.error("Error al verificar permiso activo:", error);
    return { hasActivePermission: false, error: error.message };
  }
}

async function checkPendingPermissionReturn(employeeID) {
  try {
    const currentDateOnly = dayjs()
      .tz("America/Tegucigalpa")
      .format("YYYY-MM-DD");
    const [permissionResults] = await db.query(
      `SELECT permissionID FROM permissionattendance_emp 
       WHERE employeeID = ? AND date = ? AND exitPermission IS NOT NULL AND entryPermission IS NULL`,
      [employeeID, currentDateOnly]
    );
    return {
      hasPendingReturn: permissionResults.length > 0,
      permissionData: permissionResults[0],
    };
  } catch (error) {
    console.error("Error al verificar permiso pendiente de regreso:", error);
    return { hasPendingReturn: false, error: error.message };
  }
}

async function updatePermissionRecordWithExit(permissionID, currentTime) {
  try {
    const [result] = await db.query(
      "UPDATE permissionattendance_emp SET exitPermission = STR_TO_DATE(?, '%Y-%m-%d %h:%i:%s %p') WHERE permissionID = ?",
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
      "UPDATE permissionattendance_emp SET entryPermission = STR_TO_DATE(?, '%Y-%m-%d %h:%i:%s %p'), isApproved = 0 WHERE permissionID = ?",
      [currentTime, permissionID]
    );
    return { success: result.affectedRows > 0 };
  } catch (error) {
    console.error("Error al registrar entrada de regreso con permiso:", error);
    return { success: false, error: error.message };
  }
}

// Controlador para obtener registros de asistencia
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
      conditions.push("h.date = ?");
      values.push(startDate, endDate);
    }
    if (specificDate) {
      conditions.push("h.date = ?");
      values.push(specificDate);
    } else if (startDate && endDate) {
      conditions.push("h.date BETWEEN ? AND ?");
      values.push(startDate, endDate);
    }
    if (conditions.length > 0) {
      attendanceQuery += " WHERE " + conditions.join(" AND ");
    }
    attendanceQuery += " ORDER BY h.employeeID ASC, h.entryTime ASC";

    const [attendanceRows] = await db.query(attendanceQuery, values);

    const processedRows = [];

    for (const attendanceRecord of attendanceRows) {
      const processedRecord = { ...attendanceRecord };

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
        attendanceRecord.date,
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
        attendanceRecord.date,
      ]);

      permissionRows.forEach((permission, index) => {
        const permissionNumber = index + 1;
        if (permission.exitPermissionTime) {
          processedRecord[`permissionExitTime${permissionNumber}`] =
            permission.exitPermissionTime;
          processedRecord[`permissionExitID${permissionNumber}`] =
            permission.permissionID;
          processedRecord[`permissionExitComment${permissionNumber}`] =
            permission.comment || "";
        }
        if (permission.entryPermissionTime) {
          processedRecord[`permissionEntryTime${permissionNumber}`] =
            permission.entryPermissionTime;
          processedRecord[`permissionEntryID${permissionNumber}`] =
            permission.permissionID;
          processedRecord[`permissionEntryComment${permissionNumber}`] =
            permission.comment || "";
        }
      });
      processedRecord.totalPermissions = permissionRows.length;

      if (dispatchingRows.length > 0) {
        processedRecord.dispatchingTime = dispatchingRows[0].dispatchingTime;
        processedRecord.dispatchingComment =
          dispatchingRows[0].dispatchingComment;
      }

      processedRows.push(processedRecord);
    }

    res.status(200).json(processedRows);
  } catch (error) {
    console.error("Error al obtener datos de asistencia:", error);
    res.status(500).json({ message: "Error al obtener datos de asistencia" });
  }
};

// Controlador para actualizar comentarios de permisos
exports.updatePermissionComment = async (req, res) => {
  try {
    const { permissionID, comment } = req.body;

    if (!permissionID) {
      return res
        .status(400)
        .json({ message: "El ID del permiso es requerido" });
    }

    const query = `
      UPDATE permissionattendance_emp 
      SET comment = ?
      WHERE permissionID = ?
    `;

    const [result] = await db.query(query, [comment, permissionID]);

    if (result.affectedRows === 0) {
      return res.status(500).json({ message: "Permiso no encontrado" });
    }

    return res.status(200).json({
      success: true,
      message: "Comentario actualizado correctamente",
      permissionID,
      comment,
    });
  } catch (error) {
    console.error("Error al actualizar comentario de permiso:", error);
    res
      .status(500)
      .json({ message: "Error al actualizar comentario: " + error.message });
  }
};

// Controlador interno para registrar despacho
async function registerDispatchingInternal(
  req,
  res,
  employeeDetails,
  shiftDetails
) {
  const { employeeID } = req.body;
  const currentDateTimeCST = dayjs().tz("America/Tegucigalpa");
  const currentDateOnly = currentDateTimeCST.format("YYYY-MM-DD");
  const currentTimeFormatted = formatTimeWithPeriod(currentDateTimeCST);

  const { employeeName, photoUrl } = employeeDetails;
  const defaultExitTime = "04:45:00 PM"; // Hora de salida por defecto
  const scheduledExitTimeSQL = `${currentDateOnly} ${defaultExitTime}`;

  try {
    const pendingReturnStatus = await checkPendingPermissionReturn(employeeID);
    if (pendingReturnStatus.hasPendingReturn) {
      return res.status(400).json({
        message:
          "No puedes marcar despacho mientras estás fuera con permiso. Registra tu regreso primero.",
        employeeName,
        photoUrl,
      });
    }

    const [existingDispatch] = await db.query(
      "SELECT dispatchingID FROM dispatching_emp WHERE employeeID = ? AND DATE(date) = ?",
      [employeeID, currentDateOnly]
    );
    if (existingDispatch.length > 0) {
      return res.status(400).json({
        message: "Ya has registrado tu despacho por hoy.",
        employeeName,
        photoUrl,
      });
    }

    const [attendanceRecordToUpdate] = await db.query(
      "SELECT hattendanceID FROM h_attendance_emp WHERE employeeID = ? AND DATE(date) = ? AND entryTime IS NOT NULL AND exitTime IS NULL LIMIT 1",
      [employeeID, currentDateOnly]
    );
    if (attendanceRecordToUpdate.length === 0) {
      return res.status(400).json({
        message:
          "No se encontró un registro de entrada activo para marcar el despacho. Debes marcar tu entrada primero.",
        employeeName,
        photoUrl,
      });
    }
    const attendanceIDToUpdate = attendanceRecordToUpdate[0].hattendanceID;

    const insertDispatchQuery = `
      INSERT INTO dispatching_emp (employeeID, supervisorID, date, exitTimeComplete, comment)
      VALUES (?, ?, ?, STR_TO_DATE(?, '%h:%i:%s %p'), ?)
    `;

    const supervisorID = req.body.supervisorID || null; // Use supervisorID from request, default to null if not provided
    const comment = 1;
    const values = [
      employeeID,
      supervisorID,
      currentDateOnly,
      currentTimeFormatted,
      comment,
    ];
    const [resultDispatch] = await db.query(insertDispatchQuery, values);

    const scheduledExitTimeSQL = `${currentDateOnly} ${defaultExitTime}`;

    const updateAttendanceQuery = `
        UPDATE h_attendance_emp 
        SET exitTime = STR_TO_DATE(?, '%Y-%m-%d %h:%i:%s %p')
        WHERE hattendanceID = ?
    `;
    const [resultAttendanceUpdate] = await db.query(updateAttendanceQuery, [
      scheduledExitTimeSQL,
      attendanceIDToUpdate,
    ]);
    
    if (resultAttendanceUpdate.affectedRows === 0) {
      console.error(
        `Error: No se pudo actualizar exitTime para hattendanceID ${attendanceIDToUpdate} después de registrar despacho.`
      );
    }

    // Emitir registro completo y actualizado
    const fullRecord = await getSingleAttendanceRecord(
      employeeID,
      currentDateOnly
    );
    if (fullRecord) {
      io.emit("newAttendanceRecord", {
        type: "update_record",
        record: fullRecord,
      });
    }

    return res.status(201).json({
      message:
        "Despacho registrado exitosamente. Tu hora de salida ha sido establecida a las " +
        defaultExitTime,
      type: "dispatching",
      time: currentTimeFormatted,
      employeeID,
      employeeName,
      photoUrl,
    });
  } catch (error) {
    console.error("Error al registrar despacho:", error);
    return res
      .status(500)
      .json({
        message: "Error interno al registrar despacho: " + error.message,
      });
  }
}

// Controlador registerAttendance modificado para manejar correctamente las salidas de turnos nocturnos
exports.registerAttendance = async (req, res) => {
  let employeeRecords = [];
  let shiftRecords = [];
  try {
    const { employeeID, operationMode } = req.body;
    if (!employeeID) {
      return res
        .status(400)
        .json({ message: "El ID del empleado es requerido" });
    }

    const currentDateTimeCST = dayjs().tz("America/Tegucigalpa");
    const currentTimeSQL = currentDateTimeCST.format("YYYY-MM-DD hh:mm:ss A");
    const currentDateOnly = currentDateTimeCST.format("YYYY-MM-DD");
    const currentTimeFormatted = formatTimeWithPeriod(currentDateTimeCST);

    // Obtener detalles del empleado
    [employeeRecords] = await db.query(
      "SELECT firstName, middleName, lastName, photoUrl, shiftID, isActive FROM employees_emp WHERE employeeID = ?",
      [employeeID]
    );
    if (employeeRecords.length === 0) {
      return res
        .status(500)
        .json({
          message: "Empleado no encontrado. Verifica el ID.",
          statusType: "error",
        });
    }
    const employee = employeeRecords[0];

    if (employee.isActive === 0) {
      const employeeNameInactive = `${employee.firstName}${employee.middleName ? " " + employee.middleName : ""
        } ${employee.lastName}`;
      const photoUrlInactive = employee.photoUrl || "";
      return res.status(400).json({
        message: "El empleado está inactivo. No puede registrar marcaje.",
        statusType: "warning",
        employeeName: employeeNameInactive,
        photoUrl: photoUrlInactive,
      });
    }

    const employeeName = `${employee.firstName}${employee.middleName ? " " + employee.middleName : ""
      } ${employee.lastName}`;
    const photoUrl = employee.photoUrl || "";
    const shiftID = employee.shiftID;

    // Obtener detalles del turno
    [shiftRecords] = await db.query(
      "SELECT startTime, endTime FROM detailsshift_emp WHERE shiftID = ?",
      [shiftID]
    );
    if (shiftRecords.length === 0) {
      return res
        .status(400)
        .json({
          message: "No se encontró información del turno para este empleado.",
          employeeName,
          photoUrl,
        });
    }
    const shift = shiftRecords[0];
    const shiftStartTimeStr = shift.startTime;
    const shiftEndTimeStr = shift.endTime;

    // Determine if it's a night shift
    const isNightShift = dayjs(shiftEndTimeStr, "HH:mm:ss").isBefore(dayjs(shiftStartTimeStr, "HH:mm:ss"));

    // Verificar registros no cerrados de días anteriores (para turnos nocturnos)
    // Este bloque maneja la salida de un turno nocturno que comenzó en un día anterior.
    if (isNightShift) {
      const [unclosedRecords] = await db.query(
        `SELECT hattendanceID, date FROM h_attendance_emp 
         WHERE employeeID = ? AND entryTime IS NOT NULL AND exitTime IS NULL 
         AND DATE(date) < ? 
         ORDER BY date DESC LIMIT 1`,
        [employeeID, currentDateOnly]
      );

      if (unclosedRecords.length > 0) {
        // Si se encuentra un registro no cerrado de un día anterior, el marcaje actual se trata como una salida para ese registro.
        const unclosedRecord = unclosedRecords[0];
        const userID = getUserIdFromToken(req);

        const query = `UPDATE h_attendance_emp SET exitTime = STR_TO_DATE(?, '%h:%i:%s %p'), updatedBy = ? WHERE hattendanceID = ?`;
        const [result] = await db.query(query, [
          currentTimeFormatted,
          userID || "1",
          unclosedRecord.hattendanceID,
        ]);

        if (result.affectedRows === 0) {
          throw new Error(
            "No se pudo actualizar el registro de asistencia para salida de turno de noche."
          );
        }

        // Emitir el registro actualizado
        const fullRecord = await getSingleAttendanceRecord(
          employeeID,
          unclosedRecord.date
        );
        if (fullRecord) {
          io.emit("newAttendanceRecord", {
            type: "update_record",
            record: fullRecord,
          });
        }

        return res.status(201).json({
          message: "Salida de turno de noche registrada exitosamente",
          type: "exit_night_shift",
          time: currentTimeFormatted,
          employeeID,
          employeeName,
          photoUrl,
          attendanceID: unclosedRecord.hattendanceID,
          isPermissionExit: false,
          permissionExitTime: null,
        });
      }
    }

    // Verificar registros finalizados (salida o despacho) para el día actual
    // Esto evita nuevas entradas o salidas si la asistencia del día ya está cerrada.
    const [finalizedCheck] = await db.query(
      `SELECT h.exitTime, d.dispatchingID 
         FROM h_attendance_emp h 
         LEFT JOIN dispatching_emp d ON h.employeeID = d.employeeID AND DATE(h.date) = DATE(d.date)
         WHERE h.employeeID = ? AND DATE(h.date) = ? 
         ORDER BY h.entryTime DESC LIMIT 1`,
      [employeeID, currentDateOnly]
    );
    if (
      finalizedCheck.length > 0 &&
      (finalizedCheck[0].exitTime !== null ||
        finalizedCheck[0].dispatchingID !== null)
    ) {
      return res.status(400).json({
        message:
          "Ya has finalizado tu jornada laboral para hoy (Salida o Despacho registrado). No puedes realizar más marcajes.",
        employeeName,
        photoUrl,
      });
    }

    // Manejar el regreso de permiso pendiente
    // Si un empleado está fuera con permiso y necesita regresar, este bloque procesa su entrada de regreso.
    const pendingReturnStatus = await checkPendingPermissionReturn(employeeID);
    if (pendingReturnStatus.hasPendingReturn) {
      if (operationMode === "DESPACHO") {
        return res.status(400).json({
          message:
            "No puedes marcar despacho mientras estás fuera con permiso. Registra tu regreso primero.",
          employeeName,
          photoUrl,
        });
      } else if (operationMode !== "permission_entry") {
        const shiftStartTime = dayjs(
          `${currentDateOnly} ${shiftStartTimeStr}`,
          "YYYY-MM-DD HH:mm:ss"
        ).tz("America/Tegucigalpa", true);
        let shiftEndTime = dayjs(
          `${currentDateOnly} ${shiftEndTimeStr}`,
          "YYYY-MM-DD HH:mm:ss"
        ).tz("America/Tegucigalpa", true);
        if (shiftEndTime.isBefore(shiftStartTime))
          shiftEndTime = shiftEndTime.add(1, "day");

        // Se mantiene la verificación de la ventana de tiempo de entrada de permiso ya que no se solicitó su eliminación
        if (
          !currentDateTimeCST.isAfter(shiftStartTime.subtract(1, "hour")) ||
          !currentDateTimeCST.isBefore(shiftEndTime.add(1, "hour"))
        ) {
          return res.status(400).json({
            message: `No se puede registrar entrada de regreso con permiso fuera del horario extendido del turno (${shiftStartTime
              .subtract(1, "hour")
              .format("h:mm A")} - ${shiftEndTime
                .add(1, "hour")
                .format("h:mm A")}).`,
            employeeName,
            photoUrl,
          });
        }
        const updateResult = await updatePermissionRecordWithEntry(
          pendingReturnStatus.permissionData.permissionID,
          currentTimeSQL
        );
        if (!updateResult.success) {
          throw new Error(
            "No se pudo actualizar el registro de permiso para regreso: " +
            (updateResult.error || "Error desconocido")
          );
        }
        // Emitir el registro completo
        const fullRecord = await getSingleAttendanceRecord(
          employeeID,
          currentDateOnly
        );
        if (fullRecord) {
          io.emit("newAttendanceRecord", {
            type: "update_record",
            record: fullRecord,
          });
        }
        return res.status(201).json({
          message: "Entrada de regreso con permiso registrada exitosamente",
          type: "permission_entry",
          time: currentTimeFormatted,
          employeeID,
          employeeName,
          photoUrl,
          isPermissionEntry: true,
          permissionEntryTime: currentTimeFormatted,
        });
      } else {
        return res.status(400).json({
          message:
            "Debes registrar tu regreso del permiso antes de realizar cualquier otro marcaje.",
          employeeName,
          photoUrl,
        });
      }
    }

    // Manejar la operación de despacho
    // Si el modo de operación es 'DESPACHO', delegar a la función interna de despacho.
    if (operationMode === "DESPACHO") {
      const employeeDetails = { employeeName, photoUrl };
      const shiftDetails = { shiftEndTimeStr };
      return await registerDispatchingInternal(
        req,
        res,
        employeeDetails,
        shiftDetails
      );
    }

    // Definir los tiempos de turno para referencia (aunque las restricciones de entrada han sido eliminadas)
    // Estos se utilizan para calcular la hora de fin de turno esperada, especialmente para turnos nocturnos.
    const shiftStartTime = dayjs(
      `${currentDateOnly} ${shiftStartTimeStr}`,
      "YYYY-MM-DD HH:mm:ss"
    ).tz("America/Tegucigalpa", true);
    let shiftEndTime = dayjs(
      `${currentDateOnly} ${shiftEndTimeStr}`,
      "YYYY-MM-DD HH:mm:ss"
    ).tz("America/Tegucigalpa", true);
    if (shiftEndTime.isBefore(shiftStartTime)) {
      shiftEndTime = shiftEndTime.add(1, "day");
    }

    // Calcular la hora de salida real considerando excepciones y el día actual
    // Esto consulta la base de datos para cualquier excepción que pueda modificar la hora de fin de turno estándar.
    const todayDay = dayjs().locale("es").format("dddd").toUpperCase();

    const [exceptionRows] = await db.query(
      `
  SELECT 
    ex.exceptionTime, ds.endTime
  FROM employees_emp e
  LEFT JOIN exceptions_emp ex ON ex.exceptionID = e.exceptionID
  LEFT JOIN shifts_emp s ON s.shiftID = e.shiftID
  LEFT JOIN detailsshift_emp ds ON ds.shiftID = s.shiftID
  WHERE e.employeeID = ? AND ds.day = ?
  `,
      [employeeID, todayDay]
    );

    let shiftEndTimeReal = null;
    if (exceptionRows.length > 0) {
      const { exceptionTime, endTime } = exceptionRows[0];
      shiftEndTimeReal = dayjs(
        `${currentDateOnly} ${endTime}`,
        "YYYY-MM-DD HH:mm:ss"
      ).tz("America/Tegucigalpa", true);

      if (exceptionTime > 0) {
        shiftEndTimeReal = shiftEndTimeReal.subtract(exceptionTime, "minute");
      }
    } else {
      // Si no se encuentran detalles de turno o excepciones específicas para el día actual,
      // se utiliza la hora de fin de turno de detailsshift_emp, posiblemente ajustada para turno nocturno.
      shiftEndTimeReal = shiftEndTime; 
    }

    const [existingRecords] = await db.query(
      "SELECT hattendanceID, entryTime, exitTime, date FROM h_attendance_emp WHERE employeeID = ? AND DATE(date) = ? ORDER BY entryTime DESC LIMIT 1",
      [employeeID, currentDateOnly]
    );

    let registrationType = "";
    let responseMessage = "";
    let attendanceID = null;
    let isPermissionExit = false;
    let permissionExitTime = null;
    let eventType = "";

    // Obtener el ID de usuario del token para el registro de auditoría
    const userID = getUserIdFromToken(req);

    if (existingRecords.length === 0) {
      // No hay registros existentes para hoy, crear una nueva entrada
      const query = `INSERT INTO h_attendance_emp (employeeID, entryTime, date, createdBy, updatedBy) VALUES (?, STR_TO_DATE(?, '%h:%i:%s %p'), ?, ?, ?)`;
      const [result] = await db.query(query, [
        employeeID,
        currentTimeFormatted,
        currentDateOnly,
        userID || "1",
        userID || "1",
      ]);
      registrationType = "entry";
      responseMessage = "Entrada registrada exitosamente";
      attendanceID = result.insertId;
      eventType = "new_entry";
    } else {
      const latestRecord = existingRecords[0];
      eventType = "update_record";

      // Manejar salidas con permiso
      const permissionStatus = await checkActivePermission(employeeID);
      if (
        permissionStatus.hasActivePermission &&
        !permissionStatus.hasExitedWithPermission
      ) {
        const [permissionDetails] = await db.query(
          `SELECT exitTimePermission FROM permissionattendance_emp 
           WHERE employeeID = ? AND date = ? AND isApproved = 1 AND exitPermission IS NULL`,
          [employeeID, currentDateOnly]
        );
        const allowedExitTime = dayjs(
          `${currentDateOnly} ${permissionDetails[0].exitTimePermission}`,
          "YYYY-MM-DD HH:mm:ss"
        ).tz("America/Tegucigalpa", true);
        if (currentDateTimeCST.isBefore(allowedExitTime)) {
          return res.status(400).json({
            message: `No puedes registrar la salida con permiso hasta las ${allowedExitTime.format(
              "h:mm A"
            )}.`,
            employeeName,
            photoUrl,
          });
        }
        isPermissionExit = true;
        permissionExitTime = currentTimeFormatted;
        const updateResult = await updatePermissionRecordWithExit(
          permissionStatus.permissionData.permissionID,
          currentTimeSQL
        );
        if (!updateResult.success) {
          throw new Error(
            "No se pudo actualizar el registro de permiso para salida: " +
            (updateResult.error || "Error desconocido")
          );
        }
        registrationType = "permission_exit";
        responseMessage = "Salida con permiso registrada exitosamente";
        attendanceID = latestRecord.hattendanceID;
      } else {
        // Esta es la lógica principal para salidas regulares, incluyendo turnos nocturnos.
        // Si el registro actual está abierto (tiene entrada pero no salida),
        // y la hora actual es después de la hora de fin de turno real calculada,
        // o si es un turno nocturno y hay un registro abierto para hoy, permitir la salida.
        const isCurrentRecordOpen = latestRecord.entryTime !== null && latestRecord.exitTime === null;

        if (isCurrentRecordOpen && (currentDateTimeCST.isAfter(shiftEndTimeReal) || isNightShift)) {
          const query = `UPDATE h_attendance_emp SET exitTime = STR_TO_DATE(?, '%h:%i:%s %p'), updatedBy = ? WHERE hattendanceID = ?`;
          const [result] = await db.query(query, [
            currentTimeFormatted,
            userID || "1",
            latestRecord.hattendanceID,
          ]);
          if (result.affectedRows === 0) {
            throw new Error(
              "No se pudo actualizar el registro de asistencia para salida."
            );
          }
          registrationType = "exit";
          responseMessage = "Salida registrada exitosamente";
          attendanceID = latestRecord.hattendanceID;
        } else if (isCurrentRecordOpen) {
          // Si hay un registro abierto pero aún no es hora de una salida regular
          return res.status(400).json({
            message: `No se puede registrar salida antes de las ${shiftEndTimeReal.format("h:mm A")}.`,
            employeeName,
            photoUrl,
          });
        } else {
          // Si hay un registro existente pero ya está cerrado (tiene exitTime o dispatchingID)
          // o si es una nueva entrada para un día donde ya existe un registro cerrado.
          // En este caso, crear una nueva entrada para el día actual.
          const query = `INSERT INTO h_attendance_emp (employeeID, entryTime, date, createdBy, updatedBy) VALUES (?, STR_TO_DATE(?, '%h:%i:%s %p'), ?, ?, ?)`;
          const [result] = await db.query(query, [
            employeeID,
            currentTimeFormatted,
            currentDateOnly,
            userID || "1",
            userID || "1",
          ]);
          registrationType = "entry";
          responseMessage = "Entrada registrada exitosamente";
          attendanceID = result.insertId;
          eventType = "new_entry";
        }
      }
    }

    // Emitir el registro de asistencia actualizado
    // Después de cualquier operación de asistencia exitosa (entrada, salida, permiso, despacho),
    // emitir el registro actualizado a los clientes conectados a través de Socket.IO.
    const fullRecord = await getSingleAttendanceRecord(
      employeeID,
      currentDateOnly
    );
    if (fullRecord) {
      io.emit("newAttendanceRecord", {
        type: eventType,
        record: fullRecord,
      });
    }

    res.status(201).json({
      message: responseMessage,
      type: registrationType,
      time: currentTimeFormatted,
      employeeID,
      employeeName,
      photoUrl,
      attendanceID,
      isPermissionExit: isPermissionExit,
      permissionExitTime: permissionExitTime,
    });
  } catch (error) {
    console.error("Error en registerAttendance:", error);
    const employeeInfoForError =
      employeeRecords && employeeRecords.length > 0
        ? {
          employeeName: `${employeeRecords[0].firstName}${employeeRecords[0].middleName
            ? " " + employeeRecords[0].middleName
            : ""
            } ${employeeRecords[0].lastName}`,
          photoUrl: employeeRecords[0].photoUrl || "",
        }
        : {};
    res.status(500).json({
      message: "Error interno del servidor al registrar la asistencia.",
      ...employeeInfoForError,
    });
  }
};

// Controlador para actualizar la hora de asistencia con registro de auditoría
// Esta función permite actualizaciones manuales de entryTime o exitTime para un registro de asistencia,
// e incluye un registro de auditoría actualizando el campo 'updatedBy'.
exports.updateTimeAttendance = async (req, res) => {
  const { hattendanceID, field, newTime } = req.body;

  if (!hattendanceID || !field || !newTime) {
    return res
      .status(400)
      .json({ message: "Datos incompletos para la actualización." });
  }

  // Validar que el campo a actualizar sea permitido.
  const allowedFields = ["entryTime", "exitTime"];
  if (!allowedFields.includes(field)) {
    return res
      .status(400)
      .json({
        message: "El campo especificado no es válido para la actualización.",
      });
  }

  // Validar el formato de la hora (hh:mm:ss AM/PM)
  const timeRegex =
    /^([0-1]?[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])\s?(AM|PM|am|pm)$/i;
  if (!timeRegex.test(newTime)) {
    return res
      .status(400)
      .json({
        message:
          "El formato de hora debe ser hh:mm:ss AM/PM (ej. 02:02:00 PM).",
      });
  }

  try {
    // Obtener el ID de usuario del token para el registro de auditoría
    const userID = getUserIdFromToken(req);
    if (!userID) {
      return res
        .status(401)
        .json({
          message: "Token de autenticación inválido o no proporcionado.",
        });
    }

    // Obtener employeeID, fecha y el valor actual del campo antes de actualizar
    const [attendanceRecord] = await db.query(
      `SELECT employeeID, date, DATE_FORMAT(${field}, '%h:%i:%s %p') as currentTime FROM h_attendance_emp WHERE hattendanceID = ?`,
      [hattendanceID]
    );

    if (attendanceRecord.length === 0) {
      return res
        .status(404)
        .json({
          message: "No se encontró el registro de asistencia para actualizar.",
        });
    }

    const { employeeID, date, currentTime } = attendanceRecord[0];
    const oldTime = currentTime || "Sin valor";

    // Actualizar el campo de tiempo en la base de datos
    const updateQuery = `
      UPDATE h_attendance_emp
      SET ${field} = STR_TO_DATE(CONCAT(DATE(date), ' ', ?), '%Y-%m-%d %h:%i:%s %p'), updatedBy = ?
      WHERE hattendanceID = ?
    `;

    const [result] = await db.query(updateQuery, [
      newTime,
      userID,
      hattendanceID,
    ]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "No se pudo actualizar el registro de asistencia." });
    }

    // Emitir el registro actualizado con el historial de edición
    const fullRecord = await getSingleAttendanceRecord(employeeID, date);
    if (fullRecord) {
      io.emit("newAttendanceRecord", {
        type: "update_record",
        record: fullRecord,
      });
    }

    // Enviar respuesta de éxito
    return res.status(200).json({
      success: true,
      message: "Hora actualizada correctamente.",
      oldTime,
      newTime,
    });
  } catch (error) {
    console.error(`Error al actualizar el campo de tiempo: ${error}`);
    return res
      .status(500)
      .json({
        message:
          "Error interno del servidor al actualizar la hora: " + error.message,
      });
  }
};
