const db = require('../config/db');

exports.getStates= (req, res) => {
  db.query('SELECT * FROM states_emp', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};
