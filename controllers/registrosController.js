const dbdos = require('../config/bdAsistencia');

exports.getRegistrosByEmp = async (req, res) => {
    try {
        const [registros] = await dbdos.query(`select em.codigo Codigo, em.nombre Nombre, em.cargo Cargo, 
                                                DATE_FORMAT(fecha, '%W-%d-%b-%Y') Fecha, hora Entrada, 
                                                salida2 SalidaP1, entrada2 Entrada2, salida3 SalidaP2, entrada3 Entrada3,
                                                salida4 SalidaP3, entrada4 Entrada4,  
                                                salida5 Salida4, entrada5 Entrada5, salida Salida, 
                                                if (despacho, 'Cumplimiento de meta', '-') Despacho   
                                                from registros r
                                                inner join empleados em on  em.id = r.empleado_id
                                                where r.empleado_id = ${req.params.id}
                                                and r.fecha between '${req.params.fechaInicial}' and '${req.params.fechaFinal}'
                                                order by r.fecha asc`);
        res.json(
            registros
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener datos para el formulario de empleados' });
    }
};

exports.getEmpleadosActivos = async (req, res) => {
    try {
        const [registros] = await dbdos.query(`select 
            id,codigo, Concat(codigo, ' - ', nombre) nombre, cargo, nombre as nombreEmp
            from empleados where status = 'Activo'`);
        res.json(
            registros
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener datos para el formulario de empleados' });
    }
};

exports.getAttendanceReport = async (req, res) => {
    const { fechaInicial, fechaFinal } = req.params;

    try {
        const [rows] = await dbdos.query(
            `CALL attendanceEmployee_report(?, ?)`,
            [fechaInicial, fechaFinal]
        );

        // Debido a cómo MySQL2 maneja los resultados de CALL, usamos rows[0]
        res.json(rows[0]); 
    } catch (error) {
        console.error('Error al ejecutar procedimiento almacenado:', error);
        res.status(500).json({ message: 'Error al obtener reporte de asistencia' });
    }
};
