const db = require('../config/db');

exports.getLogDispatching = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM accessdispatching_emp');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener los datos:', error);
    return res.status(500).json({ error: 'Error al obtener los datos' });
  }
};