const db = require('../config/db');

exports.getCountries = (req, res) => {
  db.query('SELECT * FROM countries_us', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};