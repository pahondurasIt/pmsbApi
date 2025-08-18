const nodemailer = require("nodemailer");

// Configuración del transportador
const transporter = nodemailer.createTransport({
  service: "hotmail", 
  auth: {
    user: "lguerra@powersathletic.com", 
    pass: "@L3sli3#2o25", 
  },
});

// Función para enviar correo
async function enviarCorreo(destinatario, asunto, mensajeHTML) {
  try {
    const info = await transporter.sendMail({
      from: 'lguerra@powersathletic.com', // Remitente
      to: destinatario,
      subject: asunto,
      html: mensajeHTML
    });

    console.log("Correo enviado:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error enviando correo:", error);
    return false;
  }
}

module.exports = enviarCorreo;