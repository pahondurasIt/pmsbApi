const db = require('../config/db');

exports.getTransportation= (req, res) => {
  db.query('SELECT * FROM transportation_emp', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};
