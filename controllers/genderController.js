const db = require('../config/db');

exports.getGender = (req, res) => {
  db.query('SELECT * FROM gender_emp', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};

