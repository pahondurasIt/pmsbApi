const db = require('../config/db');

exports.getuserCompany= (req, res) => {
  db.query('SELECT * FROM usercompany_us', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};
