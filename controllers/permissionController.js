const db = require("../config/db");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

// Extender dayjs con plugins de UTC y Timezone
dayjs.extend(utc);
dayjs.extend(timezone);

// Función para obtener tipos de permisoparticipants y lista de empleados
exports.getPermissionData = async (req, res) => {
  try {
    const [permissionResults] = await db.query(
      "SELECT permissionTypeID, permissionTypeName FROM permissiontype_emp"
    );
    const [employeeResults] = await db.query(
      "SELECT employeeID, CONCAT(firstName, ' ', COALESCE(middleName, ''), ' ', lastName) as fullName FROM employees_emp"
    );
    res.json({ permissions: permissionResults, employees: employeeResults });
  } catch (err) {
    console.error("Error fetching permission data:", err);
    res.status(500).json({
      message: "Error al cargar datos iniciales para permisos",
      error: err.message,
    });
  }
};

// Controlador para autorizar y registrar un permiso (AJUSTADO SEGÚN NUEVA PETICIÓN)
exports.authorizePermission = async (req, res) => {
  try {
    // 1. Extraer datos del frontend (solo necesitamos employeeID y permissionType)
    const { employeeID, permissionType } = req.body;

    // 2. Validar datos esenciales
    if (!employeeID || !permissionType) {
      return res.status(400).json({
        success: false,
        message:
          "Datos incompletos. Se requiere ID de empleado y tipo de permiso.",
      });
    }

    // 3. Obtener fecha actual
    const currentDateTimeCST = dayjs().tz("America/Tegucigalpa");
    const currentDateOnly = currentDateTimeCST.format("YYYY-MM-DD");

    // 4. Preparar la consulta SQL INSERT con los campos específicos solicitados
    const query = `
      INSERT INTO permissionattendance_emp (
        employeeID, 
        permissionTypeID, 
        date, 
        comment, 
        isPaid, 
        isApproved, 
        createdDate, 
        createdBy, 
        updatedDate, 
        updatedBy
      ) 
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, NULL, ?)
    `;
    // NOW() para createdDate, NULL para comment y updatedDate
    // exitPermission y entryPermission no se incluyen, serán NULL por defecto

    // 5. Definir los valores para la inserción según lo especificado
    const commentValue = null; // Comentario es NULL
    const isPaidValue = 0;     // isPaid es 0
    const isApprovedValue = 1; // isApproved es 1 (autorizado)
    const createdByValue = 1;  // createdBy es 1
    const updatedByValue = 1;  // updatedBy es 1

    const values = [
      employeeID,
      permissionType,
      currentDateOnly,
      commentValue,       // NULL
      isPaidValue,        // 0
      isApprovedValue,    // 1
      // createdDate se inserta con NOW()
      createdByValue,     // 1
      // updatedDate se inserta como NULL
      updatedByValue,     // 1
    ];

    // 6. Ejecutar la consulta
    const [result] = await db.query(query, values);

    // 7. Verificar y responder
    if (result.affectedRows === 1) {
      const insertedId = result.insertId;
      console.log(
        `Permiso autorizado y guardado con ID: ${insertedId} para empleado ${employeeID} en fecha ${currentDateOnly}`
      );

      res.status(201).json({
        success: true,
        message: "Permiso autorizado y registrado correctamente.",
        permissionId: insertedId,
        savedData: {
          permissionID: insertedId,
          employeeID,
          permissionTypeID: permissionType,
          date: currentDateOnly,
          isApproved: isApprovedValue,
        },
      });
    } else {
      throw new Error(
        "No se pudo guardar el registro del permiso en la base de datos."
      );
    }
  } catch (error) {
    // 8. Manejo de errores
    console.error("Error en authorizePermission:", error);
    res.status(500).json({
      success: false,
      message:
        "Ocurrió un error en el servidor al intentar autorizar el permiso.",
      error: error.message,
    });
  }
};