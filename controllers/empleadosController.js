const db = require('../config/db');

exports.getEmpleados = (req, res) => {
  db.query('SELECT * FROM empleados', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};

exports.createEmpleados = (req, res) => {
  const { username, password, rol, empleado_id } = req.body;
  db.query('INSERT INTO usuarios (username, password, rol, empleado_id) VALUES (?, ?)', [username, password, rol, empleado_id], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ id: result.insertId, username, password, rol, empleado_id });
  });
};

exports.updateEmpleados = (req, res) => {
  const { id } = req.params;
  const { username, password, rol, empleado_id } = req.body;
  db.query('UPDATE usuarios SET username = ?, password = ? WHERE id = ?', [username, password, rol, empleado_id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Usuario actualizado' });
  });
};

exports.deleteUsuario = (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM usuarios WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Usuario eliminado' });
  });
};
