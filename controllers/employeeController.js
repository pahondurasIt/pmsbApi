const db = require('../config/db');
const dayjs = require('dayjs');
const { camposAuditoria } = require('../helpers/columnasAuditoria');

// Obtener todos los empleados 
exports.getEmployees = async (req, res) => {
  try {
    const [employees] = await db.query(
      `
      SELECT 
          e.employeeID, e.codeEmployee, concat(firstName, " ", middleName, " ", lastName, " ", secondLastName) nombreCompleto,
          dep.departmentName, j.jobName, e.incapacitated, shi.shiftName, if (e.isActive, 'ACTIVO', 'INACTIVO') isActive
        FROM employees_emp e
              inner join pmsb.division_emp di on di.divisionID = e.divisionID
              inner join pmsb.area_emp a on a.areaID = e.areaID
              inner join pmsb.department_emp dep on dep.departmentID = e.departmentID
              INNER JOIN pmsb.shifts_emp shi on shi.shiftID = e.shiftID
              inner join pmsb.jobs_emp j on j.jobID = e.jobID
              where e.companyID = 1
              ORDER BY e.employeeID asc;
      `
    );

    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener datos de empleados' });
  }
};

// Get para un solo empleado
exports.getEmployeeByID = async (req, res) => {
  try {
    const [employee] = await db.query(
      `
      select 
        e.employeeID, e.codeEmployee, concat(e.firstName,' ',e.middleName,' ',e.lastName ,' ', e.secondLastName) nombreCompleto, 
        e.firstName,e.middleName,e.lastName ,e.secondLastName, e.phoneNumber, e.birthDate, e.photoUrl,
        e.genderID, g.genderName, e.docID, d.docTypeName, e.docNumber, e.bloodTypeID, b.bloodTypeName,
        e.hireDate, e.endDate, e.isActive, e.partnerName, e.partnerage, e.stateID, st.stateName, e.cityID, c.cityName,
        e.sectorID, se.sectorName, e.suburbID, su.suburbName, e.address, e.gabachSize, sg.sizeName as gabacha, e.shirtSize, ssh.sizeName as shirt,
        e.divisionID, di.divisionName, e.areaID, a.areaName, e.departmentID, dep.departmentName, e.jobID, j.jobName,
        e.companyID, com.companyName, e.contractTypeID, cont.statusDesc, e.payrollTypeID, pay.payrollName, e.shiftID, shi.shiftName,
        e.educationLevelID, el.educationLevelName, e.educationGrade, e.transportTypeID, t.transportTypeName, 
        e.maritalStatusID, m.maritalStatusName, e.nationality, e.evaluationStep,
        concat(supervisor.firstName,' ',supervisor.middleName,' ',supervisor.lastName ,' ', supervisor.secondLastName) supervisorName,
        e.incapacitated, e.salary, e.relatives, e.createdBy, e.createdDate, e.updatedBy, e.updatedDate
      from pmsb.employees_emp e
        inner join pmsb.gender_emp g on g.genderID = e.genderID
        inner join pmsb.doctypes_emp d on d.docID = e.docID
        inner join pmsb.bloodtype_emp b on b.bloodTypeID = e.bloodTypeID
        inner join pmsb.states_emp st on st.stateID = e.stateID
        inner join pmsb.cities_emp c on c.cityID = e.cityID 
        inner join pmsb.sectors_emp se on se.sectorID = e.sectorID
        inner join pmsb.suburbs_emp su on su.suburbID = e.suburbID
        inner join pmsb.sizes_emp sg on sg.sizeID = e.gabachSize
        inner join pmsb.sizes_emp ssh on ssh.sizeID = e.shirtSize
        inner join pmsb.division_emp di on di.divisionID = e.divisionID
        inner join pmsb.area_emp a on a.areaID = e.areaID
        inner join pmsb.department_emp dep on dep.departmentID = e.departmentID
        inner join pmsb.jobs_emp j on j.jobID = e.jobID
        inner join pmsb.companies_us com on com.companyID = e.companyID
        inner join pmsb.contracttype_emp cont on cont.contractTypeID = e.contractTypeID
        inner join pmsb.payrolltype_emp pay on pay.payrollTypeID = e.payrollTypeID
        INNER JOIN pmsb.shifts_emp shi on shi.shiftID = e.shiftID
        inner join pmsb.educationlevel_emp el on el.educationLevelID = e.educationLevelID
        INNER JOIN pmsb.transportation_emp t on t.transportTypeID = e.transportTypeID
        INNER JOIN pmsb.maritalstatus_emp m on m.maritalStatusID = e.maritalStatusID
        left join pmsb.employeesupervisor sup on sup.employeeID = e.employeeID
		LEFT JOIN pmsb.employees_emp supervisor ON supervisor.employeeID = sup.supervisorID
      WHERE e.employeeID = ${req.params.id}`
    );

    const [children] = await db.query(`
      select 
	      concat(f.firstName, ' ', f.middleName, ' ', f.lastName, ' ', f.secondLastName) nombreCompleto,
        f.birthdate, f.birthCert, g.genderName
      from children_emp f
        inner join gender_emp g on g.genderID = f.genderID
      where f.employeeID = ${req.params.id};
      `);

    const [familyInformation] = await db.query(`
      select 
          concat(f.firstName, ' ', f.middleName, ' ', f.lastName, ' ', f.secondLastName) nombreCompleto,
          f.age, r.relativesTypeDesc
      from familyinformation_emp f
      inner join pmsb.relativestype_emp r on r.relativesTypeID = f.relativesTypeID
      where f.employeeID = ${req.params.id};
      `);

    const [econtact] = await db.query(`
      select 
          concat(e.firstName, ' ', e.middleName, ' ', e.lastName, ' ', e.secondLastName) nombreCompleto,
          e.phoneNumber, r.relativesTypeDesc, 
          concat(st.stateName, ', ', c.cityName, ', ', se.sectorName, ', ', su.suburbName) direccion
      from econtacts_emp e
          inner join pmsb.relativestype_emp r on r.relativesTypeID = e.relativesTypeID
          inner join pmsb.states_emp st on st.stateID = e.stateID
          inner join pmsb.cities_emp c on c.cityID = e.cityID 
          inner join pmsb.sectors_emp se on se.sectorID = e.sectorID
          inner join pmsb.suburbs_emp su on su.suburbID = e.suburbID
      where e.employeeID = ${req.params.id};
      `);

    const [auxrelative] = await db.query(`
        select 
          concat(e.firstName, ' ', e.middleName, ' ', e.lastName, ' ', e.secondLastName) nombreCompleto,
          r.relativesTypeDesc
        from auxrelative_emp au
        inner join employees_emp e on e.employeeID = au.employeeID
          inner join pmsb.relativestype_emp r on r.relativesTypeID = au.relativesTypeID
        where au.newEmployee = ${req.params.id};
      `);

    const [beneficiaries] = await db.query(`
      select 
	      concat(f.firstName, ' ', f.middleName, ' ', f.lastName, ' ', f.secondLastName) nombreCompleto,
        f.percentage, r.relativesTypeDesc, f.phoneNumber
      from beneficiaries_emp f
        inner join pmsb.relativestype_emp r on r.relativesTypeID = f.relativesTypeID
      where f.employeeID = ${req.params.id};
      `);

    res.status(201).json({
      employee,
      children,
      familyInformation,
      econtact,
      auxrelative,
      beneficiaries
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener dato del empleado' });
  }
};

// Get para buscar empleados
exports.getEmployeeSearch = async (req, res) => {
  try {
    const { searchTerm } = req.params;
    const [employee] = await db.query(
      `SELECT * from
        (SELECT e.employeeID, concat(e.codeEmployee, ' ', firstName, " ", middleName, " ", lastName, " ", secondLastName) nombreCompleto
       FROM pmsb.employees_emp e) as emp
       WHERE emp.nombreCompleto like ? and e.isActive = 1
       LIMIT 10;`,
      [`%${searchTerm}%`]
    );


    res.status(201).send(employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener dato del empleado' });
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

    if (req.body.supervisorEmp !== '') {
      await db.query(
        `INSERT INTO employeesupervisor (
            employeeID,
            supervisorID,
            createdDate,
            createdBy,
            updatedDate,
            updatedBy
          ) VALUES (?, ?, ?)`, [employeeID, req.body.supervisorEmp, camposAuditoria]);

    }

    req.body.childrenList.forEach(async x => {
      await db.query(
        `INSERT INTO children_emp (
            firstName,
            middleName,
            lastName,
            secondLastName,
            birthDate,
            birthCert,
            genderID,
            employeeID,
            createdDate,
            createdBy,
            updatedDate,
            updatedBy        
            ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ? )`, [x.firstName, x.middleName, x.lastName, x.secondLastName,
      x.birthDate, x.birthCert, x.genderID, employeeID, camposAuditoria]);
    });

    req.body.familyList.forEach(async x => {
      await db.query(
        `INSERT INTO familyinformation_emp (
            relativesTypeID,
            firstName,
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
        VALUES (?, ?, ?, ?)`, [x.relativesTypeID, employeeID, x.employeeID?.employeeID, camposAuditoria]);
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
            phoneNumber,
            employeeID,
            createdDate,
            createdBy,
            updatedDate,
            updatedBy       
            ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [x.firstName, x.middleName, x.lastName, x.secondLastName, x.percentage,
      x.relativesTypeID, x.phoneNumber, employeeID, camposAuditoria]);
    });

    const [employee] = await db.query(
      `SELECT 
          e.employeeID, e.codeEmployee, concat(firstName, " ", middleName, " ", lastName, " ", secondLastName) nombreCompleto,
          dep.departmentName, j.jobName, e.incapacitated, shi.shiftName, e.isActive, e.docNumber
        FROM employees_emp e
              inner join pmsb.division_emp di on di.divisionID = e.divisionID
              inner join pmsb.area_emp a on a.areaID = e.areaID
              inner join pmsb.department_emp dep on dep.departmentID = e.departmentID
              INNER JOIN pmsb.shifts_emp shi on shi.shiftID = e.shiftID
              inner join pmsb.jobs_emp j on j.jobID = e.jobID
              where e.employeeID = ${employeeID}
        ORDER BY e.employeeID asc;`
    );

    res.status(201).json(...employee);
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

