const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'mi_secreto_super_seguro';

exports.register = async (req, res) => {
  const { nombre, email, password, tipo } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  db.query(
    'INSERT INTO usuarios (nombre, email, password, tipo) VALUES (?, ?, ?, ?)',
    [nombre, email, hashedPassword, tipo],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.status(201).json({ id: result.insertId, nombre, email, tipo });
    }
  );
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, results) => {
    if (err || results.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

    const usuario = results[0];
    const isMatch = await bcrypt.compare(password, usuario.password);
    if (!isMatch) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ token });
  });
};
