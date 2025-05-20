const express = require('express');
const router = express.Router();
const dataFormController = require('../controllers/dataFormController');

router.get('/', dataFormController.getDataForm);


module.exports = router;