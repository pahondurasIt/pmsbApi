const db = require("../config/db");

exports.getUsuarios = (req, res) => {
  db.query("SELECT * FROM users_us", (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
};

exports.getPermissions = async (req, res) => {
  try {
    /// Obtener permisos disponibles
    const [permissions] = await db.query(
      `
      select
        ps.permissionScreenID, ps.permissionName, s.screenID,
        s.screenName,  m.moduleID, m.moduleName, false As checked
      from 
        permissionscreen_us ps 
        inner join screen_us s on s.screenID = ps.screenID
        inner join module_us m on m.moduleID = s.moduleID
    `
    );

    // Obtener modulos disponibles
    const [modules] = await db.query(
      `select moduleID, moduleName from module_us;`
    );

    // Obtener pantallas disponibles
    const [screens] = await db.query(
      `select screenID, screenName, moduleID from screen_us;`
    );

    res.json({ permissions, modules, screens });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener datos de empleados" });
  }
};
