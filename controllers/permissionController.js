const db = require("../config/db");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const {
  camposAuditoriaUPDATE,
  camposAuditoriaADD,
} = require("../helpers/columnasAuditoria");
const { isValidString } = require("../helpers/validator");
const { printPermissionTicket } = require("./thermalPrinterController");
const getUserIdFromToken = require("../helpers/getUserIdFromToken");
require("dayjs/locale/es");
const ExcelJS = require("exceljs");

dayjs.extend(utc);
dayjs.extend(timezone);

// Función para obtener tipos de permisos y lista de empleados que marcaron hoy
exports.getPermissionData = async (req, res) => {
  try {
    const [permissionResults] = await db.query(
      "SELECT permissionTypeID, permissionTypeName FROM permissiontype_emp"
    );
    //const currentDate = dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD");
    // const [employeeResults] = await db.query(
    //   `SELECT DISTINCT
    //     e.employeeID,
    //     CONCAT(e.employeeID, ' - ', e.firstName, ' ', COALESCE(e.middleName, ''), ' ', e.lastName) AS fullName
    //   FROM
    //       employees_emp e
    //       INNER JOIN h_attendance_emp a ON e.employeeID = a.employeeID
    //   WHERE
    //       a.date = ?
    //       AND NOT EXISTS (
    //           SELECT 1
    //           FROM dispatching_emp d
    //     WHERE d.employeeID = e.employeeID
    //       AND d.date = ?
    // );`,
    //   [currentDate, currentDate]
    // );

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
      shift: shiftDetail.length > 0 ? shiftDetail[0] : null,
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
    const [permissionResults] = await db.query(`
      SELECT
        pa.*,
        CONCAT(e.codeEmployee, ' - ', e.firstName, ' ', COALESCE(e.middleName, ''), ' ', e.lastName,  ' ', e.secondLastName) as fullName,
        p.permissionTypeName,
        j.jobName,
        ua.username AS approvedByUsername,
        CONCAT(e_aprobador.firstName, ' ', e_aprobador.lastName) AS approvedByFullName,
        CONCAT(e_creador.firstName, ' ', e_creador.lastName) AS createdBy, 
        att.entryTime AS attendanceEntry
      FROM
        permissionattendance_emp pa
        INNER JOIN permissiontype_emp p ON p.permissionTypeID = pa.permissionTypeID
        INNER JOIN employees_emp e ON e.employeeID = pa.employeeID
        INNER JOIN jobs_emp j ON e.jobID = j.jobID 
        LEFT JOIN users_us ua ON ua.userID = pa.approvedBy
        LEFT JOIN employees_emp e_aprobador ON e_aprobador.employeeID = ua.employeeID
        LEFT JOIN users_us uc ON uc.userID = pa.createdBy 
        LEFT JOIN employees_emp e_creador ON e_creador.employeeID = uc.employeeID 
        LEFT JOIN (
          SELECT employeeID, date, MIN(entryTime) AS entryTime
          FROM h_attendance_emp
          GROUP BY employeeID, date
        ) att ON pa.date = att.date AND pa.employeeID = att.employeeID
      WHERE pa.date BETWEEN '${dayjs()
        .subtract(30, "day")
        .format("YYYY-MM-DD")}' AND '${dayjs()
      .add(1, "month")
      .format("YYYY-MM-DD")}'
      ORDER BY pa.permissionID DESC;
    `);
    res.json(permissionResults);
  } catch (err) {
    console.error("Error fetching all permissions:", err);
    res.status(500).json({
      message: "Error al cargar todos los permisos",
      error: err.message,
    });
  }
};

//Funcion para exportar permisos
exports.exportPermissionsToExcel = async (req, res) => {
  try {
    const currentDate = dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD");

    const query = `
  SELECT
    pa.permissionID,
    CONCAT(e.codeEmployee, ' - ', e.firstName, ' ', COALESCE(e.middleName, ''), ' ', e.lastName, ' ', e.secondLastName) AS employeeName,
    att.entryTime AS attendanceEntry,
    pa.exitPermission, 
    pa.entryPermission,
    p.permissionTypeName,
    pa.status,
    pa.isApproved,
    pa.request,
    CONCAT(e_creador.firstName, ' ', COALESCE(e_creador.middleName, ''), ' ', e_creador.lastName) AS createdBy,
    CONCAT(e_aprobador.firstName, ' ', COALESCE(e_aprobador.middleName, ''), ' ', e_aprobador.lastName) AS approvedBy,
    j.jobName,
    ROUND(TIMESTAMPDIFF(MINUTE, pa.exitPermission, pa.entryPermission) / 60, 2) AS hoursDifference,
    pa.date AS attendance
  FROM
    permissionattendance_emp pa
    INNER JOIN permissiontype_emp p ON p.permissionTypeID = pa.permissionTypeID
    INNER JOIN employees_emp e ON e.employeeID = pa.employeeID
    INNER JOIN jobs_emp j ON e.jobID = j.jobID
    LEFT JOIN users_us ua ON ua.userID = pa.approvedBy
    LEFT JOIN employees_emp e_aprobador ON e_aprobador.employeeID = ua.employeeID
    LEFT JOIN users_us uc ON uc.userID = pa.createdBy
    LEFT JOIN employees_emp e_creador ON e_creador.employeeID = uc.employeeID
    LEFT JOIN (
      SELECT employeeID, date, MIN(entryTime) AS entryTime
      FROM h_attendance_emp
      GROUP BY employeeID, date
    ) att ON pa.date = att.date AND pa.employeeID = att.employeeID
  WHERE pa.date BETWEEN '${dayjs().subtract(30, "day").format("YYYY-MM-DD")}'
                    AND '${dayjs().add(1, "day").format("YYYY-MM-DD")}'
  ORDER BY pa.permissionID DESC
`;

    const [results] = await db.query(query);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Permisos");

    worksheet.columns = [
      { header: "Ítem", key: "item", width: 8 }, // correlativo
      { header: "Empleado", key: "employeeName", width: 30 },
      { header: "Entrada Asistencia", key: "attendanceEntry", width: 18 },
      { header: "Salida Permiso", key: "exitPermission", width: 15 },
      { header: "Entrada Permiso", key: "entryPermission", width: 15 },
      { header: "Tipo de Permiso", key: "permissionTypeName", width: 20 },
      { header: "Estado", key: "status", width: 10 },
      { header: "Aprobado", key: "isApproved", width: 12 },
      { header: "Solicitud", key: "request", width: 12 },
      { header: "Creado Por", key: "createdBy", width: 25 },
      { header: "Aprobado Por", key: "approvedBy", width: 25 },
      { header: "Puesto", key: "jobName", width: 20 },
      { header: "Horas Diferencia", key: "hoursDifference", width: 15 },
      { header: "Fecha Asistencia", key: "attendance", width: 15 },
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "366092" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    results.forEach((row, index) => {
      const excelRow = worksheet.addRow({
        item: index + 1, // Aquí creamos el correlativo
        employeeName: row.employeeName,
        attendanceEntry: row.attendanceEntry
          ? formatTime(row.attendanceEntry)
          : "-",
        exitPermission: row.exitPermission
          ? formatTime(row.exitPermission)
          : "-",
        entryPermission: row.entryPermission
          ? formatTime(row.entryPermission)
          : "-",
        permissionTypeName: row.permissionTypeName,
        status: row.status === 1 ? "Activo" : "Inactivo",
        isApproved: row.isApproved ? "Sí" : "No",
        request: row.request ? "Solicitado" : "Diferido",
        createdBy: row.createdBy,
        approvedBy: row.approvedBy,
        jobName: row.jobName,
        hoursDifference:
          row.hoursDifference !== null ? row.hoursDifference : "-",
        attendance: row.attendance ? formatDate(row.attendance) : "-",
      });

      excelRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle" };
      });

      if (index % 2 === 0) {
        excelRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F8F9FA" },
          };
        });
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=permisos_${currentDate}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error al exportar permisos:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor al exportar permisos",
      error: error.message,
    });
  }
};

exports.getEditPermission = async (req, res) => {
  try {
    const { permissionID, field, newTime } = req.body;

    console.log(req.body);

    // Validaciones
    if (!permissionID || !field || !newTime) {
      return res.status(400).json({
        success: false,
        message:
          "Datos incompletos: permissionID, field y newTime son requeridos.",
      });
    }

    // Solo permitir actualizar estas dos columnas
    const allowedFields = ["exitPermission", "entryPermission"];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: "Campo no permitido.",
      });
    }

    // Ejecutar actualización
    const [result] = await db.query(
      `UPDATE permissionattendance_emp 
       SET ${field} = ? 
       WHERE permissionID = ?`,
      [newTime, permissionID]
    );

    if (result.affectedRows > 0) {
      return res.json({
        success: true,
        message: `${field} actualizado correctamente.`,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "No se encontró el permiso con ese ID.",
      });
    }
  } catch (error) {
    console.error("Error al actualizar permiso:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar el permiso.",
      error: error.message,
    });
  }
};

// Función auxiliar para formatear tiempo con AM/PM
function formatTime(timeString) {
  if (!timeString || timeString === "Invalid Date") return "-";

  try {
    const date = new Date(`1970-01-01T${timeString}`);
    return date
      .toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
      .toUpperCase(); // Convertimos todo a mayúscula
  } catch (error) {
    return "-";
  }
}

// Función auxiliar para formatear fecha
function formatDate(dateString) {
  if (!dateString) return "-";

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (error) {
    return dateString;
  }
}

// Función para obtener permisos sin aprobación
exports.getPermissionsWithoutApproval = async (req, res) => {
  try {
    const [permissionResults] = await db.query(`
     SELECT 
        CONCAT(e.codeEmployee, ' ~ ', e.firstName, ' ', COALESCE(e.middleName, ''),
        ' ', e.lastName,  ' ', e.secondLastName) as fullName, comment, pa.request, e.photoUrl,
        e.employeeID, j.jobName, pa.permissionID, p.permissionTypeID, p.permissionTypeName, p.time,
        pa.date, pa.exitTimePermission, pa.entryTimePermission,
        pa.exitPermission, pa.entryPermission, pa.isApproved, pa.isPaid, pa.status
      FROM
      permissionattendance_emp pa
              INNER JOIN permissiontype_emp p on p.permissionTypeID = pa.permissionTypeID
              INNER JOIN employees_emp e on e.employeeID = pa.employeeID
              INNER JOIN jobs_emp j on e.jobID = j.jobID
      where pa.date between '${dayjs()
        .subtract(1, "month")
        .format("YYYY-MM-DD")}' and 
      '${dayjs().add(1, "month").format("YYYY-MM-DD")}'
      and !isApproved
      ORDER BY pa.permissionID desc;
    `);
    res.json(permissionResults);
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

// Controlador para crear y registrar un permiso
exports.createPermission = async (req, res) => {
  try {
    const {
      employeeID,
      permissionTypeID,
      date,
      comment,
      request,
      exitTimePermission,
      exitPermission,
      entryPermission,
      isPaid,
      isApproved,
      status,
    } = req.body;

    // Validación actualizada para incluir los nuevos campos obligatorios
    if (!employeeID || !permissionTypeID) {
      return res.status(400).json({
        success: false,
        message:
          "Datos incompletos. Se requiere ID de empleado y tipo de permiso.",
      });
    }

    console.log(dayjs(date).format("YYYY-MM-DD"));

    if (request) {
      // Revisar si tiene permiso activo y autorizado
      const [permisoActivoAuth] = await db.query(
        `
        SELECT * FROM permissionattendance_emp pa
        where pa.date = '${dayjs(date).format(
          "YYYY-MM-DD"
        )}' and status and isApproved and pa.employeeID = ?;
        `,
        [employeeID]
      );

      if (permisoActivoAuth.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Ya existe un permiso autorizado para este empleado.",
        });
      }

      // Revisar si tiene permiso activo en uso
      const [permissionInUsed] = await db.query(
        `
        SELECT * FROM permissionattendance_emp pa
        where pa.date = '${dayjs(date).format(
          "YYYY-MM-DD"
        )}' and pa.employeeID = ?
        and isnull(entryPermission) and !status and request;
        `,
        [employeeID]
      );

      if (permissionInUsed.length > 0) {
        return res.status(400).json({
          success: false,
          message: "El empleado tiene un permiso en uso.",
        });
      }
    }

    const [attendanceResults] = await db.query(
      `
        select * from h_attendance_emp 
        where date = DATE(now()) and employeeID = ? and entryTime;
        `,
      [employeeID]
    );

    if (attendanceResults.length === 0 && request) {
      return res.status(400).json({
        success: false,
        message:
          "El empleado no ha registrado su asistencia hoy. No se puede crear el permiso.",
      });
    }

    const query = `
      INSERT INTO permissionattendance_emp (
        employeeID, permissionTypeID, date, exitTimePermission,
        exitPermission, entryPermission, comment, request, isPaid, isApproved, approvedBy,
        status, createdDate, createdBy
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      employeeID,
      permissionTypeID,
      dayjs(date).tz("America/Tegucigalpa").format("YYYY-MM-DD"),
      isValidString(exitTimePermission)
        ? dayjs(exitTimePermission).tz("America/Tegucigalpa").format("HH:mm")
        : null,
      isValidString(exitPermission)
        ? dayjs(exitPermission).tz("America/Tegucigalpa").format("HH:mm")
        : null,
      isValidString(entryPermission)
        ? dayjs(entryPermission).tz("America/Tegucigalpa").format("HH:mm")
        : null,
      isValidString(comment) ? comment : null,
      request,
      isPaid,
      isApproved,
      null,
      status,
      camposAuditoriaADD(req),
    ];

    const [result] = await db.query(query, values);

    if (result.affectedRows === 1) {
      const insertedId = result.insertId;
      res.status(201).json({
        success: true,
        message: "Permiso registrado correctamente.",
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

// Controlador para aprobar un permiso
exports.approvedPermission = async (req, res) => {
  try {
    const { permissionID } = req.params;

    const { isApproved } = req.body;
    const userID = getUserIdFromToken(req);

    const [results] = await db.query(
      `
      UPDATE permissionattendance_emp
      SET isApproved = ?, approvedBy = ?, updatedDate = ?, updatedBy = ?
      WHERE permissionID = ?
    `,
      [isApproved, userID, ...camposAuditoriaUPDATE(req), permissionID]
    );
    if (results.affectedRows === 0) {
      return res.status(500).json({
        message: "Permiso no encontrado o ya está aprobado.",
      });
    }
    let errorPrint = "";
    // Si el permiso fue aprobado, imprimir el ticket automáticamente
    if (isApproved) {
      await printPermissionTicket(permissionID, "solicitud").catch(
        (printErr) => {
          console.error("Error al imprimir ticket automáticamente:", printErr);
          errorPrint = "No hay impresoras locales conectadas.";
        }
      );
    }

    console.log(errorPrint);

    res.json({
      message: "Permiso aprobado correctamente",
      results,
      errorPrint,
    });
  } catch (err) {
    console.error("Error approving permission:", err);
    res.status(500).json({
      message: "Error al aprobar el permiso",
      error: err.message,
    });
  }
};
// Controlador para eliminar un permiso
exports.deletePermission = async (req, res) => {
  try {
    const { permissionID } = req.params;
    const [results] = await db.query(
      `
      DELETE FROM permissionattendance_emp
      WHERE permissionID = ?
    `,
      [permissionID]
    );
    if (results.affectedRows === 0) {
      return res.status(404).json({
        message: "Permiso no encontrado.",
      });
    }
    res.json({ message: "Permiso eliminado correctamente.", results });
  } catch (err) {
    console.error("Error deleting permission:", err);
    res.status(500).json({
      message: "Error al eliminar el permiso",
      error: err.message,
    });
  }
};
