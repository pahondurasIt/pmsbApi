const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { body } = require('express-validator');

router.post('/register', [
  body('nombre').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('tipo').isIn(['admin', 'usuario'])
], register);

router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], login);

module.exports = router;
