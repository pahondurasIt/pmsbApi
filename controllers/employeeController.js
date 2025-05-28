const db = require('../config/db');

exports.getEmployee = async (req, res) => {
  try {
    const [employees] = await db.query(
      `SELECT 
          e.codeEmployee, concat(firstName, " ", middleName, " ", lastName, " ", secondLastName) nombreCompleto,
          dep.departmentName, j.jobName, e.incapacitated, shi.shiftName, e.isActive, e.docNumber
        FROM employees_emp e
              inner join pmsb.division_emp di on di.divisionID = e.divisionID
              inner join pmsb.area_emp a on a.areaID = e.areaID
              inner join pmsb.department_emp dep on dep.departmentID = e.departmentID
              INNER JOIN pmsb.shifts_emp shi on shi.shiftID = e.shiftID
              inner join pmsb.jobs_emp j on j.jobID = e.jobID
        ORDER BY e.employeeID asc;`
    );

    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener datos para el formulario de empleados' });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    //console.log(req.body);
    console.log(req.body.employee);
    let camposAuditoria = [
      '2025-05-27',
      2,
      null,
      2
    ];

    const [result] = await db.query(
      `INSERT INTO employees_emp (
          codeEmployee,      
          firstName,
          middleName,
          lastName,
          secondLastName,
          phoneNumber,
          genderID,
          docID,
          docNumber,
          photoUrl,
          birthDate,
          bloodTypeID,
          cityID,
          stateID,
          sectorID,
          suburbID,
          address,
          gabachSize,
          shirtSize,
          divisionID,
          departmentID,
          areaID,
          jobID,
          hireDate,
          endDate,
          isActive,
          partnerName,
          partnerage,
          companyID,
          contractTypeID,
          payrollTypeID,
          shiftID,
          educationLevelID,
          educationGrade,
          transportTypeID,
          maritalStatusID,
          nationality,
          requisition,
          replacementRequition,
          evaluationStep,
          line,
          incapacitated,
          salary,
          relatives,
          createdDate,
          createdBy,
          updatedDate,
          updatedBy
          ) 
      VALUES (?, ?)`,
      [req.body.employee, camposAuditoria]
    );
    console.log(result);

    res.json("result");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear el usuario' });
  }
};

exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { username, password, rol, empleado_id } = req.body;
  try {
    await db.query('UPDATE usuarios SET username = ?, password = ? WHERE id = ?', [username, password, rol, empleado_id]);
    res.json({ message: 'Usuario actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el usuario' });
  }
};

exports.deleteEmployee = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar el usuario' });
  }
};

