const db = require("../config/db");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
require("dayjs/locale/es");

// Extender dayjs con plugins de UTC y Timezone
dayjs.extend(utc);
dayjs.extend(timezone);
const multer = require("multer");
const fs = require("fs"); // 👈 esta línea es obligatoria
const path = require("path");
const {
  camposAuditoriaADD,
  camposAuditoriaUPDATE,
} = require("../helpers/columnasAuditoria");
const { isValidNumber, isValidString } = require("../helpers/validator");
const { formatNamePart } = require("../helpers/formateador");

// Configuración de almacenamiento con nombre personalizado
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/EmpPht");
  },
  filename: (req, file, cb) => {
    const employeeCode = req.params.employeeID;
    const ext = path.extname(file.originalname);
    const filename = `${employeeCode}${ext}`;

    // Elimina archivo existente con el mismo nombre si ya existe
    const filePath = path.join("public/EmpPht", filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    cb(null, filename);
  },
});

const upload = multer({ storage });

// Obtener todos los empleados
exports.getEmployees = async (req, res) => {
  try {
    const [employees] = await db.query(
      `
      SELECT
          e.employeeID, e.codeEmployee, concat(firstName, " ", middleName, " ", lastName, " ", secondLastName) nombreCompleto,
          dep.departmentName, j.jobName, e.incapacitated, shi.shiftName, if (e.isActive, 'ACTIVO', 'INACTIVO') isActive,
          e.evaluationStep, e.hireDate
        FROM employees_emp e
              INNER JOIN division_emp di on di.divisionID = e.divisionID
              INNER JOIN area_emp a on a.areaID = e.areaID
              INNER JOIN department_emp dep on dep.departmentID = e.departmentID
              INNER JOIN shifts_emp shi on shi.shiftID = e.shiftID
              INNER JOIN jobs_emp j on j.jobID = e.jobID
              where e.companyID = 1
              ORDER BY e.employeeID asc;
      `
    );

    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener datos de empleados" });
  }
};

// Get para un solo empleado
exports.getEmployeeByID = async (req, res) => {
  try {
    let employeeID = req.params.employeeID;
    if (!isValidNumber(employeeID)) {
      return res.status(400).json({ message: "ID de empleado no válido" });
    }

    const [employee] = await db.query(
      `select
        e.employeeID, e.codeEmployee, concat(e.firstName,' ',e.middleName,' ',e.lastName ,' ', e.secondLastName) nombreCompleto,
        e.firstName,e.middleName,e.lastName ,e.secondLastName, e.phoneNumber, e.birthDate, e.photoUrl, e.genderID, g.genderName, 
        e.docID, d.docTypeName, e.docNumber, e.bloodTypeID, b.bloodTypeName, e.hireDate, e.endDate, e.isActive, e.partnerName, 
        dismissal.dateDismissal, dismissal.dismissalTypeID, disType.dismissalDesc, dismissal.comment,
        e.partnerage, e.stateID, st.stateName, e.cityID, c.cityName, e.sectorID, se.sectorName, e.suburbID, su.suburbName, e.address, 
        e.gabachSize, sg.sizeName as gabacha, e.shirtSize, ssh.sizeName as shirt, e.divisionID, di.divisionName, e.areaID, a.areaName, 
        e.departmentID, dep.departmentName, e.jobID, j.jobName, e.companyID, com.companyName, et.employeeTypeDesc, et.employeeTypeID,
        e.contractTypeID, cont.statusDesc, e.payrollTypeID, pay.payrollName, e.shiftID, shi.shiftName, e.educationLevelID, 
        el.educationLevelName, e.educationGrade, e.transportTypeID, t.transportTypeName, e.maritalStatusID, m.maritalStatusName, 
        e.nationality, e.evaluationStep, e.incapacitated, e.salary, IF(e.relatives, true, false) relatives, e.createdBy, e.createdDate, 
        e.updatedBy, e.updatedDate, line.linesID, line.linesNumber, line.supervisorID supervisorLine, 
        concat(sup.firstName,' ',sup.middleName,' ',sup.lastName ,' ', sup.secondLastName) supervisorName
      from employees_emp e
        INNER JOIN gender_emp g on g.genderID = e.genderID
        INNER JOIN doctypes_emp d on d.docID = e.docID
        INNER JOIN bloodtype_emp b on b.bloodTypeID = e.bloodTypeID
        INNER JOIN states_emp st on st.stateID = e.stateID
        INNER JOIN cities_emp c on c.cityID = e.cityID
        INNER JOIN sectors_emp se on se.sectorID = e.sectorID
        INNER JOIN suburbs_emp su on su.suburbID = e.suburbID
        INNER JOIN sizes_emp sg on sg.sizeID = e.gabachSize
        INNER JOIN sizes_emp ssh on ssh.sizeID = e.shirtSize
        INNER JOIN division_emp di on di.divisionID = e.divisionID
        INNER JOIN area_emp a on a.areaID = e.areaID
        INNER JOIN department_emp dep on dep.departmentID = e.departmentID
        INNER JOIN jobs_emp j on j.jobID = e.jobID
        INNER JOIN companies_us com on com.companyID = e.companyID
        INNER JOIN employeetype_emp et on et.employeeTypeID = e.employeeTypeID
        INNER JOIN contracttype_emp cont on cont.contractTypeID = e.contractTypeID
        INNER JOIN payrolltype_emp pay on pay.payrollTypeID = e.payrollTypeID
        INNER JOIN shifts_emp shi on shi.shiftID = e.shiftID
        INNER JOIN educationlevel_emp el on el.educationLevelID = e.educationLevelID
        INNER JOIN transportation_emp t on t.transportTypeID = e.transportTypeID
        INNER JOIN maritalstatus_emp m on m.maritalStatusID = e.maritalStatusID
        LEFT JOIN employeelines_emp empLine on empLine.employeeID = e.employeeID
        LEFT JOIN lines_emp line on line.linesID = empLine.linesID
        LEFT JOIN employees_emp sup on sup.employeeID = line.supervisorID
        LEFT JOIN h_dismissal_emp dismissal on dismissal.employeeID = e.employeeID
        LEFT JOIN dismissaltype_emp disType on disType.dismissalTypeID = dismissal.dismissalTypeID
      WHERE e.employeeID = ${employeeID};`
    );

    const [children] = await db.query(`
        select
            f.childrenID, f.firstName, f.middleName, f.lastName, f.secondLastName,
            concat(f.firstName, ' ', f.middleName, ' ', f.lastName, ' ', f.secondLastName) nombreCompleto,
            f.birthDate, f.birthCert, g.genderName, g.genderID
        from children_emp f
        INNER JOIN gender_emp g on g.genderID = f.genderID
        where f.employeeID = ${employeeID};
      `);

    const [familyInformation] = await db.query(`
          select
          	f.familyInfoID, f.firstName, f.middleName, f.lastName, f.secondLastName,
            concat(f.firstName, ' ', f.middleName, ' ', f.lastName, ' ', f.secondLastName) nombreCompleto,
            f.age, r.relativesTypeDesc, r.relativesTypeID
          from familyinformation_emp f
          INNER JOIN relativestype_emp r on r.relativesTypeID = f.relativesTypeID
          where f.employeeID = ${employeeID};
      `);

    const [econtact] = await db.query(`
      select
          e.econtactID, e.firstName, e.middleName, e.lastName, e.secondLastName,
          concat(e.firstName, ' ', e.middleName, ' ', e.lastName, ' ', e.secondLastName) nombreCompleto,
          e.phoneNumber, r.relativesTypeDesc, r.relativesTypeID,
          concat(st.stateName, ', ', c.cityName, ', ', se.sectorName, ', ', su.suburbName) direccion,
          st.stateID, st.stateName, c.cityID, c.cityName, se.sectorID, se.sectorName, su.suburbID, su.suburbName
      from econtacts_emp e
          INNER JOIN relativestype_emp r on r.relativesTypeID = e.relativesTypeID
          INNER JOIN states_emp st on st.stateID = e.stateID
          INNER JOIN cities_emp c on c.cityID = e.cityID
          INNER JOIN sectors_emp se on se.sectorID = e.sectorID
          INNER JOIN suburbs_emp su on su.suburbID = e.suburbID
      where e.employeeID = ${employeeID};
      `);

    const [auxrelative] = await db.query(`
        select
          au.auxRelativeID, e.employeeID, e.firstName, e.middleName, e.lastName, e.secondLastName, au.newEmployee,
          concat(e.codeEmployee,' - ', e.firstName, ' ', e.middleName, ' ', e.lastName, ' ', e.secondLastName) completeName,
          r.relativesTypeDesc, r.relativesTypeID
        from auxrelative_emp au
        INNER JOIN employees_emp e on e.employeeID = au.employeeID
          INNER JOIN relativestype_emp r on r.relativesTypeID = au.relativesTypeID
        where au.newEmployee = ${employeeID};
      `);

    const [beneficiaries] = await db.query(`
      select
	      f.beneficiaryID, f.employeeID, f.firstName,  f.middleName,  f.lastName,  f.secondLastName,
	      concat(f.firstName, ' ', f.middleName, ' ', f.lastName, ' ', f.secondLastName) completeName,
        f.percentage, r.relativesTypeDesc, f.relativesTypeID, f.phoneNumber
      from beneficiaries_emp f
        INNER JOIN relativestype_emp r on r.relativesTypeID = f.relativesTypeID
      where f.employeeID = ${employeeID};
      `);

    res.status(201).json({
      employee,
      children,
      familyInformation,
      econtact,
      auxrelative,
      beneficiaries,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener dato del empleado" });
  }
};

// Actualizar evaluación del empleado
exports.updateEvaluation = async (req, res) => {
  try {
    const { employeeID } = req.params;
    const { evaluationStep } = req.body;

    if (!isValidNumber(employeeID)) {
      return res.status(400).json({ message: "ID de empleado no válido" });
    }

    const [result] = await db.query(
      `UPDATE employees_emp SET evaluationStep = ?, updatedDate= ?, updatedBy = ? WHERE employeeID = ?`,
      [evaluationStep, ...camposAuditoriaUPDATE(req), employeeID]
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({ message: "Empleado no encontrado" });
    }

    res.status(200).json({ message: "Evaluación actualizada correctamente" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al actualizar evaluación del empleado" });
  }
};

// Get para buscar empleados
exports.getEmployeeSearch = async (req, res) => {
  try {
    const { searchTerm } = req.params;
    const [employee] = await db.query(
      `SELECT employeeID, completeName from
        (SELECT e.employeeID, concat(e.codeEmployee, ' - ', firstName, " ", middleName, " ", lastName, " ", secondLastName) completeName, e.isActive
       FROM employees_emp e) as emp
       WHERE emp.completeName like ? and emp.isActive = 1
       LIMIT 10;`,
      [`%${searchTerm}%`]
    );

    res.status(201).send(employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener dato del empleado" });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const [correlative] = await db.query(
      "SELECT lastUsed FROM correlative where companyID = 1 and correlativeID = 1"
    );
    if (correlative.length === 0) {
      return res
        .status(500)
        .json({ message: "Error al obtener el correlativo" });
    }
    const [result] = await db.query(
      `INSERT INTO employees_emp (
          codeEmployee, firstName, middleName, lastName, secondLastName, phoneNumber, genderID, docID, docNumber, photoUrl,
          birthDate, bloodTypeID, cityID, stateID, sectorID, suburbID, address, gabachSize, shirtSize, divisionID,
          departmentID, areaID, jobID, hireDate, endDate, isActive, partnerName, partnerage, companyID,
          employeeTypeID, contractTypeID, payrollTypeID, shiftID, educationLevelID, educationGrade, transportTypeID, 
          maritalStatusID, nationality, evaluationStep, incapacitated, salary, relatives, createdDate, createdBy
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? , ?)`,
      [
        correlative[0].lastUsed + 1,
        formatNamePart(req.body.employeeData.firstName),
        formatNamePart(req.body.employeeData.middleName),
        formatNamePart(req.body.employeeData.lastName),
        formatNamePart(req.body.employeeData.secondLastName),
        req.body.employeeData.phoneNumber,
        req.body.employeeData.genderID,
        req.body.employeeData.docID,
        req.body.employeeData.docNumber,
        req.body.employeeData.photoUrl,
        dayjs(req.body.employeeData.birthDate).format("YYYY-MM-DD"),
        req.body.employeeData.bloodTypeID,
        req.body.employeeData.cityID.cityID,
        req.body.employeeData.stateID.stateID,
        req.body.employeeData.sectorID.sectorID,
        req.body.employeeData.suburbID.suburbID,
        req.body.employeeData.address,
        req.body.employeeData.gabachSize.sizeID,
        req.body.employeeData.shirtSize.sizeID,
        req.body.employeeData.divisionID.divisionID,
        req.body.employeeData.departmentID.departmentID,
        req.body.employeeData.areaID.areaID,
        req.body.employeeData.jobID.jobID,
        dayjs(req.body.employeeData.hireDate).format("YYYY-MM-DD"),
        isValidString(req.body.employeeData.endDate)
          ? isValidString(req.body.employeeData.endDate).format("YYYY-MM-DD")
          : null,
        req.body.employeeData.isActive,
        req.body.employeeData.partnerName,
        parseInt(req.body.employeeData.partnerage),
        req.body.employeeData.companyID,
        req.body.employeeData.employeeTypeID,
        req.body.employeeData.contractTypeID,
        req.body.employeeData.payrollTypeID,
        req.body.employeeData.shiftID,
        req.body.employeeData.educationLevelID,
        req.body.employeeData.educationGrade,
        req.body.employeeData.transportTypeID,
        req.body.employeeData.maritalStatusID,
        req.body.employeeData.nationality,
        req.body.employeeData.evaluationStep,
        req.body.employeeData.incapacitated,
        req.body.employeeData.salary,
        req.body.employeeData.relatives,
        camposAuditoriaADD(req), // Fecha y usuario de creación
      ]
    );
    await db.query(
      `UPDATE correlative SET lastUsed = ${
        correlative[0].lastUsed + 1
      }  WHERE (correlativeID = 1)`
    );

    const employeeID = result.insertId;

    req.body.childrenList.forEach(async (x) => {
      await db.query(
        `INSERT INTO children_emp (firstName, middleName, lastName, secondLastName,
            birthDate, birthCert, genderID, employeeID, createdDate, createdBy
            )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ? )`,
        [
          formatNamePart(x.firstName),
          formatNamePart(x.middleName),
          formatNamePart(x.lastName),
          formatNamePart(x.secondLastName),
          dayjs(x.birthDate).format("YYYY-MM-DD"),
          x.birthCert,
          x.genderID,
          employeeID,
          camposAuditoriaADD(req),
        ]
      );
    });

    req.body.familyList.forEach(async (x) => {
      await db.query(
        `INSERT INTO familyinformation_emp (relativesTypeID, firstName, middleName, lastName,
            secondLastName, age, employeeID, createdDate, createdBy
            )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          x.relativesTypeID,
          x.firstName,
          x.middleName,
          x.lastName,
          x.secondLastName,
          x.age,
          employeeID,
          camposAuditoriaADD(req),
        ]
      );
    });

    req.body.emergencyList.forEach(async (x) => {
      await db.query(
        `INSERT INTO econtacts_emp (firstName, middleName, lastName, secondLastName,
            stateID, cityID, sectorID, suburbID, relativesTypeID, phoneNumber,
            employeeID, createdDate, createdBy
            )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          formatNamePart(x.firstName),
          formatNamePart(x.middleName),
          formatNamePart(x.lastName),
          formatNamePart(x.secondLastName),
          x.stateID,
          x.cityID,
          x.sectorID,
          x.suburbID,
          x.relativesTypeID,
          x.phoneNumber,
          employeeID,
          camposAuditoriaADD(req),
        ]
      );
    });

    if (req.body.employeeData.relatives) {
      req.body.familyPAHList.forEach(async (x) => {
        await db.query(
          `INSERT INTO auxrelative_emp (relativesTypeID, newEmployee, employeeID,
            createdDate, createdBy
            )
        VALUES (?, ?, ?, ?)`,
          [x.relativesTypeID, employeeID, x.employeeID, camposAuditoriaADD]
        );
      });
    }

    req.body.beneficiariesList.forEach(async (x) => {
      await db.query(
        `INSERT INTO beneficiaries_emp (firstName, middleName, lastName,
            secondLastName, percentage, relativesTypeID,
            phoneNumber, employeeID, createdDate, createdBy
            )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          formatNamePart(x.firstName),
          formatNamePart(x.middleName),
          formatNamePart(x.lastName),
          formatNamePart(x.secondLastName),
          parseInt(x.percentage),
          x.relativesTypeID,
          x.phoneNumber,
          employeeID,
          camposAuditoriaADD(req),
        ]
      );
    });

    const [employee] = await db.query(
      `SELECT
          e.employeeID, e.codeEmployee, concat(firstName, " ", middleName, " ", lastName, " ", secondLastName) nombreCompleto,
          dep.departmentName, j.jobName, e.incapacitated, shi.shiftName, e.isActive, e.docNumber, if (e.isActive, 'ACTIVO', 'INACTIVO') isActive
        FROM employees_emp e
              INNER JOIN division_emp di on di.divisionID = e.divisionID
              INNER JOIN area_emp a on a.areaID = e.areaID
              INNER JOIN department_emp dep on dep.departmentID = e.departmentID
              INNER JOIN shifts_emp shi on shi.shiftID = e.shiftID
              INNER JOIN jobs_emp j on j.jobID = e.jobID
              where e.employeeID = ${employeeID}
        ORDER BY e.employeeID asc;`
    );

    res.status(201).json(...employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el usuario" });
  }
};

// Obtener todos los empleados
exports.getSupervisorSewing = async (req, res) => {
  try {
    const [supervisores] = await db.query(
      `
        select e.employeeID supervisorID, concat(e.firstName,' ',
        e.middleName,' ',e.lastName ,' ', e.secondLastName) supervisorName
        from employees_emp e
        INNER JOIN jobs_emp j on e.jobID = j.jobID
        where e.isActive = 1 and e.jobID = 62;
      `
    );

    res.json(supervisores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener datos de empleados" });
  }
};

exports.getEmployeesSewing = async (req, res) => {
  try {
    const [employees] = await db.query(
      `
        select e.employeeID, e.codeEmployee, concat(e.firstName,' ', e.middleName,' ',
            e.lastName ,' ', e.secondLastName) employeeName, e.photoUrl
        from employees_emp e
          INNER JOIN jobs_emp j on e.jobID = j.jobID
          INNER JOIN department_emp d on d.departmentID = e.departmentID 
        where e.companyID = 1 and e.isActive = 1 and j.jobID = 73;
      `
    );

    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener datos de empleados" });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { employeeID } = req.params;
    //Actualizar datos del empleado
    if (!isValidNumber(employeeID)) {
      return res.status(400).json({ message: "ID de empleado inválido" });
    }
    const [result] = await db.query(
      `UPDATE employees_emp SET
          firstName = ?, middleName = ?, lastName = ?,
          secondLastName = ?, phoneNumber = ?, genderID = ?,
          docID = ?, docNumber = ?, birthDate = ?,
          bloodTypeID = ?, cityID = ?, stateID = ?,
          sectorID = ?, suburbID = ?, address = ?,
          gabachSize = ?, shirtSize = ?, divisionID = ?,
          departmentID = ?, areaID = ?, jobID = ?,
          hireDate = ?, partnerName = ?, partnerage = ?,
          employeeTypeID =?, contractTypeID = ?, payrollTypeID = ?, shiftID = ?,
          educationLevelID = ?, educationGrade = ?, transportTypeID = ?,
          maritalStatusID = ?, nationality = ?, salary = ?,
          relatives = ?, updatedDate = ?, updatedBy = ?
      WHERE employeeID = ?`,
      [
        formatNamePart(req.body.employeeData.firstName),
        formatNamePart(req.body.employeeData.middleName),
        formatNamePart(req.body.employeeData.lastName),
        formatNamePart(req.body.employeeData.secondLastName),
        req.body.employeeData.phoneNumber,
        req.body.employeeData.genderID,
        req.body.employeeData.docID,
        req.body.employeeData.docNumber,
        dayjs(req.body.employeeData.birthDate)
          .tz("America/Tegucigalpa")
          .format("YYYY-MM-DD"),
        req.body.employeeData.bloodTypeID,
        req.body.employeeData.cityID.cityID,
        req.body.employeeData.stateID.stateID,
        req.body.employeeData.sectorID.sectorID,
        req.body.employeeData.suburbID.suburbID,
        req.body.employeeData.address,
        req.body.employeeData.gabachSize.sizeID,
        req.body.employeeData.shirtSize.sizeID,
        req.body.employeeData.divisionID.divisionID,
        req.body.employeeData.departmentID.departmentID,
        req.body.employeeData.areaID.areaID,
        req.body.employeeData.jobID.jobID,
        dayjs(req.body.employeeData.hireDate).format("YYYY-MM-DD"),
        req.body.employeeData.partnerName,
        parseInt(req.body.employeeData.partnerage),
        req.body.employeeData.employeeTypeID,
        req.body.employeeData.contractTypeID,
        req.body.employeeData.payrollTypeID,
        req.body.employeeData.shiftID,
        req.body.employeeData.educationLevelID,
        req.body.employeeData.educationGrade,
        req.body.employeeData.transportTypeID,
        req.body.employeeData.maritalStatusID,
        req.body.employeeData.nationality,
        req.body.employeeData.salary,
        req.body.employeeData.relatives,
        ...camposAuditoriaUPDATE(req),
        employeeID,
      ]
    );

    const [employee] = await db.query(
      `SELECT
          e.employeeID, e.codeEmployee, concat(firstName, " ", middleName, " ", lastName, " ", secondLastName) nombreCompleto,
          dep.departmentName, j.jobName, e.incapacitated, shi.shiftName, e.isActive, e.docNumber, if (e.isActive, 'ACTIVO', 'INACTIVO') isActive
        FROM employees_emp e
              INNER JOIN division_emp di on di.divisionID = e.divisionID
              INNER JOIN area_emp a on a.areaID = e.areaID
              INNER JOIN department_emp dep on dep.departmentID = e.departmentID
              INNER JOIN shifts_emp shi on shi.shiftID = e.shiftID
              INNER JOIN jobs_emp j on j.jobID = e.jobID
              where e.employeeID = ${employeeID}
        ORDER BY e.employeeID asc;`
    );

    //Agregar registro de historico del empleado
    res.status(201).json(...employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error" });
  }
};

exports.disabledEmployee = async (req, res) => {
  try {
    const [result] = await db.query(
      `INSERT INTO h_dismissal_emp (dateDismissal, dismissalTypeID, employeeID, comment, 
        createdDate, createdBy)
       VALUES (?, ?, ?, ?, ?)`,
      [
        dayjs(req.body.dateDismissal)
          .tz("America/Tegucigalpa")
          .format("YYYY-MM-DD"),
        req.body.dismissalTypeID,
        req.body.employeeID,
        req.body.comment,
        camposAuditoriaADD(req),
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({ message: "Empleado no encontrado" });
    }
    // Actualizar el estado del empleado a inactivo
    await db.query(
      `UPDATE employees_emp SET isActive = 0, endDate = ?, updatedDate = ?, updatedBy = ? WHERE employeeID = ?`,
      [
        dayjs(req.body.dateDismissal)
          .tz("America/Tegucigalpa")
          .format("YYYY-MM-DD"),
        ...camposAuditoriaUPDATE(req),
        req.body.employeeID,
      ]
    );

    res.json({ message: "Empleado deshabilitado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al deshabilitar el empleado" });
  }
};

exports.uploadPhoto = (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error al subir la foto" });
    }

    // Guardar la ruta de la foto en la base de datos
    const photoPath = req.file.filename;
    const employeeID = req.params.employeeID;
    try {
      await db.query(
        "UPDATE employees_emp SET photoUrl = ? WHERE employeeID = ?",
        [photoPath, employeeID]
      );
      res.json({ message: "Foto subida correctamente" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error al guardar la foto en la base de datos" });
    }
  });
};

////// HIJOS DE EMPLEADOS //////
exports.addChild = async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    secondLastName,
    birthDate,
    birthCert,
    genderID,
  } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO children_emp (
          firstName, middleName, lastName, secondLastName, birthDate, birthCert,
          genderID, employeeID, createdDate, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        formatNamePart(firstName),
        formatNamePart(middleName),
        formatNamePart(lastName),
        formatNamePart(secondLastName),
        dayjs(birthDate).format("YYYY-MM-DD"),
        birthCert,
        genderID,
        req.params.employeeID,
        camposAuditoriaADD(req),
      ]
    );
    res.json({ childrenID: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el hijo" });
  }
};
exports.updateChild = async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    secondLastName,
    birthDate,
    birthCert,
    genderID,
  } = req.body;
  if (!isValidNumber(req.params.childrenID)) {
    return res.status(500).json({ message: "ID de hijo inválido" });
  }
  try {
    //Actualizar
    await db.query(
      `UPDATE children_emp SET
          firstName = ?,
          middleName = ?,
          lastName = ?,
          secondLastName = ?,
          birthDate = ?,
          birthCert = ?,
          genderID = ?,
          updatedDate = ?,
          updatedBy = ?
        WHERE childrenID = ?`,
      [
        formatNamePart(firstName),
        formatNamePart(middleName),
        formatNamePart(lastName),
        formatNamePart(secondLastName),
        dayjs(birthDate).format("YYYY-MM-DD"),
        birthCert,
        genderID,
        ...camposAuditoriaUPDATE(req),
        req.params.childrenID,
      ]
    );
    res.json({ message: "Hijo actualizado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar el hijo" });
  }
};
exports.deleteChild = async (req, res) => {
  const { childrenID } = req.params;
  try {
    await db.query("DELETE FROM children_emp WHERE childrenID = ?", [
      childrenID,
    ]);
    res.json({ message: "Hijo eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el hijo" });
  }
};

///// INFORMACION FAMILIAR DE EMPLEADOS //////
exports.addFamilyInfo = async (req, res) => {
  const {
    relativesTypeID,
    firstName,
    middleName,
    lastName,
    secondLastName,
    age,
  } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO familyinformation_emp (
          relativesTypeID, firstName, middleName, lastName, secondLastName, age,
          employeeID, createdDate, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        relativesTypeID,
        formatNamePart(firstName),
        formatNamePart(middleName),
        formatNamePart(lastName),
        formatNamePart(secondLastName),
        age,
        req.params.employeeID,
        camposAuditoriaADD(req),
      ]
    );
    res.json({ familyInfoID: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear la información familiar" });
  }
};
exports.updateFamilyInfo = async (req, res) => {
  const {
    relativesTypeID,
    firstName,
    middleName,
    lastName,
    secondLastName,
    age,
  } = req.body;
  if (!isValidNumber(req.params.familyInfoID)) {
    return res
      .status(500)
      .json({ message: "ID de información familiar inválido" });
  }
  try {
    //Actualizar
    await db.query(
      `UPDATE familyinformation_emp SET
          relativesTypeID = ?,
          firstName = ?,
          middleName = ?,
          lastName = ?,
          secondLastName = ?,
          age = ?,
          updatedDate = ?,
          updatedBy = ?
        WHERE familyInfoID = ?`,
      [
        relativesTypeID,
        formatNamePart(firstName),
        formatNamePart(middleName),
        formatNamePart(lastName),
        formatNamePart(secondLastName),
        age,
        ...camposAuditoriaUPDATE(req),
        req.params.familyInfoID,
      ]
    );
    res.json({ message: "Información familiar actualizada correctamente" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al actualizar la información familiar" });
  }
};
exports.deleteFamilyInfo = async (req, res) => {
  const { familyInfoID } = req.params;
  if (!isValidNumber(familyInfoID)) {
    return res
      .status(500)
      .json({ message: "ID de información familiar inválido" });
  }
  try {
    await db.query("DELETE FROM familyinformation_emp WHERE familyInfoID = ?", [
      familyInfoID,
    ]);
    res.json({ message: "Información familiar eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al eliminar la información familiar" });
  }
};

///// CONTACTOS DE EMERGENCIA //////
exports.addEContact = async (req, res) => {
  const {
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
  } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO econtacts_emp (
          firstName, middleName, lastName, secondLastName, stateID, cityID,
          sectorID, suburbID, relativesTypeID, phoneNumber,
          employeeID, createdDate, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        formatNamePart(firstName),
        formatNamePart(middleName),
        formatNamePart(lastName),
        formatNamePart(secondLastName),
        stateID,
        cityID,
        sectorID,
        suburbID,
        relativesTypeID,
        phoneNumber,
        req.params.employeeID,
        camposAuditoriaADD(req),
      ]
    );
    res.json({ econtactID: result.insertId });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al crear el contacto de emergencia" });
  }
};
exports.updateEContact = async (req, res) => {
  const {
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
  } = req.body;

  if (!isValidNumber(req.params.econtactID)) {
    return res
      .status(500)
      .json({ message: "ID de contacto de emergencia inválido" });
  }
  try {
    await db.query(
      `UPDATE econtacts_emp SET
          firstName = ?, middleName = ?, lastName = ?,
          secondLastName = ?, stateID = ?, cityID = ?,
          sectorID = ?, suburbID = ?, relativesTypeID = ?,
          phoneNumber = ?, updatedDate = ?, updatedBy = ?
        WHERE econtactID = ?`,
      [
        formatNamePart(firstName),
        formatNamePart(middleName),
        formatNamePart(lastName),
        formatNamePart(secondLastName),
        stateID,
        cityID,
        sectorID,
        suburbID,
        relativesTypeID,
        phoneNumber,
        ...camposAuditoriaUPDATE(req),
        req.params.econtactID,
      ]
    );
    res.json({ message: "Contacto de emergencia actualizado correctamente" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al actualizar el contacto de emergencia" });
  }
};
exports.deleteEContact = async (req, res) => {
  const { econtactID } = req.params;
  if (!isValidNumber(econtactID)) {
    return res
      .status(500)
      .json({ message: "ID de contacto de emergencia inválido" });
  }
  try {
    await db.query("DELETE FROM econtacts_emp WHERE econtactID = ?", [
      econtactID,
    ]);
    res.json({ message: "Contacto de emergencia eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al eliminar el contacto de emergencia" });
  }
};

///// AUXILIARES DE EMPLEADOS //////
exports.addAuxRelative = async (req, res) => {
  const { relativesTypeID, employeeID } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO auxrelative_emp (relativesTypeID, newEmployee, employeeID, createdDate, createdBy) VALUES (?, ?, ?, ?, ?)`,
      [
        relativesTypeID,
        parseInt(req.params.employeeID),
        employeeID,
        ...camposAuditoriaADD(req),
      ]
    );
    res.json({ auxRelativeID: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el familiar auxiliar" });
  }
};
exports.updateAuxRelative = async (req, res) => {
  const { relativesTypeID, employeeID } = req.body;

  if (!isValidNumber(req.params.auxRelativeID)) {
    return res
      .status(500)
      .json({ message: "ID de familiar auxiliar inválido" });
  }
  try {
    await db.query(
      `UPDATE auxrelative_emp SET
          relativesTypeID = ?, employeeID = ?,
          updatedDate = ?, updatedBy = ?
        WHERE auxRelativeID = ?`,
      [
        relativesTypeID,
        employeeID,
        ...camposAuditoriaUPDATE(req),
        req.params.auxRelativeID,
      ]
    );
    res.json({ message: "Familiar auxiliar actualizado correctamente" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al actualizar el familiar auxiliar" });
  }
};
exports.deleteAuxRelative = async (req, res) => {
  const { auxRelativeID } = req.params;
  if (!isValidNumber(auxRelativeID)) {
    return res
      .status(500)
      .json({ message: "ID de familiar auxiliar inválido" });
  }
  try {
    await db.query("DELETE FROM auxrelative_emp WHERE auxRelativeID = ?", [
      auxRelativeID,
    ]);
    res.json({ message: "Familiar auxiliar eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el familiar auxiliar" });
  }
};
//Eliminar varios familiares auxiliares
exports.deleteAuxRelativeByEmployee = async (req, res) => {
  const { employeeID } = req.params;
  if (!isValidNumber(employeeID)) {
    return res.status(500).json({ message: "ID de empleado inválido" });
  }
  try {
    await db.query("DELETE FROM auxrelative_emp WHERE newEmployee = ?", [
      employeeID,
    ]);
    res.json({ message: "Familiares auxiliares eliminados correctamente" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al eliminar los familiares auxiliares" });
  }
};
///// INFORMACION DE BENEFICIARIOS //////
exports.addBeneficiaryInfo = async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    secondLastName,
    percentage,
    relativesTypeID,
    phoneNumber,
  } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO beneficiaries_emp (
          firstName, middleName, lastName, secondLastName, percentage,
          relativesTypeID, phoneNumber, employeeID,
          createdDate, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        formatNamePart(firstName),
        formatNamePart(middleName),
        formatNamePart(lastName),
        formatNamePart(secondLastName),
        parseInt(percentage),
        relativesTypeID,
        phoneNumber,
        req.params.employeeID,
        camposAuditoriaADD(req),
      ]
    );
    res.json({ beneficiaryID: result.insertId });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al crear la información del beneficiario" });
  }
};
exports.updateBeneficiaryInfo = async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    secondLastName,
    percentage,
    relativesTypeID,
    phoneNumber,
  } = req.body;

  if (!isValidNumber(req.params.beneficiaryID)) {
    return res
      .status(500)
      .json({ message: "ID de información del beneficiario inválido" });
  }
  try {
    await db.query(
      `UPDATE beneficiaries_emp SET
          firstName = ?, middleName = ?, lastName = ?,
          secondLastName = ?, percentage = ?, relativesTypeID = ?,
          phoneNumber = ?, updatedDate = ?, updatedBy = ?
        WHERE beneficiaryID = ?`,
      [
        firstName,
        middleName,
        lastName,
        secondLastName,
        percentage,
        relativesTypeID,
        phoneNumber,
        ...camposAuditoriaUPDATE(req),
        req.params.beneficiaryID,
      ]
    );
    res.json({
      message: "Información del beneficiario actualizada correctamente",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al actualizar la información del beneficiario" });
  }
};
exports.deleteBeneficiaryInfo = async (req, res) => {
  const { beneficiaryID } = req.params;
  if (!isValidNumber(beneficiaryID)) {
    return res
      .status(500)
      .json({ message: "ID de información del beneficiario inválido" });
  }
  try {
    await db.query("DELETE FROM beneficiaries_emp WHERE beneficiaryID = ?", [
      beneficiaryID,
    ]);
    res.json({
      message: "Información del beneficiario eliminada correctamente",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al eliminar la información del beneficiario" });
  }
};
