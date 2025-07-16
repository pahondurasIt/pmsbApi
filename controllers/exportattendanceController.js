const db = require("../config/db");
const dayjs = require("dayjs");
const ExcelJS = require("exceljs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const isoWeek = require("dayjs/plugin/isoWeek");

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

// Controlador para exportar asistencia de un día específico a Excel
exports.exportAttendance = async (req, res) => {
  try {
    const { filteredAttendance, selectedDate } = req.body; // Se eliminaron maxPermissionCount y filterMode del req.body ya que no se usan en este controlador.

    if (!filteredAttendance || !Array.isArray(filteredAttendance) || filteredAttendance.length === 0) {
      throw new Error("filteredAttendance is missing or empty.");
    }
    // NOTA: La validación de maxPermissionCount y filterMode se eliminó de aquí
    // porque estos valores se calculan dinámicamente o no son necesarios para este controlador.
    if (!selectedDate || typeof selectedDate !== "string") {
      throw new Error("selectedDate is missing or invalid.");
    }

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Asistencia");

    // --- Determinar la estructura dinámica de las columnas ---
    // Primero, encontrar el número máximo de permisos para cualquier empleado en este día.
    let maxPermsInDay = 0;
    filteredAttendance.forEach(record => {
        let currentPerms = 0;
        // Asumiendo hasta 5 permisos como máximo posible en la base de datos
        for (let i = 1; i <= 5; i++) {
            if (record[`permissionExitTime${i}`] || record[`permissionEntryTime${i}`]) {
                currentPerms = i; // El permiso más alto que tiene datos
            }
        }
        if (currentPerms > maxPermsInDay) {
            maxPermsInDay = currentPerms;
        }
    });

    // Construir los encabezados de las columnas dinámicamente
    const columnHeaders = ["Correlativo", "Código", "Nombre", "Entrada"];
    const columnWidths = [10, 10, 30, 12]; // Anchos iniciales para Correlativo, Código, Nombre, Entrada

    for (let i = 1; i <= maxPermsInDay; i++) {
        columnHeaders.push(`Permiso ${i} S.`); // Permiso de Salida
        columnHeaders.push(`Permiso ${i} E.`); // Permiso de Entrada
        columnWidths.push(12, 12); // Anchos para Permiso S y Permiso E
    }

    columnHeaders.push("Salida"); // Salida siempre al final de los tiempos de marcaje
    columnWidths.push(12); // Ancho para Salida

    columnHeaders.push("Comentarios"); // Comentarios siempre al final
    columnWidths.push(30); // Ancho para Comentarios

    const numberOfColumns = columnHeaders.length;

    // Colores que usaremos
    const titleBgColor = "E6F0FA"; // Color de fondo claro para el título
    const subtitleBgColor = "F2F2F2"; // Color de fondo gris claro para el subtítulo
    const headerBgColor = "D3D3D3"; // Color gris para los encabezados

    // Fila 1: Título principal
    const titleText = `Reporte de Asistencia - Día ${dayjs(selectedDate).format("DD/MM/YYYY")}`;
    const titleRow = worksheet.addRow([titleText]);
    titleRow.height = 30;
    
    // Fusionar celdas para el título
    worksheet.mergeCells(titleRow.number, 1, titleRow.number, numberOfColumns);
    
    // Aplicar estilo y color de fondo a TODAS las celdas de la fila del título
    for (let i = 1; i <= numberOfColumns; i++) {
        const cell = worksheet.getCell(titleRow.number, i);
        cell.font = { name: "Calibri", size: 16, bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: titleBgColor } };
    }

    // Fila 2: Subtítulo
    const employeeCount = filteredAttendance.length;
    const subtitleText = `Empleados registrados: ${employeeCount}`;
    const subtitleRow = worksheet.addRow([subtitleText]);
    subtitleRow.height = 25;

    // Fusionar celdas para el subtítulo
    worksheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, numberOfColumns);
    
    // Aplicar estilo y color de fondo a TODAS las celdas de la fila del subtítulo
    for (let i = 1; i <= numberOfColumns; i++) {
        const cell = worksheet.getCell(subtitleRow.number, i);
        cell.font = { name: "Calibri", size: 12, bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: subtitleBgColor } };
    }

    // Fila 3: Encabezados de la tabla de datos (Correlativo, Código, etc.)
    const headerRow = worksheet.addRow(columnHeaders);
    headerRow.height = 20;

    // Aplicar estilo, color de fondo y bordes a CADA celda de la fila de encabezados
    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 12, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBgColor } };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };
    });

    // Añadir las filas de datos. Estas comenzarán desde la fila 4.
    filteredAttendance.forEach((record, index) => {
      const rowData = [
        index + 1, // Correlativo
        record.employeeID || "", // Código
        record.employeeName || "", // Nombre
        record.entryTime || "", // Entrada
      ];

      // Añadir datos de permisos dinámicamente: Permiso S. luego Permiso E.
      for (let i = 1; i <= maxPermsInDay; i++) {
          rowData.push(record[`permissionExitTime${i}`] || ""); // Permiso de Salida
          rowData.push(record[`permissionEntryTime${i}`] || ""); // Permiso de Entrada
      }

      rowData.push(record.exitTime || ""); // Salida siempre después de todos los permisos

      // Recopilar todos los comentarios en una sola celda
      const comments = [];
      // Iterar hasta el máximo de permisos posibles (5) para comentarios
      for (let i = 1; i <= 5; i++) { 
        if (record[`permissionExitComment${i}`]) {
          comments.push(`P${i}S: ${record[`permissionExitComment${i}`]}`);
        }
        if (record[`permissionEntryComment${i}`]) {
          comments.push(`P${i}E: ${record[`permissionEntryComment${i}`]}`);
        }
      }
      if (record.exitComment) {
        comments.push(`Salida: ${record.exitComment}`);
      }
      if (record.dispatchingComment) {
        comments.push(`Despacho: ${record.dispatchingComment}`);
      }
      rowData.push(comments.join(" | ") || ""); // Comentarios
      worksheet.addRow(rowData);
    });

    // Estilo para las filas de datos
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 3) { // Las filas de datos comienzan desde la fila 4
        row.eachCell((cell) => {
          cell.font = { name: "Calibri", size: 11 };
          cell.alignment = { horizontal: "left", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          };
        });
        row.height = 20;
      }
    });

    // Establecer anchos de columna individualmente usando el array dinámico
    columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });

    // Generar archivo Excel
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const formattedDate = dayjs(selectedDate).format("YYYYMMDD");
    const filename = `asistencia_dia_${formattedDate}.xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(excelBuffer);
  } catch (error) {
    console.error("Error al exportar asistencia:", error.stack || error.message);
    res.status(500).send({ message: `Error interno del servidor al generar el archivo Excel: ${error.message}` });
  }
};

// Controlador para exportar asistencia semanal a Excel con diseño mejorado
exports.exportWeeklyAttendance = async (req, res) => {
    try {
      const { weeklyAttendance, selectedMonth, selectedWeek } = req.body;

      if (!weeklyAttendance || !Array.isArray(weeklyAttendance)) {
        throw new Error("weeklyAttendance is missing or invalid.");
      }
      if (!selectedMonth || typeof selectedMonth !== "string") {
        throw new Error("selectedMonth is missing or invalid.");
      }
      if (!selectedWeek || typeof selectedWeek !== "string") {
        throw new Error("selectedWeek is missing or invalid.");
      }

      // Fetch only active employees
      const [activeEmployees] = await db.query(
        "SELECT employeeID, CONCAT(firstName, ' ', COALESCE(middleName, ''), ' ', lastName) AS employeeName FROM employees_emp WHERE isActive = 1"
      );

      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Asistencia Semanal");

      // Define colors
      const headerBgColor = "1F3864"; // Azul oscuro para encabezados principales
      const subHeaderBgColor = "D6DCE4"; // Gris claro para subencabezados

      // Colores para los días de la semana
      const dayHeaderColors = {
        Lunes: "FFFFFF",
        Martes: "FFC0CB",
        Miércoles: "FFFFFF",
        Jueves: "FFFFFF",
        Viernes: "FFFFFF",
        Sábado: "D3D3D3",
        Domingo: "D3D3D3",
      };

      // Definir días de la semana basados en selectedWeek y selectedMonth (all 7 days)
      const startOfMonth = dayjs().month(parseInt(selectedMonth)).startOf("month");
      const startOfWeek = startOfMonth.isoWeek(parseInt(selectedWeek)).startOf("isoWeek");
      const daysOfWeek = [];
      for (let i = 0; i < 7; i++) {
        const day = startOfWeek.add(i, "day");
        daysOfWeek.push({
          date: day.format("YYYY-MM-DD"),
          dayName: day.format("dddd").charAt(0).toUpperCase() + day.format("dddd").slice(1),
          shortDate: day.format("DD/MM"),
          fullDate: day.format("D [DE] MMMM").toUpperCase(),
        });
      }

      // Sanitizar datos para evitar caracteres no deseados en Excel
      const sanitizedWeeklyAttendance = weeklyAttendance.map((record) => {
        const sanitizeString = (value) => {
          if (typeof value !== "string") return value || "";
          // Eliminar caracteres de control y asegurar compatibilidad
          return value
            .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Eliminar caracteres de control ASCII
            .replace(/\n/g, " ") // Reemplazar saltos de línea con espacio
            .replace(/\r/g, "") // Eliminar retornos de carro
            .replace(/[^\x20-\x7EáéíóúÁÉÍÓÚñÑ]/g, ""); // Eliminar otros caracteres no imprimibles (excepto latinos)
        };
        return {
          employeeID: sanitizeString(record.employeeID),
          employeeName: sanitizeString(record.employeeName),
          date: sanitizeString(record.date),
          entryTime: sanitizeString(record.entryTime),
          exitTime: sanitizeString(record.exitTime),
          dispatchingTime: sanitizeString(record.dispatchingTime),
          dispatchingComment: sanitizeString(record.dispatchingComment),
          exitComment: sanitizeString(record.exitComment),
          ...(Array.from({ length: 5 }, (_, i) => ({ // Asumimos hasta 5 permisos para sanitización
            [`permissionExitTime${i + 1}`]: sanitizeString(record[`permissionExitTime${i + 1}`]),
            [`permissionEntryTime${i + 1}`]: sanitizeString(record[`permissionEntryTime${i + 1}`]),
            [`permissionExitComment${i + 1}`]: sanitizeString(record[`permissionExitComment${i + 1}`]),
            [`permissionEntryComment${i + 1}`]: sanitizeString(record[`permissionEntryComment${i + 1}`]),
          })).reduce((acc, curr) => ({ ...acc, ...curr }), {})),
        };
      });

      // --- Determinar si se incluyen columnas de Despacho y el maxPermissionCount real en la semana ---
      const includeDispatchColumn = sanitizedWeeklyAttendance.some((record) => record.dispatchingTime);
      let maxPermsInWeek = 0;
      sanitizedWeeklyAttendance.forEach(record => {
          let currentPerms = 0;
          for (let i = 1; i <= 5; i++) { // Revisar hasta 5 permisos
              if (record[`permissionExitTime${i}`] || record[`permissionEntryTime${i}`]) {
                  currentPerms = i;
              }
          }
          if (currentPerms > maxPermsInWeek) {
              maxPermsInWeek = currentPerms;
          }
      });

      // Calcular el número de columnas por día (Entrada, Salida, y permisos dinámicos)
      // E (1) + (P1S + P1E) ... (maxPermsInWeek * 2) + D (opcional 1) + S (1)
      const dynamicPermColumnsPerDay = maxPermsInWeek * 2; // Dos columnas por cada permiso (Salida y Entrada)
      const columnsPerDay = 1 + dynamicPermColumnsPerDay + (includeDispatchColumn ? 1 : 0) + 1; // Entrada + Permisos + Despacho (opcional) + Salida
      
      // Correlativo (1) + Código (1) + Empleado (1) + (días * columnas por día) + Comentarios (1)
      const totalDataColumns = 3 + (daysOfWeek.length * columnsPerDay) + 1;

      // Add title (Fila 1)
      const year = dayjs().year(); // Obtener el año actual
      const monthName = dayjs().month(parseInt(selectedMonth)).format("MMMM").toUpperCase();
      const title = `Reporte Semanal - Mes ${monthName} Semana ${selectedWeek}`;
      worksheet.addRow([title]);
      worksheet.mergeCells(1, 1, 1, totalDataColumns); // Usar totalDataColumns para la fusión
      worksheet.getRow(1).font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFF" } };
      worksheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBgColor } };
      worksheet.getRow(1).height = 30;

      // Add subtitle (Fila 2)
      const employeeCount = activeEmployees.length;
      const subtitle = `Total de empleados activos: ${employeeCount}`;
      worksheet.addRow([subtitle]);
      worksheet.mergeCells(2, 1, 2, totalDataColumns); // Usar totalDataColumns para la fusión
      worksheet.getRow(2).font = { name: "Calibri", size: 12, bold: true };
      worksheet.getRow(2).alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
      worksheet.getRow(2).height = 25;

      // Create main header row (Fila 3) - this row will only contain merged day titles
      const mainHeaderRow = []; 
      mainHeaderRow.push("", "", ""); // placeholders for Correlativo, Código, Empleado
      for (let i = 0; i < daysOfWeek.length; i++) {
        mainHeaderRow.push(...Array(columnsPerDay).fill("")); 
      }
      mainHeaderRow.push(""); // placeholder for Comentarios
      worksheet.addRow(mainHeaderRow);

      // Create sub-header row (Fila 4) - for E, P#S, P#E, D, S for each day, plus Correlativo, Código, Empleado and Comentarios
      const subHeaderRow = ["Correlativo", "Código", "Empleado"]; // Now these are in the sub-header row
      daysOfWeek.forEach(() => {
        subHeaderRow.push("E");
        for (let i = 1; i <= maxPermsInWeek; i++) {
          subHeaderRow.push(`P${i}S`);
          subHeaderRow.push(`P${i}E`);
        }
        if (includeDispatchColumn) {
          subHeaderRow.push("D");
        }
        subHeaderRow.push("S");
      });
      subHeaderRow.push("Comentarios"); // Comentarios in the sub-header row
      worksheet.addRow(subHeaderRow);


      // Merge cells for Correlativo, Código, Empleado and Comentarios (Fila 3 y Fila 4)
      worksheet.mergeCells(3, 1, 4, 1); // Correlativo
      worksheet.mergeCells(3, 2, 4, 2); // Código
      worksheet.mergeCells(3, 3, 4, 3); // Empleado
      worksheet.mergeCells(3, totalDataColumns, 4, totalDataColumns); // Comentarios

      // Style Correlativo, Código, Empleado and Comentarios (Fila 3 and 4)
      const staticHeaderColumnNumbers = [1, 2, 3, totalDataColumns]; // Column numbers for static headers
      staticHeaderColumnNumbers.forEach(colNumber => {
          const cell3 = worksheet.getCell(3, colNumber);

          // Apply styles to the first cell of the merged block (which is in row 3)
          cell3.font = { name: "Calibri", size: 12, bold: true };
          cell3.alignment = { horizontal: "center", vertical: "middle" };
          cell3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF" } }; // Blanco
          cell3.border = {
              top: { style: "thin", color: { argb: "000000" } }, bottom: { style: "thin", color: { argb: "000000" } },
              left: { style: "thin", color: { argb: "000000" } }, right: { style: "thin", color: { argb: "000000" } }
          };
      });
      
      // Set values for the merged cells (they will be in row 3, as it's the top-left of the merged block)
      worksheet.getCell(3, 1).value = "Correlativo";
      worksheet.getCell(3, 2).value = "Código";
      worksheet.getCell(3, 3).value = "Empleado";
      worksheet.getCell(3, totalDataColumns).value = "Comentarios";

      // Merge day headers (Fila 3) and style them
      let currentMergeCol = 4;
      daysOfWeek.forEach((day) => {
        worksheet.mergeCells(3, currentMergeCol, 3, currentMergeCol + columnsPerDay - 1);
        const cell = worksheet.getCell(3, currentMergeCol);
        cell.value = `${day.dayName} ${day.shortDate}`; // Usar shortDate para el título
        cell.font = { name: "Calibri", size: 12, bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dayHeaderColors[day.dayName] || "FFFFFF" } };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };
        currentMergeCol += columnsPerDay;
      });
      worksheet.getRow(3).height = 20;

      // Style subheaders (Fila 4) - excluding the merged "Correlativo", "Código", "Empleado", "Comentarios"
      worksheet.getRow(4).font = { name: "Calibri", size: 11, bold: true };
      worksheet.getRow(4).alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(4).eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        // Aplicar colores a los subencabezados (E, P#S, P#E, D, S)
        // Columna de datos para cada día comienza en la columna 4.
        // `colNumber` es 1-based.
        if (colNumber >= 4 && colNumber < totalDataColumns) { // Solo para las columnas de días
            const currentDayColIndex = (colNumber - 4) % columnsPerDay; // 0-indexed relative to start of day's columns
            
            if (currentDayColIndex === 0) { // Es la columna 'E' (Entrada)
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "C6EFCE" } }; // Verde claro
            } else if (currentDayColIndex === (columnsPerDay - 1)) { // Es la columna 'S' (Salida)
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC7CE" } }; // Rojo claro
            } else if (includeDispatchColumn && currentDayColIndex === (1 + dynamicPermColumnsPerDay)) { // Es la columna 'D' (Despacho)
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEB9C" } }; // Amarillo claro
            } else { // Permisos
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: subHeaderBgColor } }; // Gris claro
            }
        }
      });
      worksheet.getRow(4).height = 25;

      // Prepare data rows (desde la Fila 5 en adelante)
      const tableData = activeEmployees.map((employee, empIndex) => {
        const rowData = [empIndex + 1, employee.employeeID, employee.employeeName];
        
        const weekComments = []; // Recopilar comentarios de toda la semana para este empleado
        
        daysOfWeek.forEach((day) => {
          const record = sanitizedWeeklyAttendance.find((att) => att.employeeID === employee.employeeID && att.date === day.date) || {};
          
          rowData.push(record.entryTime || "-"); // Entrada
          
          for(let i = 1; i <= maxPermsInWeek; i++){
            rowData.push(record[`permissionExitTime${i}`] || "-"); // Permiso de Salida
            rowData.push(record[`permissionEntryTime${i}`] || "-"); // Permiso de Entrada
          }

          if (includeDispatchColumn) {
            rowData.push(record.dispatchingTime || "-"); // Despacho
          }
          rowData.push(record.exitTime || "-"); // Salida (esta va al final de las columnas del día)
          
          // Recopilar comentarios de este día (hasta 5 permisos para comentarios)
          const dayComments = [];
          for (let i = 1; i <= 5; i++) { 
            if (record[`permissionExitComment${i}`]) {
              dayComments.push(`${day.dayName.substring(0, 3)} P${i}S: ${record[`permissionExitComment${i}`]}`); // Abreviar día
            }
            if (record[`permissionEntryComment${i}`]) {
              dayComments.push(`${day.dayName.substring(0, 3)} P${i}E: ${record[`permissionEntryComment${i}`]}`); // Abreviar día
            }
          }
          if (record.exitComment) {
            dayComments.push(`${day.dayName.substring(0, 3)} Salida: ${record.exitComment}`);
          }
          if (record.dispatchingComment) {
            dayComments.push(`${day.dayName.substring(0, 3)} Despacho: ${record.dispatchingComment}`);
          }
          
          weekComments.push(...dayComments);
        });
        
        // Agregar todos los comentarios de la semana al final
        rowData.push(weekComments.join(" | ") || "");
        
        return rowData;
      });

      // Add data to worksheet
      tableData.forEach((row) => worksheet.addRow(row));

      // Style data rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 4) { // Las filas de datos comienzan desde la fila 5 (después de título, subtítulo, encabezados de día y subencabezados)
          row.eachCell((cell) => {
            cell.font = { name: "Calibri", size: 11 };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = {
              top: { style: "thin", color: { argb: "000000" } },
              bottom: { style: "thin", color: { argb: "000000" } },
              left: { style: "thin", color: { argb: "000000" } },
              right: { style: "thin", color: { argb: "000000" } },
            };
            // Rayas para alternar el color de fondo de las filas de datos
            row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber % 2 === 1 ? "F5F5F5" : "FFFFFF" } };
          });
          row.height = 20;
        }
      });

      // Set column widths dynamically
      const columnWidthsDefinition = [
        { width: 10 }, // Correlativo
        { width: 10 }, // Código
        { width: 30 }, // Empleado
      ];
      // Anchos para las columnas de datos por día (Entrada, Permisos (S/E), Despacho (opcional), Salida)
      for(let i = 0; i < daysOfWeek.length; i++){
          columnWidthsDefinition.push({ width: 12 }); // Entrada
          for(let j = 1; j <= maxPermsInWeek; j++){
              columnWidthsDefinition.push({ width: 12 }); // Permiso S
              columnWidthsDefinition.push({ width: 12 }); // Permiso E
          }
          if(includeDispatchColumn){
              columnWidthsDefinition.push({ width: 12 }); // Despacho
          }
          columnWidthsDefinition.push({ width: 12 }); // Salida
      }
      columnWidthsDefinition.push({ width: 50 }); // Comentarios (columna más ancha)

      worksheet.columns = columnWidthsDefinition;

      // Generar archivo Excel
      const excelBuffer = await workbook.xlsx.writeBuffer();
      const filename = `asistencia_semanal_semana${selectedWeek}_${year}.xlsx`;

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(excelBuffer);
    } catch (error) {
      console.error("Error al exportar asistencia semanal:", error.stack || error.message);
      res.status(500).send({ message: `Error interno del servidor al generar el archivo Excel: ${error.message}` });
    }
  };
  
// Controlador para exportar asistencia semanal con fechas automáticas
exports.exportWeeklyAttendanceAuto = async (req, res) => {
    try {
      // Calcular la semana anterior automáticamente
      const currentDate = dayjs().tz("America/Tegucigalpa");
      const startOfWeek = currentDate.subtract(1, 'week').startOf("isoWeek").format("YYYY-MM-DD"); // Lunes de la semana anterior
      const endOfWeek = currentDate.subtract(1, 'week').endOf("isoWeek").format("YYYY-MM-DD"); // Domingo de la semana anterior

      // Obtener datos de asistencia para la semana anterior
      const attendanceQuery = `
        SELECT 
          h.hattendanceID,
          h.employeeID,
          CONCAT(e.firstName, ' ', COALESCE(e.middleName, ''), ' ', e.lastName) AS employeeName,
          DATE_FORMAT(h.entryTime, '%h:%i:%s %p') AS entryTime,
          DATE_FORMAT(h.exitTime, '%h:%i:%s %p') AS exitTime,
          DATE_FORMAT(h.date, '%Y-%m-%d') AS date,
          h.exitComment -- Incluir exitComment aquí
        FROM 
          h_attendance_emp h
        JOIN 
          employees_emp e ON h.employeeID = e.employeeID
        WHERE 
          h.date BETWEEN ? AND ?
          AND e.isActive = 1
        ORDER BY h.employeeID, h.date DESC
      `;

      const [attendanceRows] = await db.query(attendanceQuery, [startOfWeek, endOfWeek]);
      
      const processedRows = [];
      
      for (const attendanceRecord of attendanceRows) {
        const permissionQuery = `
          SELECT 
            permissionID,
            DATE_FORMAT(exitPermission, '%h:%i:%s %p') AS exitPermissionTime,
            DATE_FORMAT(entryPermission, '%h:%i:%s %p') AS entryPermissionTime,
            comment
          FROM 
            permissionattendance_emp
          WHERE 
            employeeID = ? 
            AND DATE(date) = ?
            AND (exitPermission IS NOT NULL OR entryPermission IS NOT NULL)
          ORDER BY 
            permissionID ASC
          LIMIT 5
        `;
        
        const [permissionRows] = await db.query(permissionQuery, [
          attendanceRecord.employeeID, 
          attendanceRecord.date
        ]);

        const dispatchingQuery = `
          SELECT 
            DATE_FORMAT(exitTimeComplete, '%h:%i:%s %p') AS dispatchingTime,
            CASE WHEN comment = 1 THEN 'Meta' ELSE '' END AS dispatchingComment
          FROM 
          dispatching_emp
          WHERE 
            employeeID = ? 
            AND DATE(date) = ?
          LIMIT 1
        `;

        const [dispatchingRows] = await db.query(dispatchingQuery, [
          attendanceRecord.employeeID,
          attendanceRecord.date
        ]);
        
        const processedRecord = { ...attendanceRecord };
        
        permissionRows.forEach((permission, index) => {
          const permissionNumber = index + 1;
          if (permission.exitPermissionTime) {
            processedRecord[`permissionExitTime${permissionNumber}`] = permission.exitPermissionTime;
            processedRecord[`permissionExitComment${permissionNumber}`] = permission.comment || '';
          }
          if (permission.entryPermissionTime) {
            processedRecord[`permissionEntryTime${permissionNumber}`] = permission.entryPermissionTime;
            processedRecord[`permissionEntryComment${permissionNumber}`] = permission.comment || '';
          }
        });
        
        if (dispatchingRows.length > 0) {
          processedRecord.dispatchingTime = dispatchingRows[0].dispatchingTime;
          processedRecord.dispatchingComment = dispatchingRows[0].dispatchingComment;
        }
        
        processedRows.push(processedRecord);
      }

      // Usar el controlador de exportación semanal existente con los datos obtenidos
      const weekNumber = currentDate.subtract(1, 'week').isoWeek();
      const monthNumber = currentDate.subtract(1, 'week').month();
      
      const reqBody = {
        body: {
          weeklyAttendance: processedRows,
          selectedMonth: monthNumber.toString(),
          selectedWeek: weekNumber.toString()
        }
      };

      // Llamar al controlador de exportación semanal
      await exports.exportWeeklyAttendance(reqBody, res);

    } catch (error) {
      console.error("Error al exportar asistencia semanal automática:", error.stack || error.message);
      res.status(500).send({ message: `Error interno del servidor al generar el archivo Excel: ${error.message}` });
    }
  };