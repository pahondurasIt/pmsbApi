const http = require('http');
const express = require('express');
const socketIO = require("socket.io");
const app = express();

let server = http.createServer(app);
module.exports.io = socketIO(server);

const usuariosRoutes = require('./routes/usuarios');
const employeeRoutes = require('./routes/employee');
const genderRoutes = require('./routes/gender');
const countriesRoutes = require('./routes/countries');
const statesRoutes = require('./routes/states');
const citiesRoutes = require('./routes/cities');
const maritalStatusRoutes = require('./routes/maritalStatus');
const educationLevelRoutes = require('./routes/educationLevel');
const bloodtypeRoutes = require('./routes/bloodtype');
const transportationRoutes = require('./routes/transportation');
const dataFormRoutes = require('./routes/dataForm');
const attendanceRoutes = require('./routes/attendance');
const registrosRoutes = require('./routes/registros');
const permissionRoutes = require('./routes/permission');
const exportattendanceRoutes = require('./routes/exportattendance');
const authRoutes = require('./routes/auth');



const thermalPrinterRoutes = require('./routes/thermalPrinter');

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

app.use('/api/employee', employeeRoutes);
app.use('/api/gender', genderRoutes);
app.use('/api/countries', countriesRoutes);
app.use('/api/states', statesRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/marital', maritalStatusRoutes);
app.use('/api/educationLevel', educationLevelRoutes);
app.use('/api/bloodtype', bloodtypeRoutes);
app.use('/api/transportation', transportationRoutes);
app.use('/api/dataForm', dataFormRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/permission', permissionRoutes);
app.use('/api/exportattendance', exportattendanceRoutes);
app.use('/api/auth', authRoutes);

app.use('/api/thermalPrinter', thermalPrinterRoutes);

// Servidor HTTP
const PORT = 3005;

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
