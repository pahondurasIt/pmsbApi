const express = require('express');
const router = express.Router();
const dataFormController = require('../controllers/dataFormController');

router.get('/', dataFormController.getDataForm);
router.get('/dismissalType', dataFormController.getDismissalType);
router.post('/newAddress', dataFormController.createNewAddress);

module.exports = router;