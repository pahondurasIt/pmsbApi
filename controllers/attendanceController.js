const db = require("../config/db"); // Importa la conexión a la base de datos
const dayjs = require("dayjs"); // Librería para manejar fechas y horas
const utc = require("dayjs/plugin/utc"); // Plugin para manejar UTC
const timezone = require("dayjs/plugin/timezone"); // Plugin para manejar zonas horarias

// Extender dayjs con los plugins de UTC y Timezone
dayjs.extend(utc);
dayjs.extend(timezone);

// Función auxiliar para formatear la hora con AM/PM
const formatTimeWithPeriod = (dayjsDate) => {
  return dayjsDate.format("h:mm A"); // Formato h:mm AM/PM
};

// --- Funciones Auxiliares (Permisos, etc. - Sin cambios relevantes aquí) ---
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

// --- Controladores (getAttendance, updatePermissionComment - Sin cambios) ---
exports.getAttendance = async (req, res) => {
  // ... (código sin cambios, se omite por brevedad) ...
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
    attendanceQuery += " ORDER BY h.employeeID, h.date DESC";

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
  // ... (código sin cambios, se omite por brevedad) ...
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

// *** Controlador interno para registrar despacho (AJUSTADO CON VALIDACIÓN DE PERMISO PENDIENTE) ***
async function registerDispatchingInternal(req, res, employeeDetails, shiftDetails) {
  const { employeeID } = req.body;
  const currentDateTimeCST = dayjs().tz("America/Tegucigalpa");
  const currentTimeSQL = currentDateTimeCST.format("YYYY-MM-DD HH:mm:ss");
  const currentDateOnly = currentDateTimeCST.format("YYYY-MM-DD");
  const currentTimeFormatted = formatTimeWithPeriod(currentDateTimeCST);

  const { employeeName, photoUrl } = employeeDetails;
  const { shiftEndTimeStr } = shiftDetails;

  try {
    // *** NUEVA VALIDACIÓN: Verificar si hay permiso pendiente de regreso ANTES de permitir despacho ***
    const pendingReturnStatus = await checkPendingPermissionReturn(employeeID);
    if (pendingReturnStatus.hasPendingReturn) {
        return res.status(400).json({
            message: "No puedes marcar despacho mientras estás fuera con permiso. Registra tu regreso primero.",
            employeeName, photoUrl
        });
    }
    // Fin nueva validación

    // Verificar si ya existe un registro de despacho para hoy (se mantiene)
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

    // Encontrar el registro de asistencia de hoy para actualizar la salida (se mantiene)
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

    // Insertar registro de despacho (se mantiene)
    const insertDispatchQuery = `
      INSERT INTO dispatching_emp (employeeID, date, exitTimeComplete, comment)
      VALUES (?, ?, ?, ?)
    `;
    const comment = 1; // Asumiendo 1 significa 'Cumplimiento de Meta'
   
    const values = [employeeID, currentDateOnly, currentTimeSQL, comment];
    const [resultDispatch] = await db.query(insertDispatchQuery, values);

    // Calcular y establecer la hora de salida programada en h_attendance_emp (se mantiene)
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

    return res.status(201).json({
      message: "Despacho registrado exitosamente. Tu hora de salida ha sido establecida a las " + formatTimeWithPeriod(dayjs(scheduledExitTimeSQL)),
      type: 'dispatching',
      time: currentTimeFormatted,
      scheduledExitTime: formatTimeWithPeriod(dayjs(scheduledExitTimeSQL)),
      employeeID, employeeName, photoUrl
    });

  } catch (error) {
    console.error("Error al registrar despacho:", error);
    return res.status(500).json({ message: "Error interno al registrar despacho: " + error.message });
  }
}

// Controlador para registrar asistencia (AJUSTADO CON VALIDACIÓN DE PERMISO PENDIENTE ANTES DE DESPACHO)
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

    // Obtener detalles del empleado y turno
    [employeeRecords] = await db.query(
      "SELECT firstName, middleName, lastName, photoUrl, shiftID FROM employees_emp WHERE employeeID = ?",
      [employeeID]
    );
    if (employeeRecords.length === 0) {
      return res.status(404).json({ message: "Empleado no encontrado. Verifica el ID." });
    }
    const employee = employeeRecords[0];
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

    // Chequeo inicial de estado finalizado (Salida o Despacho)
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

    // Verificar permiso pendiente de regreso (PRIORIDAD ALTA)
    // Si hay permiso pendiente, la única acción permitida es registrar el regreso (o manejar error si intenta otra cosa)
    const pendingReturnStatus = await checkPendingPermissionReturn(employeeID);
    if (pendingReturnStatus.hasPendingReturn) {
        // Si intenta marcar DESPACHO mientras está fuera con permiso, la validación DENTRO de registerDispatchingInternal lo bloqueará.
        // Si intenta marcar ENTRADA o SALIDA NORMAL mientras está fuera, también debe bloquearse.
        if (operationMode === 'DESPACHO') {
             // La validación se hará dentro de registerDispatchingInternal, pero podemos ponerla aquí también por claridad
             return res.status(400).json({
                message: "No puedes marcar despacho mientras estás fuera con permiso. Registra tu regreso primero.",
                employeeName, photoUrl
             });
        } else if (operationMode !== 'permission_entry') { // Asumiendo que el regreso se marca con un modo específico o sin modo
            // Lógica para manejar regreso de permiso (si la hora es válida)
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
            return res.status(201).json({
                message: "Entrada de regreso con permiso registrada exitosamente", type: 'permission_entry',
                time: currentTimeFormatted, employeeID, employeeName, photoUrl,
                isPermissionEntry: true, permissionEntryTime: currentTimeFormatted
            });
        } else {
             // Si intenta cualquier otra operación que no sea el regreso
             return res.status(400).json({
                message: "Debes registrar tu regreso del permiso antes de realizar cualquier otro marcaje.",
                employeeName, photoUrl
             });
        }
    }
    // Si llegamos aquí, NO hay permiso pendiente de regreso.

    // Manejo de DESPACHO (ahora sabemos que no hay permiso pendiente)
    if (operationMode === 'DESPACHO') {
      const employeeDetails = { employeeName, photoUrl };
      const shiftDetails = { shiftEndTimeStr };
      // La validación de permiso pendiente ya se hizo arriba, y se hará de nuevo dentro por seguridad.
      return await registerDispatchingInternal(req, res, employeeDetails, shiftDetails);
    }

    // --- Lógica restante para Entrada, Salida Normal, Permisos (sin permiso pendiente) --- 
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

    // Verificar registros existentes hoy (sabemos que no está finalizado y no hay permiso pendiente)
    const [existingRecords] = await db.query(
      "SELECT hattendanceID, entryTime, exitTime FROM h_attendance_emp WHERE employeeID = ? AND DATE(date) = ? ORDER BY entryTime DESC LIMIT 1",
      [employeeID, currentDateOnly]
    );

    let registrationType = '';
    let responseMessage = '';
    let attendanceID = null;
    let isPermissionExit = false;
    let permissionExitTime = null;

    if (existingRecords.length === 0) {
      // --- CASO 1: PRIMERA ENTRADA DEL DÍA ---
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

    } else {
      // --- CASO 2: YA EXISTE REGISTRO HOY (sin exitTime, sin despacho, sin permiso pendiente) ---
      const latestRecord = existingRecords[0]; 

      // --- CASO 2.1: YA MARCÓ ENTRADA, AÚN NO HA SALIDO ---
      if (!isAfterShiftEnd) { // Si aún no es la hora de fin de turno
          const permissionStatus = await checkActivePermission(employeeID);
          if (permissionStatus.hasActivePermission && !permissionStatus.hasExitedWithPermission) {
              // --- CASO 2.1.1: SALIDA CON PERMISO (ANTES DE FIN DE TURNO) ---
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
              // --- CASO 2.1.2: INTENTO DE MARCAR DE NUEVO (SIN PERMISO Y ANTES DE FIN DE TURNO) ---
              return res.status(400).json({
                  message: `Ya has registrado tu entrada hoy. Solo puedes registrar tu salida normal después de las ${shiftEndTime.format("h:mm A")} o una salida con permiso si está aprobada.`,
                  employeeName, photoUrl
              });
          }
      } else {
           // --- CASO 2.1.3: YA ES HORA DE SALIDA NORMAL (o posterior) ---
           if (canMarkExit) { // Verificar si está dentro de la ventana de gracia de salida
              const query = `UPDATE h_attendance_emp SET exitTime = ?, updatedBy = ? WHERE hattendanceID = ?`;
              const [result] = await db.query(query, [currentTimeSQL, "1", latestRecord.hattendanceID]);
              if (result.affectedRows === 0) {
                  throw new Error("No se pudo actualizar el registro de asistencia para salida.");
              }
              registrationType = 'exit';
              responseMessage = "Salida registrada exitosamente";
              attendanceID = latestRecord.hattendanceID;
           } else {
               // --- CASO 2.1.4: INTENTO DE SALIDA FUERA DE VENTANA DE GRACIA ---
               return res.status(400).json({
                  message: `No se puede registrar salida fuera del horario permitido (${exitWindowStart.format("h:mm A")} - ${exitWindowEnd.format("h:mm A")}).`,
                  employeeName, photoUrl
               });
           }
      }
    }

    // Respuesta exitosa (Entrada, Salida Normal, Salida con Permiso)
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

