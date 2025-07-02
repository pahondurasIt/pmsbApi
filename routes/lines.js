const express = require('express');
const router = express.Router();
const linesController = require('../controllers/linesController');

router.get('/', linesController.getLines);

module.exports = router;
