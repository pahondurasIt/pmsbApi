// controllers/authController.js
const bcrypt = require('bcrypt'); // Necesitas instalar: npm install bcrypt
const jwt = require('jsonwebtoken'); // Necesitas instalar: npm install jsonwebtoken
const db = require('../config/db'); // Ajusta la ruta a tu archivo de configuración de base datos

// Se recomienda usar una variable de entorno para tu JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key'; // ¡CAMBIA ESTA CLAVE POR UNA MUY SEGURA!

exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
    }

    try {
        // 1. Buscar el usuario en la base de datos y obtener su estado
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
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        const user = rows[0];

        // 2. Validar la contraseña hasheada
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            const newFailedAttempts = (user.failedLoginAttemps || 0) + 1;
            await db.query(
                'UPDATE users_us SET failedLoginAttemps = ? WHERE userID = ?',
                [newFailedAttempts, user.userID]
            );
            console.log(`Intentos de login fallidos para ${username}: ${newFailedAttempts}`);
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 3. Verificar si el usuario está activo
        if (user.statusName !== 'Activo') {
            return res.status(403).json({ message: 'Tu cuenta está inactiva. Contacta al administrador.' });
        }

        // 4. Resetear failedLoginAttemps a 0
        if (user.failedLoginAttemps > 0) {
            await db.query(
                'UPDATE users_us SET failedLoginAttemps = 0 WHERE userID = ?',
                [user.userID]
            );
            console.log(`Intentos de login fallidos reseteados para ${username}.`);
        }

        // 5. Fetch associated countries and companies
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
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            token,
            user: {
                id: user.userID,
                username: user.username,
                role: user.role,
                status: user.statusName,
                associatedLocations: associatedLocations
            }
        });
    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// NUEVO: Endpoint específico para login de despacho
exports.loginDespacho = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Nombre de usuario y contraseña son requeridos.' });
    }

    try {
        // 1. Buscar el usuario en la base de datos y obtener su estado
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
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        const user = rows[0];

        // 2. Validar la contraseña hasheada
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            const newFailedAttempts = (user.failedLoginAttemps || 0) + 1;
            await db.query(
                'UPDATE users_us SET failedLoginAttemps = ? WHERE userID = ?',
                [newFailedAttempts, user.userID]
            );
            console.log(`Intentos de login fallidos para despacho ${username}: ${newFailedAttempts}`);
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 3. Verificar si el usuario está activo
        if (user.statusName !== 'Activo') {
            return res.status(403).json({ message: 'Tu cuenta está inactiva. Contacta al administrador.' });
        }

        // 4. Verificar si el usuario tiene permisos para despacho (opcional - puedes agregar lógica específica aquí)
        // Por ejemplo, verificar si tiene un rol específico o permisos de despacho
        // if (user.role !== 'despacho' && user.role !== 'admin') {
        //     return res.status(403).json({ message: 'No tienes permisos para acceder al módulo de despacho.' });
        // }

        // 5. Resetear failedLoginAttemps a 0
        if (user.failedLoginAttemps > 0) {
            await db.query(
                'UPDATE users_us SET failedLoginAttemps = 0 WHERE userID = ?',
                [user.userID]
            );
            console.log(`Intentos de login fallidos reseteados para despacho ${username}.`);
        }

        // 6. Generar un JWT específico para despacho
        const token = jwt.sign(
            { 
                id: user.userID, 
                username: user.username, 
                role: user.role, 
                status: user.statusName,
                module: 'despacho' // Identificador del módulo
            },
            JWT_SECRET,
            { expiresIn: '8h' } // Token con duración más corta para mayor seguridad
        );

        res.status(200).json({
            message: 'Acceso autorizado al módulo de despacho.',
            token,
            user: {
                id: user.userID,
                username: user.username,
                role: user.role,
                status: user.statusName,
                module: 'despacho'
            }
        });
    } catch (error) {
        console.error('Error en el login de despacho:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

