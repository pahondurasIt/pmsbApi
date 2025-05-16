const db = require('../config/db');

exports.getCity= (req, res) => {
  db.query('SELECT * FROM cities_emp', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};
