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

// Función para verificar si un empleado tiene un permiso activo
async function checkActivePermission(employeeID) {
  try {
    // Consultar permisos activos para el empleado en la fecha actual
    const currentDateOnly = dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD");
    
    const [permissionResults] = await db.query(
      `SELECT 
        permissionID, 
        permissionTypeID, 
        exitTimePermission, 
        entryTimePermission,
        exitPermission,
        entryPermission
      FROM 
        permissionattendance_emp 
      WHERE 
        employeeID = ? 
        AND date = ? 
        AND isApproved = 1
        AND exitPermission IS NULL`,
      [employeeID, currentDateOnly]
    );

    // Si no hay resultados, no hay permiso activo
    if (permissionResults.length === 0) {
      return { hasActivePermission: false };
    }

    // Devolver información del permiso activo
    return {
      hasActivePermission: true,
      permissionData: permissionResults[0],
      // Determinar si ya se registró la salida o entrada con permiso
      hasExitedWithPermission: permissionResults[0].exitPermission !== null
    };
  } catch (error) {
    console.error("Error al verificar permiso activo:", error);
    return { hasActivePermission: false, error: error.message };
  }
}

// Función para verificar si un empleado tiene un permiso con salida registrada pero sin entrada de regreso
async function checkPendingPermissionReturn(employeeID) {
  try {
    // Consultar permisos con salida registrada pero sin entrada de regreso para el empleado en la fecha actual
    const currentDateOnly = dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD");
    
    const [permissionResults] = await db.query(
      `SELECT 
        permissionID, 
        permissionTypeID, 
        exitTimePermission, 
        entryTimePermission,
        exitPermission,
        entryPermission,
        TIMESTAMPDIFF(MINUTE, exitPermission, NOW()) as minutesSinceExit
      FROM 
        permissionattendance_emp 
      WHERE 
        employeeID = ? 
        AND date = ? 
        AND exitPermission IS NOT NULL
        AND entryPermission IS NULL`,
      [employeeID, currentDateOnly]
    );

    // Si no hay resultados, no hay permiso pendiente de regreso
    if (permissionResults.length === 0) {
      return { hasPendingReturn: false };
    }

    // Verificar si ha pasado al menos 1 minuto desde la salida con permiso
    const minutesSinceExit = permissionResults[0].minutesSinceExit;
    const canRegisterReturn = minutesSinceExit >= 1;

    // Devolver información del permiso pendiente de regreso
    return {
      hasPendingReturn: true,
      permissionData: permissionResults[0],
      canRegisterReturn: canRegisterReturn,
      minutesSinceExit: minutesSinceExit
    };
  } catch (error) {
    console.error("Error al verificar permiso pendiente de regreso:", error);
    return { hasPendingReturn: false, error: error.message };
  }
}

// Función para registrar salida con permiso
async function updatePermissionRecordWithExit(permissionID, currentTime) {
  try {
    // Actualizar el registro de permiso con la hora de salida
    // Nota: Ya no cambiamos isApproved a 0 hasta que se registre la entrada de regreso
    const query = `
      UPDATE permissionattendance_emp 
      SET exitPermission = ?
      WHERE permissionID = ?
    `;
    
    const [result] = await db.query(query, [currentTime, permissionID]);
    
    return {
      success: result.affectedRows > 0,
      message: result.affectedRows > 0 
        ? "Salida con permiso registrada correctamente" 
        : "No se pudo actualizar el registro de permiso"
    };
  } catch (error) {
    console.error("Error al registrar salida con permiso:", error);
    return { success: false, error: error.message };
  }
}

// Función para registrar entrada de regreso de permiso y cambiar estado a INACTIVO
async function updatePermissionRecordWithEntry(permissionID, currentTime) {
  try {
    // Actualizar el registro de permiso con la hora de entrada de regreso y cambiar a INACTIVO
    const query = `
      UPDATE permissionattendance_emp 
      SET entryPermission = ?, isApproved = 0
      WHERE permissionID = ?
    `;
    
    const [result] = await db.query(query, [currentTime, permissionID]);
    
    return {
      success: result.affectedRows > 0,
      message: result.affectedRows > 0 
        ? "Entrada de regreso con permiso registrada y permiso inactivado correctamente" 
        : "No se pudo actualizar el registro de permiso"
    };
  } catch (error) {
    console.error("Error al registrar entrada de regreso con permiso:", error);
    return { success: false, error: error.message };
  }
}

// Controlador para obtener registros de asistencia (MODIFICADO para incluir múltiples permisos por empleado)
exports.getAttendance = async (req, res) => {
  try {
    const { startDate, endDate, specificDate } = req.query;
    
    // Primero, obtenemos los registros de asistencia básicos
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
    
    // Ahora, para cada registro de asistencia, obtenemos todos los permisos del día (hasta 5)
    const processedRows = [];
    
    for (const attendanceRecord of attendanceRows) {
      // Consulta para obtener todos los permisos del empleado en la fecha específica
      const permissionQuery = `
        SELECT 
          permissionID,
          DATE_FORMAT(exitPermission, '%h:%i:%s %p') AS exitPermissionTime,
          DATE_FORMAT(entryPermission, '%h:%i:%s %p') AS entryPermissionTime
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
      
      // Crear un objeto base con los datos de asistencia
      const processedRecord = { ...attendanceRecord };
      
      // Agregar los permisos como propiedades numeradas (SP1, RP1, SP2, RP2, etc.)
      permissionRows.forEach((permission, index) => {
        // El índice comienza en 0, pero queremos numerar desde 1
        const permissionNumber = index + 1;
        
        // Solo agregar si hay valores no nulos
        if (permission.exitPermissionTime) {
          processedRecord[`permissionExitTime${permissionNumber}`] = permission.exitPermissionTime;
        }
        
        if (permission.entryPermissionTime) {
          processedRecord[`permissionEntryTime${permissionNumber}`] = permission.entryPermissionTime;
        }
      });
      
      // Agregar el número total de permisos para este registro
      processedRecord.totalPermissions = permissionRows.length;
      
      processedRows.push(processedRecord);
    }
    
    res.status(200).json(processedRows);
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({ message: "Error al obtener datos de asistencia" });
  }
};

// Controlador para registrar asistencia (modificado para manejar permisos)
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

    // Definir ventanas de tiempo para entrada y salida
    const entryStartTime = dayjs().tz("America/Tegucigalpa").set("hour", 6).set("minute", 0).set("second", 0);
    const entryEndTime = dayjs().tz("America/Tegucigalpa").set("hour", 16).set("minute", 45).set("second", 0);
    const exitStartTime = dayjs().tz("America/Tegucigalpa").set("hour", 15).set("minute", 0).set("second", 0);
    const exitEndTime = dayjs().tz("America/Tegucigalpa").set("hour", 16).set("minute", 45).set("second", 0);

    const isWithinEntryWindow = currentDateTimeCST.isAfter(entryStartTime) && currentDateTimeCST.isBefore(entryEndTime);
    const isWithinExitWindow = currentDateTimeCST.isAfter(exitStartTime) && currentDateTimeCST.isBefore(exitEndTime);

    // Verificar si el empleado tiene un permiso pendiente de regreso
    const pendingReturnStatus = await checkPendingPermissionReturn(employeeID);
    
    // Si hay un permiso pendiente de regreso, manejar la entrada de regreso
    if (pendingReturnStatus.hasPendingReturn) {
      // Verificar si ha pasado al menos 1 minuto desde la salida con permiso
      if (!pendingReturnStatus.canRegisterReturn) {
        return res.status(400).json({
          message: `Debe esperar al menos 1 minuto después de la salida con permiso. Han pasado ${pendingReturnStatus.minutesSinceExit} minutos.`,
          waitTimeRemaining: 60 - (pendingReturnStatus.minutesSinceExit * 60), // Tiempo restante en segundos
          isWaitingForPermissionReturn: true
        });
      }
      
      // Registrar entrada de regreso con permiso
      const updateResult = await updatePermissionRecordWithEntry(
        pendingReturnStatus.permissionData.permissionID,
        currentTimeSQL
      );

      if (!updateResult.success) {
        throw new Error("No se pudo actualizar el registro de permiso: " + updateResult.error);
      }

      // Devolver respuesta exitosa para entrada de regreso con permiso
      return res.status(201).json({
        message: "Entrada de regreso con permiso registrada exitosamente",
        type: 'permission_entry',
        time: currentTimeFormatted,
        employeeID,
        isPermissionEntry: true,
        permissionEntryTime: currentTimeFormatted
      });
    }

    // Verificar si el empleado tiene un permiso activo para salida
    const permissionStatus = await checkActivePermission(employeeID);

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

    // Buscar registro de asistencia para hoy
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
      // No hay registro hoy - ENTRADA INICIAL
      if (!isWithinEntryWindow && !permissionStatus.hasActivePermission) {
        // No está en ventana de entrada y no tiene permiso
        return res.status(400).json({
          message: "No se puede registrar entrada fuera del horario permitido (6:00 AM - 4:45 PM).",
          employeeName,
          photoUrl
        });
      } 
      else {
        // Entrada normal dentro de la ventana permitida
        const query = `
          INSERT INTO h_attendance_emp (employeeID, entryTime, date, createdBy, updatedBy)
          VALUES (?, ?, ?, ?, ?)
        `;
        const createdBy = "1"; // Placeholder
        const updatedBy = "1"; // Placeholder
        const values = [employeeID, currentTimeSQL, currentDateOnly, createdBy, updatedBy];
        const [result] = await db.query(query, values);

        registrationType = 'entry';
        responseMessage = "Entrada registrada exitosamente";
        attendanceID = result.insertId;
      }
    } else {
      const latestRecord = existingRecords[0];
      if (latestRecord.entryTime && !latestRecord.exitTime) {
        // Hay entrada pero no salida - VERIFICAR SI ES SALIDA NORMAL O CON PERMISO
        
        // Verificar si es una salida con permiso fuera del horario permitido
        if (!isWithinExitWindow && permissionStatus.hasActivePermission && !permissionStatus.hasExitedWithPermission) {
          // Es una salida con permiso fuera del horario permitido
          // NO registramos en h_attendance_emp, solo en permissionattendance_emp
          isPermissionExit = true;
          permissionExitTime = currentTimeFormatted;
          
          // Actualizar el registro de permiso con la hora de salida
          // MODIFICADO: Ya no cambiamos isApproved a 0 hasta que se registre la entrada de regreso
          const updateResult = await updatePermissionRecordWithExit(
            permissionStatus.permissionData.permissionID,
            currentTimeSQL
          );

          if (!updateResult.success) {
            throw new Error("No se pudo actualizar el registro de permiso: " + updateResult.error);
          }

          registrationType = 'permission_exit';
          responseMessage = "Salida con permiso registrada exitosamente";
          attendanceID = latestRecord.hattendanceID;
        } 
        else if (!isWithinExitWindow && !permissionStatus.hasActivePermission) {
          // No está en ventana de salida y no tiene permiso
          return res.status(400).json({
            message: "No se puede registrar salida fuera del horario permitido (3:00 PM - 4:45 PM).",
            employeeName,
            photoUrl
          });
        } 
        else {
          // Salida normal dentro de la ventana permitida
          const query = `
            UPDATE h_attendance_emp 
            SET exitTime = ?, updatedBy = ?
            WHERE hattendanceID = ?
          `;
          const updatedBy = "1"; // Placeholder
          const values = [currentTimeSQL, updatedBy, latestRecord.hattendanceID];
          const [result] = await db.query(query, values);

          if (result.affectedRows === 0) {
            throw new Error("No se pudo actualizar el registro para la salida.");
          }

          registrationType = 'exit';
          responseMessage = "Salida registrada exitosamente";
          attendanceID = latestRecord.hattendanceID;
        }
      } else {
        // Ya hay entrada y salida registradas hoy
        return res.status(400).json({
          message: "Ya se registró tanto la entrada como la salida para hoy. No se puede registrar otra entrada.",
          employeeName,
          photoUrl
        });
      }
    }

    // Devolver respuesta exitosa con información adicional sobre permisos
    res.status(201).json({
      message: responseMessage,
      type: registrationType,
      time: currentTimeFormatted,
      hattendanceID: attendanceID,
      employeeName,
      photoUrl,
      // Incluir información sobre permisos para que el frontend pueda mostrar mensajes adecuados
      isPermissionExit: isPermissionExit,
      permissionExitTime: permissionExitTime
    });

  } catch (error) {
    console.error("Error registering attendance:", error);
    res.status(500).json({ message: "Error al procesar el registro. Intenta de nuevo." });
  }
};
