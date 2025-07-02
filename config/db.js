const mysql = require('mysql2/promise');

const connection = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '12345P',
  database: 'pmsb',
  waitForConnections: true,
  connectionLimit: 10,
});

// Verificar conexión solo si lo necesitas explícitamente
(async () => {
  try {
    const conn = await connection.getConnection();
    console.log('Conectado a la base de datos MySQL');
    conn.release();
  } catch (err) {
    console.error('Error al conectar a la base de datos:', err);
  }
})();

module.exports = connection;
