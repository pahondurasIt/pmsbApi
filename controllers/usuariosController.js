const db = require('../config/db');

exports.getUsuarios = (req, res) => {
  db.query('SELECT * FROM users_us', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};

