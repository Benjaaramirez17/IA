// ============================================================
//  L94 DATA SYNC - Google Apps Script
//  Carpeta fuente : 1L-M7C9obiUA897-gFNof_6AQZ9Z02hwK
//  Sheet destino  : 1w3i-sKKGMc2dh_7Nx8vWrUC-tgrMaOcbVQ7-6hUXcs8
// ============================================================

var FOLDER_ID   = '1L-M7C9obiUA897-gFNof_6AQZ9Z02hwK';
var SHEET_ID    = '1w3i-sKKGMc2dh_7Nx8vWrUC-tgrMaOcbVQ7-6hUXcs8';
var LOCAL_VALUE = '94';          // valor a filtrar en columna LOCAL
var HOJA_HOY    = 'L94_Hoy';
var HOJA_HIST   = 'Histórico';
var HORA_ARCHIVO = 23;           // hora en que se archiva (23:00)

// ----------------------------------------------------------
// FUNCIÓN PRINCIPAL: sincronizar data de L94
// Ejecutar cada 30 min vía trigger
// ----------------------------------------------------------
function syncL94() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var csv    = obtenerCSVMasReciente(folder);

  if (!csv) {
    Logger.log('No se encontraron archivos CSV en la carpeta.');
    return;
  }

  var contenido = csv.getBlob().getDataAsString('UTF-8');
  var filas     = parsearCSV(contenido);

  if (filas.length < 2) {
    Logger.log('CSV vacío o sin datos.');
    return;
  }

  var encabezado  = filas[0];
  var idxLocal    = encabezado.findIndex(function(c) {
    return c.trim().toUpperCase() === 'LOCAL';
  });

  if (idxLocal === -1) {
    Logger.log('No se encontró columna LOCAL en el CSV.');
    return;
  }

  // Filtrar solo filas de LOCAL = 94
  var filtradas = filas.filter(function(fila, i) {
    if (i === 0) return true; // mantener encabezado
    return String(fila[idxLocal]).trim() === LOCAL_VALUE;
  });

  if (filtradas.length < 2) {
    Logger.log('No hay datos para LOCAL ' + LOCAL_VALUE);
    return;
  }

  // Escribir en hoja L94_Hoy (sobrescribir)
  var ss   = SpreadsheetApp.openById(SHEET_ID);
  var hoja = obtenerOCrearHoja(ss, HOJA_HOY);

  // Normalizar todas las filas al mismo número de columnas
  var numCols = filtradas[0].length;
  filtradas = filtradas.map(function(fila) {
    while (fila.length < numCols) fila.push('');
    return fila.slice(0, numCols);
  });

  hoja.clearContents();
  hoja.getRange(1, 1, filtradas.length, numCols).setValues(filtradas);

  // Dar formato de tabla legible
  var rangoEnc = hoja.getRange(1, 1, 1, filtradas[0].length);
  rangoEnc.setFontWeight('bold');
  rangoEnc.setBackground('#1a73e8');
  rangoEnc.setFontColor('#ffffff');
  hoja.setFrozenRows(1);
  hoja.autoResizeColumns(1, filtradas[0].length);

  Logger.log('Sincronizado: ' + (filtradas.length - 1) + ' filas de LOCAL ' + LOCAL_VALUE + ' desde ' + csv.getName());
}

// ----------------------------------------------------------
// FUNCIÓN DE ARCHIVO: copiar L94_Hoy → Histórico
// Ejecutar a las 22:00 vía trigger
// ----------------------------------------------------------
function archivarEnHistorico() {
  var ss      = SpreadsheetApp.openById(SHEET_ID);
  var hojaHoy = ss.getSheetByName(HOJA_HOY);

  if (!hojaHoy) {
    Logger.log('Hoja ' + HOJA_HOY + ' no existe. Ejecute syncL94() primero.');
    return;
  }

  var datos = hojaHoy.getDataRange().getValues();
  if (datos.length < 2) {
    Logger.log('No hay datos en ' + HOJA_HOY + ' para archivar.');
    return;
  }

  var hist = obtenerOCrearHoja(ss, HOJA_HIST);

  // Si el histórico está vacío, agregar encabezado con columna extra FECHA
  if (hist.getLastRow() === 0) {
    var encFecha = ['FECHA_ARCHIVO'].concat(datos[0]);
    hist.appendRow(encFecha);
    var rangoEnc = hist.getRange(1, 1, 1, encFecha.length);
    rangoEnc.setFontWeight('bold');
    rangoEnc.setBackground('#0f9d58');
    rangoEnc.setFontColor('#ffffff');
    hist.setFrozenRows(1);
  }

  // Agregar filas de datos con fecha de hoy
  var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  for (var i = 1; i < datos.length; i++) {
    hist.appendRow([hoy].concat(datos[i]));
  }

  hist.autoResizeColumns(1, hist.getLastColumn());
  Logger.log('Archivado: ' + (datos.length - 1) + ' filas en ' + HOJA_HIST + ' con fecha ' + hoy);
}

// ----------------------------------------------------------
// CONFIGURAR TRIGGERS (ejecutar UNA sola vez)
// ----------------------------------------------------------
function configurarTriggers() {
  // Eliminar triggers anteriores para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // Trigger cada 30 minutos para syncL94
  ScriptApp.newTrigger('syncL94')
    .timeBased()
    .everyMinutes(30)
    .create();

  // Trigger a las 22:00 para archivar
  ScriptApp.newTrigger('archivarEnHistorico')
    .timeBased()
    .atHour(HORA_ARCHIVO)
    .everyDays(1)
    .create();

  Logger.log('Triggers configurados: syncL94 cada 30 min | archivarEnHistorico a las 22:00');
}

// ----------------------------------------------------------
// HELPERS
// ----------------------------------------------------------

// Retorna el archivo CSV más reciente en la carpeta
function obtenerCSVMasReciente(folder) {
  var archivos = folder.getFilesByType('text/csv');
  var masReciente = null;
  var fechaMax    = new Date(0);

  while (archivos.hasNext()) {
    var f = archivos.next();
    if (f.getDateCreated() > fechaMax) {
      fechaMax    = f.getDateCreated();
      masReciente = f;
    }
  }
  return masReciente;
}

// Parser CSV robusto (maneja campos con comas dentro de comillas)
function parsearCSV(texto) {
  var filas    = [];
  var lineas   = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  lineas.forEach(function(linea) {
    if (linea.trim() === '') return;
    filas.push(parsearLineaCSV(linea));
  });

  return filas;
}

function parsearLineaCSV(linea) {
  var campos  = [];
  var campo   = '';
  var enComillas = false;

  for (var i = 0; i < linea.length; i++) {
    var c = linea[i];
    if (c === '"') {
      if (enComillas && linea[i + 1] === '"') {
        campo += '"';
        i++;
      } else {
        enComillas = !enComillas;
      }
    } else if (c === ',' && !enComillas) {
      campos.push(campo.trim());
      campo = '';
    } else {
      campo += c;
    }
  }
  campos.push(campo.trim());
  return campos;
}

// Obtiene una hoja por nombre, la crea si no existe
function obtenerOCrearHoja(ss, nombre) {
  var hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
  }
  return hoja;
}

// ----------------------------------------------------------
// UTILIDAD: ver estructura del CSV (debug)
// ----------------------------------------------------------
function inspeccionarCSV() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var csv    = obtenerCSVMasReciente(folder);

  if (!csv) { Logger.log('Sin CSV'); return; }

  var contenido = csv.getBlob().getDataAsString('UTF-8');
  var filas     = parsearCSV(contenido);

  Logger.log('Archivo: ' + csv.getName());
  Logger.log('Encabezado: ' + JSON.stringify(filas[0]));
  Logger.log('Primera fila de datos: ' + JSON.stringify(filas[1]));
  Logger.log('Total filas: ' + filas.length);
}
