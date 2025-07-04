const express = require('express');
const router = express.Router();
const linesController = require('../controllers/linesController');

router.get('/', linesController.getLines);
router.post('/', linesController.createLine);
router.put('/:linesID', linesController.updateLine);
router.get('/employeeByLine/:linesID', linesController.employeesByLine);
router.post('/addEmployee', linesController.addEmployeeToLine);

module.exports = router;
