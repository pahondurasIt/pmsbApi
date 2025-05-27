const db = require('../config/db');

exports.getAttendance = async (req, res) => {
  try {
    // Obtener parámetros de la solicitud (startDate y endDate para la semana, specificDate para el día)
    const { startDate, endDate, specificDate } = req.query;

    // Construir la consulta base
    let query = `
      SELECT 
        h.employeeID,
        CONCAT(e.firstName, ' ', e.lastName) AS employeeName,
        h.entryTime,
        h.exitTime,
        h.date
      FROM 
        h_attendance_emp h
      JOIN 
        employees_emp e ON h.employeeID = e.employeeID
    `;

    // Array para almacenar las condiciones WHERE
    const conditions = [];
    const values = [];

    // Si se proporciona un rango de fechas (para la semana)
    if (startDate && endDate) {
      conditions.push('h.date BETWEEN ? AND ?');
      values.push(startDate, endDate);
    }

    // Si se proporciona un día específico
    if (specificDate) {
      conditions.push('h.date = ?');
      values.push(specificDate);
    }

    // Agregar las condiciones a la consulta si existen
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Ordenar por employeeID
    query += ' ORDER BY h.employeeID';

    // Ejecutar la consulta con los valores
    const [rows] = await db.query(query, values);

    // Devolver los datos como JSON
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching attendance data:', error);
    res.status(500).json({ message: 'Error al obtener datos de asistencia' });
  }
};