const db = require('../config/db');

exports.getBloodType= (req, res) => {
  db.query('SELECT * FROM bloodtype_emp', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};
