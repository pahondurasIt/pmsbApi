const dayjs = require("dayjs");
const getUserIdFromToken = require("./getUserIdFromToken");

const camposAuditoriaADD = (req) => {
  const userID = getUserIdFromToken(req);
  return [
    dayjs().format("YYYY-MM-DD"),
    userID || 2, // ID del usuario que realiza la acción
    null, // ID del usuario afectado, si aplica
    null, // ID de la entidad afectada, si aplica
  ];
};

const camposAuditoriaUPDATE = (req) => {
  const userID = getUserIdFromToken(req);
  return [dayjs().format("YYYY-MM-DD"), userID || 2];
};
module.exports = {
  camposAuditoriaADD,
  camposAuditoriaUPDATE,
};
