const db = require('../config/db');
const dayjs = require('dayjs');
const { camposAuditoria } = require('../helpers/columnasAuditoria');


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
              where e.companyID = 1
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
    const [correlative] = await db.query('SELECT lastUsed FROM pmsb.correlative where companyID = 1 and correlativeID = 1');

    const [result] = await db.query(
      `INSERT INTO employees_emp (
          codeEmployee, firstName, middleName, lastName, secondLastName, phoneNumber, genderID, docID, docNumber, photoUrl,
          birthDate, bloodTypeID, cityID, stateID, sectorID, suburbID, address, gabachSize, shirtSize, divisionID,
          departmentID, areaID, jobID, hireDate, endDate, isActive, partnerName, partnerage, companyID,
          contractTypeID, payrollTypeID, shiftID, educationLevelID, educationGrade, transportTypeID, maritalStatusID, nationality,
          evaluationStep, incapacitated, salary, relatives, createdDate, createdBy, updatedDate, updatedBy
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [correlative[0].lastUsed + 1, req.body.employeeData.firstName, req.body.employeeData.middleName,
      req.body.employeeData.lastName, req.body.employeeData.secondLastName, req.body.employeeData.phoneNumber,
      req.body.employeeData.genderID, req.body.employeeData.docID, req.body.employeeData.docNumber, req.body.employeeData.photoUrl,
      req.body.employeeData.birthDate, req.body.employeeData.bloodTypeID, req.body.employeeData.cityID.cityID,
      req.body.employeeData.stateID.stateID, req.body.employeeData.sectorID.sectorID, req.body.employeeData.suburbID.suburbID,
      req.body.employeeData.address, req.body.employeeData.gabachSize.sizeID, req.body.employeeData.shirtSize.sizeID,
      req.body.employeeData.divisionID.divisionID, req.body.employeeData.departmentID.departmentID, req.body.employeeData.areaID.areaID,
      req.body.employeeData.jobID.jobID, req.body.employeeData.hireDate, req.body.employeeData.endDate, req.body.employeeData.isActive,
      req.body.employeeData.partnerName, req.body.employeeData.partnerage, req.body.employeeData.companyID,
      req.body.employeeData.contractTypeID, req.body.employeeData.payrollTypeID, req.body.employeeData.shiftID,
      req.body.employeeData.educationLevelID, req.body.employeeData.educationGrade, req.body.employeeData.transportTypeID,
      req.body.employeeData.maritalStatusID, req.body.employeeData.nationality, req.body.employeeData.evaluationStep,
      req.body.employeeData.incapacitated, req.body.employeeData.salary, req.body.employeeData.relatives, camposAuditoria]
    );
    await db.query(`UPDATE correlative SET lastUsed = ${correlative[0].lastUsed + 1}  WHERE (correlativeID = 1)`);

    const employeeID = result.insertId;

    req.body.childrenList.forEach(async x => {
      await db.query(
        `INSERT INTO children_emp (
            firstName,
            middleName,
            lastName,
            secondLastName,
            birthdate,
            birthCert,
            genderID,
            employeeID,
            createdDate,
            createdBy,
            updatedDate,
            updatedBy        
            ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ? )`, [x.firstName, x.middleName, x.lastName, x.secondLastName,
      x.birthdate, x.birthCert, x.genderID, employeeID, camposAuditoria]);
    });

    req.body.familyList.forEach(async x => {
      await db.query(
        `INSERT INTO familyinformation_emp (
            relativesTypeID,
            fistName,
            middleName,
            lastName,
            secondLastName,
            age,
            employeeID,
            createdDate,
            createdBy,
            updatedDate,
            updatedBy       
            ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [x.relativesTypeID, x.firstName, x.middleName, x.lastName,
      x.secondLastName, x.age, employeeID, camposAuditoria]);
    });

    req.body.emergencyList.forEach(async x => {
      await db.query(
        `INSERT INTO econtacts_emp (
            firstName,
            middleName,
            lastName,
            secondLastName,
            stateID,
            cityID,
            sectorID,
            suburbID,
            relativesTypeID,
            phoneNumber,
            employeeID,
            createdDate,
            createdBy,
            updatedDate,
            updatedBy      
            ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [x.firstName, x.middleName, x.lastName, x.secondLastName,
      x.stateID.stateID, x.cityID.cityID, x.sectorID.sectorID, x.suburbID.suburbID,
      x.relativesTypeID, x.phoneNumber, employeeID, camposAuditoria]);
    });

    if (req.body.employeeData.relatives) {
      req.body.familyPAHList.forEach(async x => {
        await db.query(
          `INSERT INTO auxrelative_emp (
            relativesTypeID,
            newEmployee,
            employeeID,
            createdDate,
            createdBy,
            updatedDate,
            updatedBy       
            ) 
        VALUES (?, ?, ?, ?)`, [x.relativesTypeID, x.newEmployee, employeeID, camposAuditoria]);
      });
    }

    req.body.beneficiariesList.forEach(async x => {
      await db.query(
        `INSERT INTO beneficiaries_emp (
            firstName,
            middleName,
            lastName,
            secondLastName,
            percentage,
            relativesTypeID,
            phone,
            employeeID,
            createdDate,
            createdBy,
            updatedDate,
            updatedBy       
            ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [x.firstName, x.middleName, x.lastName, x.secondLastName, x.percentage,
      x.relativesTypeID, x.phone, employeeID, camposAuditoria]);
    });

    res.json(result);
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

