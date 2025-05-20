const db = require('../config/db');

exports.getGender = async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM gender_emp');
    res.json(results);
  } catch (error) {
    console.error('Error al obtener los datos:', error);
    res.status(500).json({ error: 'Error al obtener los datos' });
  }
};

