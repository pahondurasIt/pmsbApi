const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

router.get('/', employeeController.getEmployees);
router.post('/', employeeController.createEmployee);
router.put('/:id', employeeController.updateEmployee);
router.delete('/:id', employeeController.deleteEmployee);
router.get('/employeeByID/:id', employeeController.getEmployeeByID);
router.get('/searchEmployee/:searchTerm', employeeController.getEmployeeSearch);

module.exports = router;
