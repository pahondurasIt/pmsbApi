const db = require("../config/db");
const {
  camposAuditoriaADD,
  camposAuditoriaUPDATE,
} = require("../helpers/columnasAuditoria");
const getUserIdFromToken = require("../helpers/getUserIdFromToken");

exports.getempSupervisor = async (req, res) => {
  try {
    const [employeeSupervisorData] = await db.query(
      `
          SELECT DISTINCT   
          CONCAT(supervisor.firstName,' ', supervisor.middleName,' ',supervisor.lastName ,' ', 
                supervisor.secondLastName, ' (', supervisor.codeEmployee,')') AS supervisorName,
          areaS.areaName AS areaSupervisor, 
          js.jobName AS jobSupervisor,
          CONCAT(appr.firstName,' ', appr.middleName,' ',appr.lastName ,' ', appr.secondLastName, 
                ' (', appr.codeEmployee,')') AS approverName, 
          areaAppr.areaName AS areaApprover, 
          jobAppr.jobName AS jobApprover,
          jobs.jobID, CONCAT(a.areaName, ' | ',d.departmentName, ' | ', jobs.jobName) jobName
          FROM authpermissionbyjob_emp s
          JOIN employees_emp supervisor 
              ON supervisor.employeeID = s.supervisorID
          JOIN area_emp areaS 
              ON areaS.areaID = supervisor.areaID
          JOIN jobs_emp js 
              ON js.jobID = supervisor.jobID 
          JOIN jobs_emp jobs 
              ON FIND_IN_SET(jobs.jobID, s.jobsID) > 0
          JOIN department_emp d on jobs.departmentID = d.departmentID
          JOIN area_emp a on a.areaID = d.areaID 
          JOIN employees_emp appr 
              ON appr.employeeID = s.approverID 
          JOIN area_emp areaAppr 
              ON areaAppr.areaID = appr.areaID
          JOIN jobs_emp jobAppr 
              ON jobAppr.jobID = appr.jobID 
          WHERE supervisor.companyID = 1;  
      `
    );

    res.json(employeeSupervisorData);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al obtener datos de los empleados" });
  }
};

exports.getEmployeesByJob = async (req, res) => {
  try {
    const userID = req.params.userID;

    const [employees] = await db.query(
      `
        SELECT 
        auth.jobsID, e.codeEmployee, e.employeeID,
        CONCAT(e.firstName,' ', e.middleName,' ',e.lastName ,' ', 
        e.secondLastName, ' (', e.codeEmployee,')') AS fullName,
        j.jobID, j.jobName
        FROM authpermissionbyjob_emp auth
        join employees_emp e ON FIND_IN_SET(e.jobID, auth.jobsID) > 0
        inner join jobs_emp j on j.jobID = e.jobID
        where supervisorID = ?
        and e.isActive;
      `,
      [userID]
    );

    res.json(employees);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al obtener datos de los empleados" });
  }
};

exports.getAuthorization = async (userID) => {
  try {
    const [authorize] = await db.query(
      `
          SELECT authorize FROM authpermissionbyjob_emp
          where supervisorID = ?;
      `,
      [userID]
    );

    return {
      authorize,
    };
  } catch (error) {
    console.error(error);
  }
};

// Agregar una nueva linea
exports.createLine = async (req, res) => {
  try {
    const {} = req.body;

    const [result] = await db.query(
      `
            
            VALUES (?, ?, ?, ?, ?);
      `,
      [, camposAuditoriaADD(req)]
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
exports.updateEmpSupervisor = async (req, res) => {
  try {
    const { linesNumber, supervisorID } = req.body;
    await db.query(
      `
            
            WHERE linesID = ?;
      `,
      [...camposAuditoriaUPDATE(req), req.params.empSupervisorID]
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

// Traer los puestos por area
exports.getJobByArea = async (req, res) => {
  try {
    const [jobData] = await db.query(
      `
        select 
          concat(a.areaName, ' | ', j.jobName) jobArea,
          a.areaID, a.areaName, j.jobID, j.jobName
        from jobs_emp j
        inner join department_emp d on j.departmentID = d.departmentID
        inner join area_emp a on a.areaID = d.areaID
      `
    );

    res.json(jobData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los puestos por área" });
  }
};
