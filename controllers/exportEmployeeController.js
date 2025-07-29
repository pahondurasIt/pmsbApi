const db = require("../config/db");
const ExcelJS = require("exceljs");

exports.exportEmployee = async(req, res) => {

    try {
        const [rows] = await db.query(`
            SELECT 
                codeEmployee,
                fullName,
                phoneNumber,
                genderName,
                documentType,
                cityName,
                stateName,
                sectorName,
                suburbName,
                divisionName,
                departmentName,
                areaName,
                jobTitle,
                companyName,
                employeeTypeDesc,
                contractTypeStatus,
                payrollType,
                shiftName,
                educationLevel,
                transportType,
                maritalStatus
            FROM employees_full_info
        `);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Empleados");

        // Encabezados
        worksheet.columns = [
            { header: "Código", key: "codeEmployee", width: 15 },
            { header: "Nombre Completo", key: "fullName", width: 30 },
            { header: "Teléfono", key: "phoneNumber", width: 20 },
            { header: "Género", key: "genderName", width: 15 },
            { header: "Tipo de Documento", key: "documentType", width: 20 },
            { header: "Ciudad", key: "cityName", width: 20 },
            { header: "Estado", key: "stateName", width: 20 },
            { header: "Sector", key: "sectorName", width: 20 },
            { header: "Colonia", key: "suburbName", width: 20 },
            { header: "División", key: "divisionName", width: 20 },
            { header: "Departamento", key: "departmentName", width: 20 },
            { header: "Área", key: "areaName", width: 20 },
            { header: "Puesto", key: "jobTitle", width: 20 },
            { header: "Empresa", key: "companyName", width: 20 },
            { header: "Tipo de Empleado", key: "employeeTypeDesc", width: 20 },
            { header: "Estado del Contrato", key: "contractTypeStatus", width: 20 },
            { header: "Tipo de Nómina", key: "payrollType", width: 20 },
            { header: "Turno", key: "shiftName", width: 20 },
            { header: "Nivel Educativo", key: "educationLevel", width: 20 },
            { header: "Tipo de Transporte", key: "transportType", width: 20 },
            { header: "Estado Civil", key: "maritalStatus", width: 20 }
        ];

        // Agrega los datos
        rows.forEach(row => {
            worksheet.addRow(row);
        });

        // Configura encabezados HTTP para descarga
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=Empleados_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error al generar Excel:", error);
        res.status(500).json({ message: "Error al generar el archivo Excel." });
    }
}