const db = require("../config/db");
const {
  camposAuditoriaADD,
  camposAuditoriaUPDATE,
} = require("../helpers/columnasAuditoria");

exports.getLines = async (req, res) => {
  try {
    const [lines] = await db.query(
      `
            SELECT
                l.linesID, l.linesNumber, 
                l.supervisorID, e.codeEmployee, concat(e.firstName, " ", e.middleName, " ", e.lastName) AS supervisorName,
                COUNT(el.employeeID) AS totalEmployees, l.companyID
            FROM
                pmsb.lines_emp l
            JOIN pmsb.employees_emp e ON l.supervisorID = e.employeeID
            LEFT JOIN pmsb.employeelines_emp el ON l.linesID = el.linesID
            GROUP BY
                l.linesID, l.linesNumber, e.employeeID, e.codeEmployee, e.firstName ,e. middleName, e.lastName
            ORDER BY
                l.linesNumber;
      `
    );

    res.json(lines);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener datos de empleados" });
  }
};

// Agregar una nueva linea
exports.createLine = async (req, res) => {
  try {
    const { linesNumber, supervisorID, companyID } = req.body;
    const [result] = await db.query(
      `
            INSERT INTO pmsb.lines_emp (linesNumber, supervisorID, companyID, createDate,
            createBy, updateDate, updateBy)
            VALUES (?, ?, ?, ?);
      `,
      [linesNumber, supervisorID, companyID, camposAuditoriaADD]
    );

    res.json({
      message: "Nueva línea creada exitosamente",
      linesID: result.insertId,
      linesNumber,
      supervisorID,
      companyID,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear la nueva línea" });
  }
};

// Actualizar una línea existente
exports.updateLine = async (req, res) => {
  try {
    console.log(req.body);
    console.log(req.params.linesID);

    const { linesNumber, supervisorID } = req.body;
    await db.query(
      `
            UPDATE pmsb.lines_emp
            SET linesNumber = ?, supervisorID = ?, updateDate = ?, updateBy = ?
            WHERE linesID = ?;
      `,
      [linesNumber, supervisorID, ...camposAuditoriaUPDATE, req.params.linesID]
    );

    res.json({
      message: "Línea actualizada exitosamente",
      linesID: req.params.linesID,
      linesNumber,
      supervisorID,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar la línea" });
  }
};

// Obtener empleados por línea
exports.employeesByLine = async (req, res) => {
  try {
    const [employees] = await db.query(
      `
            SELECT
              employeeLinesID, e.employeeID, e.codeEmployee, concat(firstName, " ", middleName, " ", lastName) employeeName,
              e.employeeID, e.codeEmployee, el.linesID, e.employeeID, e.photoUrl
            FROM
                pmsb.employeelines_emp  el
            inner join pmsb.employees_emp e on el.employeeID = e.employeeID
            WHERE
                el.linesID = ?
            order by el.employeeID asc;
      `,
      [req.params.linesID]
    );

    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener empleados por línea" });
  }
};

// Agregar un empleado a una línea
exports.addEmployeeToLine = async (req, res) => {
  try {
    const { employeeID, linesID } = req.body;
    const [result] = await db.query(
      `
            INSERT INTO pmsb.employeelines_emp (employeeID, linesID, createDate, createBy, updateDate, updateBy)
            VALUES (?, ?, ?);
      `,
      [employeeID, linesID, camposAuditoriaADD]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "No se pudo agregar el empleado a la línea" });
    }

    res.json({
      message: "Empleado agregado a la línea exitosamente",
      employeeLinesID: result.insertId,
      employeeID,
      linesID,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al agregar empleado a la línea" });
  }
}
