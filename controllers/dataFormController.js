const db = require('../config/db');

exports.getDataForm = async (req, res) => {
  try {
    const [bloodTypes] = await db.query('SELECT * FROM bloodtype_emp');
    const [maritalStatus] = await db.query('SELECT * FROM maritalstatus_emp');
    const [transportTypes] = await db.query('SELECT * FROM transportation_emp');
    const [documentTypes] = await db.query('SELECT * FROM doctypes_emp');
    const [states] = await db.query('SELECT * FROM states_emp');
    const [cities] = await db.query('SELECT * FROM cities_emp');
    const [sectors] = await db.query('SELECT * FROM sectors_emp');
    const [suburbs] = await db.query('SELECT * FROM suburbs_emp');
    const [sizes] = await db.query('SELECT * FROM sizes_emp');
    const [educationLevels] = await db.query('SELECT * FROM educationlevel_emp');
    const [gender] = await db.query('SELECT * FROM gender_emp');
    const [relativesType] = await db.query('SELECT * FROM relativestype_emp');
    const [divisions] = await db.query('SELECT * FROM division_emp');
    const [areas] = await db.query('SELECT * FROM area_emp');
    const [departments] = await db.query('SELECT * FROM department_emp');     
    const [jobs] = await db.query('SELECT * FROM jobs_emp');
    const [contractType] = await db.query('SELECT * FROM contracttype_emp');
    const [payrollType] = await db.query('SELECT * FROM payrolltype_emp');
    const [shifts] = await db.query('SELECT * FROM shifts_emp');
    const [supervisors] = await db.query(`
      select e.employeeID, concat(e.firstName,' ',e.middleName,' ',e.lastName ,' ', e.secondLastName) nombreCompleto,
            j.jobName from pmsb.employees_emp e
            inner join pmsb.jobs_emp j on  e.jobID = j.jobID
            where j.jobName like 'Supervisor%';
            `);


    res.json({
      bloodTypes,
      maritalStatus,
      transportTypes,
      documentTypes,
      states,
      cities,
      sectors,
      suburbs,
      sizes,
      educationLevels,
      gender,
      relativesType,
      divisions,
      areas,
      departments,
      jobs,
      contractType,
      payrollType,
      shifts,
      supervisors
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener datos para el formulario de empleados' });
  }
};

