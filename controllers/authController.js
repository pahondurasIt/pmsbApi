// controllers/authController.js
const bcrypt = require('bcrypt'); // Necesitas instalar: npm install bcrypt
const jwt = require('jsonwebtoken'); // Necesitas instalar: npm install jsonwebtoken
const db = require('../config/db'); // Ajusta la ruta a tu archivo de configuración de base de datos

// Se recomienda usar una variable de entorno para tu JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key'; // ¡CAMBIA ESTA CLAVE POR UNA MUY SEGURA!

exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
    }

    try {
        // 1. Buscar el usuario en la base de datos y obtener su estado, incluyendo failedLoginAttemps
        const [rows] = await db.query(
            `SELECT
                u.*,
                us.statusName
             FROM
                users_us u
             JOIN
                userstatus_us us ON u.userStatusID = us.userStatusID
             WHERE
                u.username = ?`,
            [username]
        );

        if (rows.length === 0) {
            // Si no se encuentra el usuario, las credenciales son inválidas.
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        const user = rows[0];

        // 2. Validar la contraseña hasheada
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            // Si la contraseña no es válida, incrementamos failedLoginAttemps
            const newFailedAttempts = (user.failedLoginAttemps || 0) + 1;
            await db.query(
                'UPDATE users_us SET failedLoginAttemps = ? WHERE userID = ?',
                [newFailedAttempts, user.userID]
            );
            console.log(`Intentos de login fallidos para ${username}: ${newFailedAttempts}`);
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 3. Verificar si el usuario está activo basándose en el 'statusName'
        if (user.statusName !== 'Activo') {
            return res.status(403).json({ message: 'Tu cuenta está inactiva. Contacta al administrador.' });
        }

        // 4. Si las credenciales son válidas y el usuario está activo:
        // Resetear failedLoginAttemps a 0
        if (user.failedLoginAttemps > 0) {
            await db.query(
                'UPDATE users_us SET failedLoginAttemps = 0 WHERE userID = ?',
                [user.userID]
            );
            console.log(`Intentos de login fallidos reseteados para ${username}.`);
        }

        // 5. Fetch associated countries and companies for the user using usercompany_us
        // Esto se basará en tu query que ya tienes.
        const [userCompaniesAndCountries] = await db.query(
            `SELECT DISTINCT
                co.countryID,
                co.countryName,
                c.companyID,
                c.companyName,
                c.companyDescription
             FROM
                usercompany_us uc
             INNER JOIN
                companies_us c ON uc.companyID = c.companyID
             INNER JOIN
                countries_us co ON co.countryID = c.countryID
             WHERE
                uc.userID = ?`,
            [user.userID]
        );

        // Estructurar los datos para el frontend: un array de países, cada uno con sus compañías.
        const countriesMap = new Map();

        userCompaniesAndCountries.forEach(row => {
            if (!countriesMap.has(row.countryID)) {
                countriesMap.set(row.countryID, {
                    countryID: row.countryID,
                    countryName: row.countryName,
                    companies: []
                });
            }
            countriesMap.get(row.countryID).companies.push({
                companyID: row.companyID,
                companyName: row.companyName,
                companyDescription: row.companyDescription
            });
        });

        const associatedLocations = Array.from(countriesMap.values());

        // 6. Generar un JWT
        const token = jwt.sign(
            { id: user.userID, username: user.username, role: user.role, status: user.statusName },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Devolver el token, user info, y la data de países/compañías
        res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            token,
            user: {
                id: user.userID,
                username: user.username,
                role: user.role,
                status: user.statusName,
                associatedLocations: associatedLocations // Enviar la estructura deseada
            }
        });

    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};