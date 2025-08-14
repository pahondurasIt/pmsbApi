const { io } = require("../app");
const db = require("../config/db"); // Importa la conexión a la base de datos

const express = require("express");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault("America/Guatemala");

let printerClients = [];

// Función para imprimir permisos
exports.printTicketPermission = async (req, res) => {
  try {
    const [dataPermission] = await db.query(
      `
      		SELECT 
				p.permissionID, p.exitTimePermission, p.entryTimePermission, p.exitPermission, p.entryPermission,
                pt.permissionTypeID, pt.permissionTypeName, u.username,  
                concat(eu.firstName,' ', eu.middleName,' ',eu.lastName) createdBy,  
                concat(empAp.firstName,' ', empAp.middleName,' ',empAp.lastName) approvedBy,
                j.jobName, concat(e.firstName, ' ', e.middleName, ' ', e.lastName) employeeName,
                e.codeEmployee, ROUND(TIMESTAMPDIFF(Minute, p.exitTimePermission, p.entryTimePermission) /60, 2) AS hoursDifference            
			from 
                permissionattendance_emp p
            inner join permissiontype_emp pt on p.permissionTypeID = pt.permissionTypeID
            inner join users_us u on p.createdBy = u.userID
            inner join employees_emp eu on u.employeeID = eu.employeeID
            inner join users_us usAppr on p.approvedBy = usAppr.userID
            inner join employees_emp empAp on empAp.employeeID = usAppr.employeeID
            inner join employees_emp e on p.employeeID = e.employeeID
            inner join jobs_emp j on j.jobID = e.jobID
            where p.permissionID = ?;`,
      [permissionID]
    );

    if (printerClients.length === 0) {
      res.status(500).json({
        success: false,
        message: "No hay impresoras locales conectadas.",
        error: error.message,
      });
    }

    //Enviar el contenido a los clientes conectados
    printerClients.forEach((socket) => {
      socket.emit("printPermission", dataPermission);
    });
    return res.status(200).send({ message: "Solicitud de impresión enviada." });
  } catch (error) {
    console.error("Error al imprimir permiso:", error);
    return res
      .status(500)
      .send({ error: "Error al enviar solicitud de impresión." });
  }
};

exports.printTicketPermission = async (req, res) => {
  try {
    // Obtener permissionID desde los parámetros de la URL o del body
    const permissionID = req.params.permissionID || req.body.permissionID;

    if (!permissionID) {
      return res.status(400).send({ error: "Se requiere el permissionID." });
    }

    const [dataPermission] = await db.query(
      `
      	SELECT DISTINCT
                p.permissionID,p.exitTimePermission, p.exitPermission, p.entryPermission, p.date,
                pt.permissionTypeName, p.status, p.isApproved, p.request, pt.time,
                concat(eu.firstName,' ', eu.middleName,' ',eu.lastName) createdBy,  
                concat(empAp.firstName,' ', empAp.middleName,' ',empAp.lastName) approvedBy,
                j.jobName, concat(e.firstName, ' ', e.middleName, ' ', e.lastName) employeeName,
                e.codeEmployee, att.date attendance, att.entryTime attendanceEntry
			        from 
                permissionattendance_emp p
               	  inner join permissiontype_emp pt on p.permissionTypeID = pt.permissionTypeID
                  left join users_us u on p.createdBy = u.userID
                  left join employees_emp eu on u.employeeID = eu.employeeID
                  left join users_us usAppr on p.approvedBy = usAppr.userID
                  left join employees_emp empAp on empAp.employeeID = usAppr.employeeID
                  inner join employees_emp e on p.employeeID = e.employeeID
                  inner join jobs_emp j on j.jobID = e.jobID
              left join (
                SELECT employeeID, date, MIN(entryTime) AS entryTime
                FROM h_attendance_emp
                GROUP BY employeeID, date
              ) att ON p.date = att.date AND p.employeeID = att.employeeID
              where p.permissionID = ?;`,
      [permissionID]
    );

    if (printerClients.length === 0) {
      return res.status(500).json({
        success: false,
        message: "No hay impresoras locales conectadas.",
      });
    }

    //Enviar el contenido a los clientes conectados
    printerClients.forEach((socket) => {
      dataPermission[0].request
        ? socket.emit("printRequestPermission", dataPermission)
        : socket.emit("printDiferidoPermission", dataPermission);
    });

    return res.status(200).send({ message: "Solicitud de impresión enviada." });
  } catch (error) {
    console.error("Error al imprimir permiso:", error);
    return res
      .status(500)
      .send({ message: "Error al enviar solicitud de impresión." });
  }
};

// Función auxiliar para imprimir permiso (sin respuesta HTTP)
exports.printPermissionTicket = async (permissionID, op) => {
  try {
    const [dataPermission] = await db.query(
      `
              SELECT DISTINCT
                p.permissionID,p.exitTimePermission, p.exitPermission, p.entryPermission, p.date,
                pt.permissionTypeName, p.status, p.isApproved, p.request, pt.time,
                concat(eu.firstName,' ', eu.middleName,' ',eu.lastName) createdBy,  
                concat(empAp.firstName,' ', empAp.middleName,' ',empAp.lastName) approvedBy,
                j.jobName, concat(e.firstName, ' ', e.middleName, ' ', e.lastName) employeeName,
                e.codeEmployee, att.date attendance, att.entryTime attendanceEntry
			        from 
                permissionattendance_emp p
               	  inner join permissiontype_emp pt on p.permissionTypeID = pt.permissionTypeID
                  left join users_us u on p.createdBy = u.userID
                  left join employees_emp eu on u.employeeID = eu.employeeID
                  left join users_us usAppr on p.approvedBy = usAppr.userID
                  left join employees_emp empAp on empAp.employeeID = usAppr.employeeID
                  inner join employees_emp e on p.employeeID = e.employeeID
                  inner join jobs_emp j on j.jobID = e.jobID
              left join (
                SELECT employeeID, date, MIN(entryTime) AS entryTime
                FROM h_attendance_emp
                GROUP BY employeeID, date
              ) att ON p.date = att.date AND p.employeeID = att.employeeID
              where p.permissionID = ?;`,
      [permissionID]
    );
    if (printerClients.length === 0) {
      return res.status(500).json({
        message: "No hay impresoras locales conectadas.",
      });
    }
    if (op === "solicitud") {
      printerClients.forEach((socket) => {
        dataPermission[0].request
          ? socket.emit("printRequestPermission", dataPermission)
          : socket.emit("printDiferidoPermission", dataPermission);
      });
    } else {
      printerClients.forEach((socket) => {
        socket.emit("printPermission", dataPermission);
      });
    }

    return { success: true, message: "Solicitud de impresión enviada." };
  } catch (error) {
    console.error("Error al imprimir permiso", error);
    throw error;
  }
};

// Manejar conexión de clientes locales
io.on("connection", (socket) => {
  printerClients.push(socket);
  socket.on("disconnect", () => {
    console.log("Cliente local desconectado");
    printerClients = printerClients.filter((client) => client !== socket);
  });
});
