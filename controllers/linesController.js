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
                l.supervisorID, e.codeEmployee, concat(e.firstName, " ", e.middleName, " ", e.lastName, " ", e.secondLastName) AS supervisorName,
                COUNT(el.employeeID) AS totalEmployees, l.companyID
            FROM
                lines_emp l
            JOIN employees_emp e ON l.supervisorID = e.employeeID
            LEFT JOIN employeelines_emp el ON l.linesID = el.linesID
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
            INSERT INTO lines_emp (linesNumber, supervisorID, companyID, createDate,
            createBy, updateDate, updateBy)
            VALUES (?, ?, ?, ?);
      `,
      [linesNumber, supervisorID, companyID, camposAuditoriaADD(req)]
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
    const { linesNumber, supervisorID } = req.body;
    await db.query(
      `
            UPDATE lines_emp
            SET linesNumber = ?, supervisorID = ?, updateDate = ?, updateBy = ?
            WHERE linesID = ?;
      `,
      [
        linesNumber,
        supervisorID,
        ...camposAuditoriaUPDATE(req),
        req.params.linesID,
      ]
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
              employeeLinesID, e.employeeID, e.codeEmployee, concat(firstName, " ", middleName, " ", lastName, " ", secondLastName) employeeName,
              e.employeeID, e.codeEmployee, el.linesID, e.employeeID, e.photoUrl
            FROM
                employeelines_emp  el
            inner join employees_emp e on el.employeeID = e.employeeID
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

// Obtener empleados sin línea asignada
exports.employeesWithoutLine = async (req, res) => {
  try {
    const [employeeWithoutLine] = await db.query(
      `
        SELECT 
          e.employeeID, e.codeEmployee,
          CONCAT(e.firstName, ' ', e.middleName, ' ', e.lastName, ' ', e.secondLastName) AS employeeName
        FROM 
            employees_emp e
        LEFT JOIN 
            employeelines_emp el ON e.employeeID = el.employeeID
        WHERE 
          e.companyID = 1 and e.isActive = 1 and e.jobID = 73 and el.employeeID IS NULL;
      `
    );

    res.json(employeeWithoutLine);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener empleados por línea" });
  }
};

// Agregar un empleado a una línea
exports.addEmployeeToLine = async (req, res) => {
  try {
    const { employeeID, linesID } = req.body;
    if (!employeeID || !linesID) {
      return res.status(400).json({ message: "Faltan datos requeridos" });
    }
    const [employeeAsignado] = await db.query(
      `select el.employeeLinesID, el.employeeID, el.linesID, l.linesNumber from employeelines_emp el
        inner join lines_emp l on l.linesID = el.linesID where employeeID = ?;`,
      [employeeID]
    );
    if (employeeAsignado.length > 0) {
      await db.query(`Delete from employeelines_emp where employeeID = ?;`, [
        employeeID,
      ]);
    }
    const [result] = await db.query(
      `
            INSERT INTO employeelines_emp (employeeID, linesID, createDate, createBy, updateDate, updateBy)
            VALUES (?, ?, ?);
      `,
      [employeeID, linesID, camposAuditoriaADD(req)]
    );

    if (result.affectedRows === 0) {
      return res
        .status(400)
        .json({ message: "No se pudo agregar el empleado a la línea" });
    }

    res.json({
      message: "Empleado agregado a la línea exitosamente",
      employeeAsignado,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al agregar empleado a la línea" });
  }
};

// Eliminar un empleado de una línea
exports.removeEmployeeFromLine = async (req, res) => {
  try {
    const { employeeLinesID } = req.params;
    const [result] = await db.query(
      `
            DELETE FROM employeelines_emp
            WHERE employeeLinesID = ?;
      `,
      [employeeLinesID]
    );

    if (result.affectedRows === 0) {
      return res
        .status(500)
        .json({ message: "Empleado no encontrado en la línea" });
    }

    res.json({ message: "Empleado eliminado de la línea exitosamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar empleado de la línea" });
  }
};
