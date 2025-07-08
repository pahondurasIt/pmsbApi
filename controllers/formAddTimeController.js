const db = require("../config/db")
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
require('dayjs/locale/es')
const { io } = require('../app'); // Importar la instancia de Socket.IO

dayjs.extend(utc);
dayjs.extend(timezone);

exports.getAddTime = async (req, res) => {

    try {
        const today = dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD");

        // Consulta SQL para obtener empleados activos sin marcaje hoy
        const query = `SELECT 
                e.codeEmployee,
                CONCAT( e.firstName, ' ', COALESCE(e.middleName, ' '),' ',e.lastName,' ', e.secondLastName) as fullName
                FROM employees_emp e
                LEFT JOIN h_attendance_emp a ON e.employeeID = a.employeeID 
                    AND DATE(a.date) = CURDATE()
                WHERE e.isActive = 1
                    AND a.hattendanceID IS NULL;`
            ;

        // Ejecutar la consulta
        const [results] = await db.query(query, [today]);

        res.status(200).json(results);

    } catch (error) {
        console.log(`Error al obtener empleados: ${error}!`);
        res.status(500).json({ message: "Error interno del servidor" })
    }

}

exports.postAddTime = async (req, res) => {

    const { codeEmployee, time } = req.body;

    if (!codeEmployee || !time) {
        return res.status(400).json({ message: "Datos incompletos!" })
    }

    try {

        const [[employee]] = await db.query(`
            SELECT employeeID FROM employees_emp WHERE codeEmployee = ?`,
            [codeEmployee]
        )

        if (!employee) {
            return res.status(404).json({ message: "Empleado no encontrado" });
        }

        const now = dayjs().tz("America/Tegucigalpa").format("YYYY-MM-DD");
        const datetime = `${now} ${time}`;

        // Insertar el marcaje
        await db.query(
            `INSERT INTO h_attendance_emp (employeeID, date, entryTime, createdBy,updatedBy)
             VALUES (?, ?, ?, ?,?)`,
            [employee.employeeID, now, time, 1,1]
        );

       //Socket Para Actualizar la tabla 
        io.emit("actualizar_empleados_tabla")



        res.status(200).json({ message: "Marcaje registrado correctamente" });
    } catch (error){
        console.log(`❌ Error al registrar marcaje: ${error}`);
        res.status(500).json({ message: "Error interno del servidor" });
    }

}