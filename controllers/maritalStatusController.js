const db = require('../config/db');

exports.getMarital= (req, res) => {
  db.query('SELECT * FROM maritalstatus_emp', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};
