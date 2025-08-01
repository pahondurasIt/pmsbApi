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
      console.log(newUserID, permission, camposAuditoriaADD(req));

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
exports.getPantallas = async (req, res) => {};
