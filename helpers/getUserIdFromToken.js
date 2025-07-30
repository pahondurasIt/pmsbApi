const jwt = require("jsonwebtoken"); // Para decodificar el token JWT

// Función de ayuda para obtener el ID de usuario del token JWT
const getUserIdFromToken = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7); // Remover 'Bearer '
    const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";
    const decoded = jwt.verify(token, JWT_SECRET);

    return parseInt(decoded.id); // Retorna el userID del token
  } catch (error) {
    console.error("Error al decodificar token JWT:", error);
    return null;
  }
};

module.exports = getUserIdFromToken;
