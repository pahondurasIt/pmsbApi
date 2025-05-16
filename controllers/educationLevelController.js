const db = require('../config/db');

exports.getEducationLevel= (req, res) => {
  db.query('SELECT * FROM educationlevel_emp', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};
