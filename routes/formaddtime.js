const express = require('express')
const router = express.Router();
const formAddTimeController = require('../controllers/formAddTimeController')

router.get('/',formAddTimeController.getAddTime)
router.post('/postAddTime',formAddTimeController.postAddTime)
module.exports = router;