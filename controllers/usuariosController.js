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

exports.getPermissionById = async (req, res) => {
  const userID = req.params.userID;

  try {
    // Obtener permisos del usuario
    const [permissions] = await db.query(
      `
        SELECT 
          ps.permissionScreenID, ps.permissionName,
        CASE 
            WHEN pu.profilebyuserID IS NOT NULL THEN TRUE
            ELSE FALSE
        END AS checked
        FROM permissionscreen_us ps
          INNER JOIN screen_us s ON s.screenID = ps.screenID
          INNER JOIN module_us m ON m.moduleID = s.moduleID
          LEFT JOIN profilebyuser_us pu 
            ON pu.permissionScreenID = ps.permissionScreenID 
            AND pu.userId = ?
        ORDER BY m.moduleName, s.screenName, ps.permissionName;
    `,
      [userID]
    );

    res.json(permissions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener permisos del usuario" });
  }
};

exports.createProfileByUser = async (req, res) => {
  const { userId, permissions } = req.body;

  try {
    // Validar datos de entrada
    if (!userId || !Array.isArray(permissions)) {
      return res.status(400).json({ message: "Datos de entrada inválidos" });
    }

    // Eliminar los permisos existentes para el usuario
      await db.query(
        `DELETE FROM profilebyuser_us WHERE userId = ?`,
        [userId]
      );

   
    if (permissions.length === 0) {
      return res.status(400).json({ message: "No se proporcionaron permisos" });
    }

    // Crear un nuevo perfil para el usuario con el arreglo de permisos
    for (const permission of permissions) {
      await db.query(
        `
        INSERT INTO profilebyuser_us (userId, permissionScreenID)
        VALUES (?, ?)
      `,
        [userId, permission]
      );
    }

    res.status(201).json({ message: "Perfil creado exitosamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear perfil de usuario" });
  }
};
