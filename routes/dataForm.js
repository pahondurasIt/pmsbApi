const express = require('express');
const router = express.Router();
const dataFormController = require('../controllers/dataFormController');

router.get('/', dataFormController.getDataForm);
router.post('/newAddress', dataFormController.createNewAddress);

module.exports = router;