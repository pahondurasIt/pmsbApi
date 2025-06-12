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
    const { employeeID } = req.body;
    try {
        const [dataPermission] = await db.query(`
      		SELECT 
                p.permissionID, p.exitTimePermission, p.entryTimePermission, p.exitPermission, p.entryPermission,
                pt.permissionTypeID, pt.permissionTypeName, u.username,  j.jobName,
                concat(e.firstName, ' ', e.middleName, ' ', e.lastName, ' ', e.secondLastName) completeName, e.codeEmployee,
                ROUND(TIMESTAMPDIFF(Minute, p.exitTimePermission, p.entryTimePermission) /60, 2) AS hoursDifference
            from 
                pmsb.permissionattendance_emp p
            inner join pmsb.permissiontype_emp pt on p.permissionTypeID = pt.permissionTypeID
            inner join pmsb.users_us u on p.createdBy = u.userID
            inner join pmsb.employees_emp e on p.employeeID = e.employeeID
            inner join pmsb.jobs_emp j on j.jobID = e.jobID
            where p.employeeID = ${employeeID} and p.isApproved = 1
            and p.entryPermission is null and p.date = DATE(NOW())
            order by p.exitTimePermission desc
            limit 1;`
        );
        console.log(...dataPermission);

        if (printerClients.length === 0) {
            return res
                .status(500)
                .send({ error: "No hay impresoras locales conectadas." });
        }

        //Enviar el contenido a los clientes conectados
        printerClients.forEach((socket) => {
            socket.emit("printPermission", dataPermission);
        });
        console.log("Solicitud de impresión enviada a clientes locales.");
        return res.status(200).send({ message: "Solicitud de impresión enviada." });
    } catch (error) {
        console.error("Error al imprimir permiso:", error);
        return res.status(500).send({ error: "Error al enviar solicitud de impresión." });
    }
};

// Manejar conexión de clientes locales
io.on("connection", (socket) => {
    console.log("Cliente local conectado");
    printerClients.push(socket);

    socket.on("disconnect", () => {
        console.log("Cliente local desconectado");
        printerClients = printerClients.filter((client) => client !== socket);
    });
});
