const db = require("../config/db");
const { camposAuditoriaADD } = require("../helpers/columnasAuditoria");
const bcrypt = require("bcrypt"); // Necesitas instalar: npm install bcrypt
const { formatNamePart } = require("../helpers/formateador");

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

exports.getAllUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
                 u.username,
                 u.userID,
                 us.userStatusID
              FROM
                 users_us u
              INNER JOIN
                 userstatus_us us ON u.userStatusID = us.userStatusID`
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No se encontraron usuarios." });
    }

    res.status(200).json({ users: rows });
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

exports.createuser = async (req, res) => {
  const {
    firstName,
    lastName,
    username,
    email,
    password,
    companyID,
    permissions,
  } = req.body;

  console.log("Datos recibidos:", req.body);

  if (
    !firstName ||
    !lastName ||
    !username ||
    !email ||
    !password ||
    !companyID
  ) {
    return res
      .status(400)
      .json({ message: "Todos los campos son requeridos." });
  }

  try {
    // Verificar si el nombre de usuario ya existe
    const [existingUser] = await db.query(
      "SELECT username FROM users_us WHERE username = ?",
      [username]
    );

    if (existingUser.length > 0) {
      return res
        .status(409)
        .json({ message: "El nombre de usuario ya existe." });
    }

    // Verificar si el email ya existe
    const [existingEmail] = await db.query(
      "SELECT email FROM users_us WHERE email = ?",
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({ message: "El email ya existe." });
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10); // 10 es el saltRounds

    // Obtener la fecha y hora actual
    const currentDateTime = new Date();

    // Insertar el nuevo usuario en la base de datos
    const [result] = await db.query(
      "INSERT INTO users_us (firstName, lastName, username, email, passwordHash, userStatusID, passwordLastChanged, createdDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        formatNamePart(firstName),
        formatNamePart(lastName),
        username,
        email,
        hashedPassword,
        1,
        currentDateTime,
        currentDateTime,
      ] // userStatusID 1 es 'Activo'
    );

    const newUserID = result.insertId;

    // Insertar la relación usuario-compañía en la tabla usercompany_us
    await db.query(
      "INSERT INTO usercompany_us (userID, companyID, createdDate) VALUES (?, ?, ?)",
      [newUserID, companyID, currentDateTime]
    );

    // Insertar el perfil por defecto para el nuevo usuario
    if (permissions.length === 0) {
      return res.status(400).json({ message: "No se proporcionaron permisos" });
    }

    // Crear un nuevo perfil para el usuario con el arreglo de permisos
    for (const permission of permissions) {
      await db.query(
        `
          INSERT INTO profilebyuser_us (userId, permissionScreenID, createdDate, createdBy)
          VALUES (?, ?, ?)
        `,
        [newUserID, permission, camposAuditoriaADD(req)]
      );
    }
    res
      .status(201)
      .json({ message: "Usuario creado exitosamente", userId: newUserID });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

exports.getUserById = async (req, res) => {
  const userID = req.params.userID;

  try {
    const [user] = await db.query(
      `select 
        u.userID, u.username, u.email, u.firstName, u.lastName,
        c.companyID, c.companyName
        from users_us u
        inner join usercompany_us uc on uc.userID = u.userID
        inner join companies_us c on c.companyID = uc.companyID
        where u.userID = ?`,
      [userID]
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

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

    res.json({
      user: user[0],
      permissions: permissions,
    });
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

exports.updateUserById = async (req, res) => {
  const userID = req.params.userID;
  const { firstName, lastName, email, companyID, permissions } = req.body;

  try {
    // Verificar si el usuario existe
    const [user] = await db.query(
      `SELECT userID FROM users_us WHERE userID = ?`,
      [userID]
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Actualizar el usuario
    await db.query(
      `UPDATE users_us SET firstName = ?, lastName = ?, email = ?, updatedDate = ? WHERE userID = ?`,
      [firstName, lastName, email, new Date(), userID]
    );

    // Actualizar la compañía del usuario
    if (companyID) {
      await db.query(
        `UPDATE usercompany_us SET companyID = ? WHERE userID = ?`,
        [companyID, userID]
      );
    }

    // Actualizar los permisos del usuario
    await db.query(`DELETE FROM profilebyuser_us WHERE userId = ?`, [userID]);

    if (permissions.length === 0) {
      return res.status(400).json({ message: "No se proporcionaron permisos" });
    }

    // Crear un nuevo perfil para el usuario con el arreglo de permisos
    for (const permission of permissions) {
      await db.query(
        `
          INSERT INTO profilebyuser_us (userId, permissionScreenID, createdDate, createdBy)
          VALUES (?, ?, ?)
        `,
        [userID, permission, camposAuditoriaADD(req)]
      );
    }

    res.status(200).json({ message: "Usuario actualizado exitosamente" });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

exports.createProfileByUser = async (req, res) => {
  const { userID, permissions } = req.body;

  try {
    if (!userID || !Array.isArray(permissions)) {
      return res.status(400).json({ message: "Datos de entrada inválidos" });
    }

    // Eliminar los permisos existentes para el usuario
    await db.query(`DELETE FROM profilebyuser_us WHERE userId = ?`, [userID]);

    if (permissions.length === 0) {
      return res.status(400).json({ message: "No se proporcionaron permisos" });
    }

    //Crear un nuevo perfil para el usuario con el arreglo de permisos
    for (const permission of permissions) {
      await db.query(
        `
        INSERT INTO profilebyuser_us (userId, permissionScreenID)
        VALUES (?, ?)
      `,
        [userID, permission]
      );
    }

    res.status(201).json({ message: "Perfil creado exitosamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear perfil de usuario" });
  }
};

//Modulos cuchao
exports.getModules = async (req, res) => {
  try {
    const [modules] = await db.query(
      `SELECT 
      moduleID, 
      moduleName 
      FROM module_us;`
    );

    res.json(modules);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener módulos" });
  }
};

//Pantallas cuchao
exports.getScreens = async (req, res) => {
  const { moduleID } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
      screenID, 
      screenName
      FROM screen_us
      WHERE moduleID = ?;`,
      [moduleID]
    );

    res.status(200).json({ modules: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener pantallas" });
  }
};

//Permisos para las pantallas cuchao
exports.createPermission = async (req, res) => {
  try {
    const { permissionName, moduleID, screenID } = req.body;

    if (!permissionName || !moduleID || !screenID) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const query = `
      INSERT INTO permissionscreen_us (permissionName, moduleID, screenID, createdDate)
      VALUES (?, ?, ?, NOW())
    `;

    await db.query(query, [permissionName, moduleID, screenID]);

    res.status(201).json({ message: 'Permiso creado exitosamente' });
  } catch (error) {
    console.error('Error al crear permiso:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

exports.createScreen = async (req, res) => {
  try {
    const { screenName, moduleID } = req.body;

    if (!screenName || !moduleID) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    // Procesar valores
    const cleanScreenName = screenName.replace(/\s+/g, '').toLowerCase(); // "Control Screen" => "controlscreen"
    const component = screenName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitaliza cada palabra
      .join(''); // "Control Screen" => "ControlScreen"

    const query = `
      INSERT INTO screen_us (screenName, moduleID, path, component, createdDate)
      VALUES (?, ?, ?, ?, NOW())
    `;

    await db.query(query, [cleanScreenName, moduleID, cleanScreenName, component]);

    res.status(201).json({ message: 'Pantalla creada exitosamente' });

  } catch (error) {
    console.error('Error al crear pantalla:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

exports.createModule = async (req, res) => {
  try {
    const { moduleName } = req.body;
    console.log("Datos recibidos para crear módulo:", req.body);
    

    if (!moduleName) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }
    const query = `
      INSERT INTO module_us ( moduleName, createdDate)
      VALUES (?, NOW())
    `;

    await db.query(query, [moduleName]);

    res.status(201).json({ message: 'Módulo creado exitosamente' });
  } catch (error) {
    console.error('Error al crear módulo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// Obtener permisos por pantalla
exports.getScreensByPermission = async (req, res) => {
  try {
    const { screenID } = req.params;

    const query = `
      SELECT permissionScreenID, permissionName 
      FROM permissionscreen_us 
      WHERE screenID = ?
    `;
    const [results] = await db.query(query, [screenID]);

    res.status(200).json(results);
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
// exports.getPantallas = async (req, res) => {};

