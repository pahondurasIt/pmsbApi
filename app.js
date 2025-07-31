const http = require("http");
const express = require("express");
const socketIO = require("socket.io");
const app = express();
const path = require("path");

let server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*", // Permitir todas las conexiones CORS
    methods: ["GET", "POST"],
  },
});

// Exportar la instancia de io para que pueda ser utilizada en otros módulos
module.exports.io = io;

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
const linesRoutes = require('./routes/lines');
const thermalPrinterRoutes = require('./routes/thermalPrinter');
const logdispatchingRoutes = require('./routes/logdispatching');
const formAddTimeRoutes = require('./routes/formaddtime');
const usuariosRoutes = require('./routes/usuario'); // Asegúrate de que esta ruta es correcta
const exportEmployeeRoute = require('./routes/exportemployee');



app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

app.use(express.json({ limit: "10mb", extended: true })); // Para manejar JSON
app.use("/api/EmpPht", express.static(path.join(__dirname, "public/EmpPht")));

// Rutas
app.use("/api/employee", employeeRoutes);
app.use("/api/gender", genderRoutes);
app.use("/api/countries", countriesRoutes);
app.use("/api/states", statesRoutes);
app.use("/api/cities", citiesRoutes);
app.use("/api/marital", maritalStatusRoutes);
app.use("/api/educationLevel", educationLevelRoutes);
app.use("/api/bloodtype", bloodtypeRoutes);
app.use("/api/transportation", transportationRoutes);
app.use("/api/dataForm", dataFormRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/registros", registrosRoutes);
app.use("/api/permission", permissionRoutes);
app.use("/api/exportattendance", exportattendanceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/lines", linesRoutes);
app.use("/api/thermalPrinter", thermalPrinterRoutes);
app.use("/api/logdispatching", logdispatchingRoutes);
app.use("/api/formaddtime", formAddTimeRoutes);
app.use("/api/usuarios", usuariosRoutes); // Usar las rutas de usuarios
app.use('/api/exportemployee', exportEmployeeRoute);

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Opcional: loguear en archivo o servicio externo
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
  // Opcional: loguear
});

// Servidor HTTP
const PORT = 3006;

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
