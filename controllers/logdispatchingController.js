const db = require('../config/db');

exports.getLogDispatching = async (req, res) => {
    try {
        const [rows, fields] = await db.query('SELECT * FROM accessdispatchig_emp');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener los datos:', error);
        return res.status(500).json({ error: 'Error al obtener los datos' });
    }
};