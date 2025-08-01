const dayjs = require("dayjs");
const getUserIdFromToken = require("./getUserIdFromToken");

const camposAuditoriaADD = (req) => {
  const userID = getUserIdFromToken(req);
  return [
    dayjs().format("YYYY-MM-DD"),
    userID || 3, // ID del usuario que realiza la acción
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
