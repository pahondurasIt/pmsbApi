// server.js
const http = require('http');
const express = require('express');
const app = express();

const usuariosRoutes = require('./routes/usuarios');
const empleadosRoutes = require('./routes/empleados');
const genderRoutes = require('./routes/gender');
const countriesRoutes = require('./routes/countries');
const statesRoutes = require('./routes/states');
const citiesRoutes = require('./routes/cities');
const maritalStatusRoutes = require('./routes/maritalStatus');
const educationLevelRoutes = require('./routes/educationLevel');
const bloodtypeRoutes = require('./routes/bloodtype');
const transportationRoutes = require('./routes/transportation');
const usercompanyRoutes = require('./routes/usercompany');
const dataFormRoutes = require('./routes/dataForm');

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
app.use('/api/gender', genderRoutes);
app.use('/api/countries', countriesRoutes);
app.use('/api/states', statesRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/marital', maritalStatusRoutes);
app.use('/api/educationLevel', educationLevelRoutes);
app.use('/api/bloodtype', bloodtypeRoutes);
app.use('/api/usercompany', usercompanyRoutes);
app.use('/api/dataForm', dataFormRoutes);

// Servidor HTTP
const PORT = 3005;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
