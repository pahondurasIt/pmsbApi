const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

router.get('/', employeeController.getEmployees);
router.post('/', employeeController.createEmployee);
router.put('/:employeeID', employeeController.updateEmployee);
router.get('/supervisoresSewing', employeeController.getSupervisorSewing);
router.get('/employeesSewing', employeeController.getEmployeesSewing);

router.delete('/:employeeID', employeeController.deleteEmployee);
router.get('/employeeByID/:employeeID', employeeController.getEmployeeByID);
router.get('/searchEmployee/:searchTerm', employeeController.getEmployeeSearch);
router.post('/uploadPhoto/:employeeID', employeeController.uploadPhoto);
//// Rutas para hijos ////
router.post('/addChild/:employeeID', employeeController.addChild);
router.put('/updateChild/:childrenID', employeeController.updateChild);
router.delete('/deleteChild/:childrenID', employeeController.deleteChild);
//// Rutas para informacion de familiares ////
router.post('/addFamilyInfo/:employeeID', employeeController.addFamilyInfo);
router.put('/updateFamilyInfo/:familyInfoID', employeeController.updateFamilyInfo);
router.delete('/deleteFamilyInfo/:familyInfoID', employeeController.deleteFamilyInfo);
//// Rutas para contactos de emergencia ////
router.post('/addEContact/:employeeID', employeeController.addEContact);
router.put('/updateEContact/:econtactID', employeeController.updateEContact);
router.delete('/deleteEContact/:econtactID', employeeController.deleteEContact);
// ////// Rutas para familiares dentro de la empresa ////
router.post('/addAuxRelative/:employeeID', employeeController.addAuxRelative);
router.put('/updateAuxRelative/:auxRelativeID', employeeController.updateAuxRelative);
router.delete('/deleteAuxRelative/:auxRelativeID', employeeController.deleteAuxRelative);
router.delete('/deleteAuxRelativeByEmployee/:employeeID', employeeController.deleteAuxRelativeByEmployee);
////// Rutas para informacion de benefiarios //////
router.post('/addBeneficiaryInfo/:employeeID', employeeController.addBeneficiaryInfo);
router.put('/updateBeneficiaryInfo/:beneficiaryID', employeeController.updateBeneficiaryInfo);
router.delete('/deleteBeneficiaryInfo/:beneficiaryID', employeeController.deleteBeneficiaryInfo);

module.exports = router;
