const db = require('../config/db');

exports.getEmpleados = async (req, res) => {
  try {
    const [employees] = await db.query('SELECT * FROM employees_emp');

    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener datos para el formulario de empleados' });
  }
};

exports.createEmpleados = async (req, res) => {
  const { username, password, rol, empleado_id } = req.body;
  try {
    const [result] = await db.query('INSERT INTO employees_emp (username, password, rol, empleado_id) VALUES (?, ?)', [username, password, rol, empleado_id]);
    res.json({ id: result.insertId, username, password, rol, empleado_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear el usuario' });
  }
};

exports.updateEmpleados = async (req, res) => {
  const { id } = req.params;
  const { username, password, rol, empleado_id } = req.body;
  try {
    await db.query('UPDATE usuarios SET username = ?, password = ? WHERE id = ?', [username, password, rol, empleado_id]);
    res.json({ message: 'Usuario actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el usuario' });
  }
};

exports.deleteUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar el usuario' });
  }
};

