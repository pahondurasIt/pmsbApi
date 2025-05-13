const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: '192.168.30.50',
  user: 'dev',
  password: '@H0ndur@s#SQL@',
  database: 'sistema_asistenciados',
  waitForConnections: true,
  connectionLimit: 10,
});

connection.connect((err) => {
  if (err) throw err;
  console.log('Conectado a la base de datos MySQL');
});

module.exports = connection;
