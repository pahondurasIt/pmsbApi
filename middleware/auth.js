const jwt = require('jsonwebtoken');
const JWT_SECRET = 'mi_secreto_super_seguro';

exports.verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

exports.requireTipo = (tipo) => {
  return (req, res, next) => {
    if (req.user.tipo !== tipo) return res.status(403).json({ error: 'Acceso denegado' });
    next();
  };
};
