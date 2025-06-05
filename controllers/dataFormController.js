const db = require('../config/db');
const { camposAuditoria } = require('../helpers/columnasAuditoria');

exports.getDataForm = async (req, res) => {
  try {
    const [bloodTypes] = await db.query('SELECT * FROM bloodtype_emp');
    const [maritalStatus] = await db.query('SELECT * FROM maritalstatus_emp');
    const [transportTypes] = await db.query('SELECT * FROM transportation_emp where companyID = 1');
    const [documentTypes] = await db.query('SELECT * FROM doctypes_emp where companyID = 1');
    const [states] = await db.query('SELECT * FROM states_emp');
    const [cities] = await db.query('SELECT * FROM cities_emp');
    const [sectors] = await db.query('SELECT * FROM sectors_emp');
    const [suburbs] = await db.query('SELECT * FROM suburbs_emp');
    const [sizes] = await db.query('SELECT * FROM sizes_emp where companyID = 1');
    const [educationLevels] = await db.query('SELECT * FROM educationlevel_emp where companyID = 1');
    const [gender] = await db.query('SELECT * FROM gender_emp');
    const [relativesType] = await db.query('SELECT * FROM relativestype_emp');
    const [divisions] = await db.query('SELECT * FROM division_emp where companyID = 1');
    const [areas] = await db.query('SELECT * FROM area_emp where companyID = 1');
    const [departments] = await db.query('SELECT * FROM department_emp where companyID = 1');
    const [jobs] = await db.query('SELECT * FROM jobs_emp where companyID = 1');
    const [contractType] = await db.query('SELECT * FROM contracttype_emp where companyID = 1');
    const [payrollType] = await db.query('SELECT * FROM payrolltype_emp where companyID = 1');
    const [shifts] = await db.query('SELECT * FROM shifts_emp where companyID = 1');
    const [correlative] = await db.query('SELECT lastUsed FROM pmsb.correlative where companyID = 1 and correlativeID = 1');
    const [supervisors] = await db.query(`
      select e.employeeID, concat(e.firstName,' ',e.middleName,' ',e.lastName ,' ', e.secondLastName) nombreCompleto,
            j.jobName from pmsb.employees_emp e
            inner join pmsb.jobs_emp j on  e.jobID = j.jobID
            where j.jobName like 'Supervisor%' and e.companyID = 1 and e.isActive = 1;
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
      supervisors,
      correlative: correlative[0].lastUsed
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener datos para el formulario de empleados' });
  }
};

// Guardar un nuevo valor de City, Sector o Suburbio
exports.createNewAddress = async (req, res) => {
  try {
    const { newValue, stateID, cityID, sectorID, opButton } = req.body;

    switch (opButton) {
      case 'city':
        const resultCity = await db.query(`INSERT INTO cities_emp 
          (cityName, stateID, createdDate, createdBy, updatedDate, updatedBy) VALUES (?, ?, ?)`, [newValue, stateID, camposAuditoria]);

        if (resultCity.affectedRows === 0) {
          return res.status(500).json({ message: 'Error al crear la ciudad' });
        }

        const [newCity] = await db.query('SELECT * FROM cities_emp WHERE cityName = ? AND stateID = ?', [newValue, stateID]);
        return res.status(200).json({ ...newCity[0] });

      case 'sector':
        const resultSector = await db.query(`INSERT INTO sectors_emp 
          (sectorName, cityID, createdDate, createdBy, updatedDate, updatedBy) VALUES (?, ?, ?)`, [newValue, cityID, camposAuditoria]);

        if (resultSector.affectedRows === 0) {
          return res.status(500).json({ message: 'Error al crear el sector' });
        }

        const [newSector] = await db.query('SELECT * FROM sectors_emp WHERE sectorName = ? AND cityID = ?', [newValue, cityID]);
        return res.status(200).json({ ...newSector[0] });
      case 'suburb':
        const resultSuburb = await db.query(`INSERT INTO suburbs_emp 
          (suburbName, sectorID, createdDate, createdBy, updatedDate, updatedBy) VALUES (?, ?, ?)`, [newValue, sectorID, camposAuditoria]);

        if (resultSuburb.affectedRows === 0) {
          return res.status(500).json({ message: 'Error al crear el suburbio' });
        }

        const [newSuburb] = await db.query('SELECT * FROM suburbs_emp WHERE suburbName = ? AND sectorID = ?', [newValue, sectorID]);
        return res.status(200).json({ ...newSuburb[0] });
      default:
        return res.status(400).json({ message: 'Operación no válida' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener datos de empleados' });
  }
};

