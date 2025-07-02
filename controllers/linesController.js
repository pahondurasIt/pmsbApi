const db = require('../config/db');

exports.getLines = async (req, res) => {
    try {
        const [lines] = await db.query(
            `
      SELECT 
        e.employeeID, e.codeEmployee, concat(firstName, " ", middleName, " ", lastName) supervisorName,
        e.employeeID, e.codeEmployee, l.linesNumber
        FROM pmsb.lines_emp l
        inner join pmsb.employees_emp e on e.employeeID = l.supervisorID
        where l.companyID = 1
        order by l.linesNumber asc
      `
        );

        res.json(lines);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener datos de empleados' });
    }
};
