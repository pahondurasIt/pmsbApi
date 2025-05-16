const express = require('express');
const router = express.Router();
const getGender = require('../controllers/genderController');

router.get('/', genderController.getGender);
router.post('/', genderController.createGender);
router.put('/:id', genderController.updateGender);
router.delete('/:id', genderController.deleteGender);

module.exports = router;
