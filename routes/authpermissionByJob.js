const express = require('express');
const router = express.Router();
const employeeSupController = require('../controllers/authpermissionByJobController');

router.get('/', employeeSupController.getempSupervisor);
router.post('/', employeeSupController.createLine);
router.put('/:empSupervisorID', employeeSupController.updateEmpSupervisor);
router.get('/jobByArea', employeeSupController.getJobByArea);

module.exports = router;
