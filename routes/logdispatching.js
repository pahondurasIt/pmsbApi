const express = require('express');
const router = express.Router();    
const logDispatchingController = require('../controllers/logdispatchingController');

router.post('/',logDispatchingController.getLogDispatching)

module.exports = router;