const Service = require('node-windows').Service;

// Crear el servicio
const svc = new Service({
    name: 'Api', // Nombre del servicio
    description: 'Servicio para ejecutar mi API de Node.js para impresora 3nStar', // Descripción del servicio
    script: 'C:\\Users\\lguerra\\Documents\\pmsbApi\\app.js', // Ruta completa al archivo principal de tu API
    nodeOptions: [
        '--harmony', // Opciones adicionales para Node.js
        '--max_old_space_size=4096' // Aumentar límite de memoria si es necesario
    ]
});

// Manejar eventos de instalación
svc.on('install', () => {
    console.log('Servicio instalado correctamente');
    svc.start();
});

// Instalar el servicio
svc.uninstall();