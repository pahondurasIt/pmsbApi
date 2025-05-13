// server.js
const http = require('http');
const express = require('express');
const app = express();

const usuariosRoutes = require('./routes/usuarios');
const empleadosRoutes = require('./routes/empleados');

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, authorization");
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
  
});

// Middlewares
app.use(express.json());

// Rutas
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/empleados', empleadosRoutes);

// Servidor HTTP
const PORT = 3005;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
