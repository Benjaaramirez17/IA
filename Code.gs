// ==============================================
// VARIABLES DE ENTORNO
// ==============================================

// 1. Atrasos
const SPREADSHEET_ID      = '1fQGVZtfEFMdzOmEP-7A6Cz386tp-BLexAOYHrnWOjE8';
const SHEET_NAME          = 'Atrasos V3';

// 2. Ingresos
const INGRESOS_SPREADSHEET_ID = '1O2xpCr8RAqc3QUMeU6Wz1FUbJ-p2Q_bOXwOUCK7gLmE';
const INGRESOS_SHEET_NAME     = 'INGRESOS';

// 4. Reclamos
const RECLAMOS_SPREADSHEET_ID = '1xASIOO90c6aMBQgKzogNGK7eso1-mEkCn5AGtACDmog';
const RECLAMOS_SHEET_NAME     = '94';

// 5. Pagos Extra
const PAGOS_SPREADSHEET_ID = '1RZFu7fvNoyu7mr2SLwLhD7aYBHnF0GhAmF-JVEoyhLI';
const PAGOS_SHEET_NAME     = 'Pagos extra';

// 6. Indicadores
const INDICADORES_SPREADSHEET_ID = '1SpQH5HsR_Ghp6UqCg1Q2xsfgaD0PsHeRiAjU8sgn0H0';
const INDICADORES_SHEET_NAME     = 'Historico';
// 6b. LAT Hoy (vive en la misma planilla de Indicadores)
const LATHOY_SHEET_NAME          = 'LAT Hoy';

// 7. Activación / Asistencia Shoppers
const ACTIVACION_SPREADSHEET_ID = '1RZFu7fvNoyu7mr2SLwLhD7aYBHnF0GhAmF-JVEoyhLI';
const SHOPPER_SHEET_NAME        = 'Shopper';
const ASISTENCIA_SHEET_NAME     = 'Asistencia';

// 8. Flejes
const FLEJES_SPREADSHEET_ID = '1RZFu7fvNoyu7mr2SLwLhD7aYBHnF0GhAmF-JVEoyhLI';
const FLEJES_SHEET_NAME     = 'hist.flejes';
const FLEJES_FOLDER_ID = '1p_e9JqVQx9TE9nk1abhAMDctyZh4k2Nx';

// 9. Pendientes de Cierre (L94_Hoy)
const PENDIENTES_CIERRE_SPREADSHEET_ID = '1w3i-sKKGMc2dh_7Nx8vWrUC-tgrMaOcbVQ7-6hUXcs8';
const PENDIENTES_CIERRE_GID            = 561516213;

// ==============================================
// ⚡ CAPA DE CACHÉ (CacheService)
// ==============================================

const CACHE_TTL = 300;
const _CHUNK    = 90000;

function _cachePut(key, obj, ttl) {
  try {
    const s = JSON.stringify(obj);
    const cache = CacheService.getScriptCache();
    const payload = {};
    let n = 0;
    for (let i = 0; i < s.length; i += _CHUNK) {
      payload[key + '_' + n] = s.substr(i, _CHUNK);
      n++;
    }
    payload[key + '_n'] = String(n);
    cache.putAll(payload, ttl || CACHE_TTL);
  } catch (e) {}
}

function _cacheGet(key) {
  try {
    const cache = CacheService.getScriptCache();
    const n = cache.get(key + '_n');
    if (!n) return null;
    const keys = [];
    for (let i = 0; i < +n; i++) keys.push(key + '_' + i);
    const parts = cache.getAll(keys);
    let s = '';
    for (let i = 0; i < +n; i++) {
      const p = parts[key + '_' + i];
      if (p == null) return null;
      s += p;
    }
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function _cacheClear(key) {
  try {
    const cache = CacheService.getScriptCache();
    const n = cache.get(key + '_n');
    const keys = [key + '_n'];
    if (n) for (let i = 0; i < +n; i++) keys.push(key + '_' + i);
    cache.removeAll(keys);
  } catch (e) {}
}

function clearAllCaches() {
  ['atrasos', 'ingresos', 'reclamos', 'pagos', 'indicadores', 'asistStats', 'lathoy', 'flejes', 'pendientes_cierre']
    .forEach(_cacheClear);
  const tz = Session.getScriptTimeZone();
  for (let d = -3; d <= 3; d++) {
    const dt = new Date(); dt.setDate(dt.getDate() + d);
    _cacheClear('activ_' + Utilities.formatDate(dt, tz, 'yyyy-MM-dd'));
  }
  return true;
}


// ==============================================
// ENTRY POINT
// ==============================================
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Hub del Coordinador - Local 94')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ==============================================
// MÓDULO 1: ATRASOS  (con caché)
// ==============================================
function getInitialData(force) {
  if (!force) {
    const cached = _cacheGet('atrasos');
    if (cached) return cached;
  }
  const result = _getInitialDataRaw();
  _cachePut('atrasos', result);
  return result;
}

function _getInitialDataRaw() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return { justificacionOptions: [], pendingAtrasos: [], statsData: [] };

  const data = sheet.getRange(3, 1, lastRow - 2, 12).getValues();
  const tz   = Session.getScriptTimeZone();

  const validationRule = sheet.getRange('F3').getDataValidation();
  let justificacionOptions = [];

  if (validationRule != null) {
    if (validationRule.getCriteriaType() == SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      justificacionOptions = validationRule.getCriteriaValues()[0];
    } else if (validationRule.getCriteriaType() == SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
      justificacionOptions = validationRule.getCriteriaValues()[0].getValues().flat().filter(String);
    }
  }

  if (justificacionOptions.length === 0) {
    justificacionOptions = [...new Set(data.map(r => r[5]))].filter(String);
  }

  let pendingAtrasos = [];
  let statsData      = [];

  data.forEach((row, index) => {
    if (String(row[10]).includes('94') || String(row[1]).includes('94')) {
      const isPending = !row[5] || String(row[5]).trim() === '';
      const item = {
        rowNumber:      index + 3,
        fecha:          row[0] instanceof Date
                          ? Utilities.formatDate(row[0], tz, 'dd/MM/yyyy')
                          : row[0],
        ventana:        row[2] || 'S/V',
        sg:             row[3],
        nombre:         row[4] || 'Desconocido',
        justificacion:  row[5],
        observacion:    row[6],
        semana:         row[7],
        mes:            row[8],
        anio:           row[9],
        responsabilidad: row[11] || 'Sin Asignar'
      };

      if (isPending) pendingAtrasos.push(item);
      statsData.push(item);
    }
  });

  return {
    justificacionOptions: justificacionOptions,
    pendingAtrasos:       pendingAtrasos,
    statsData:            statsData
  };
}

function updateAtraso(rowNumber, justificacion, observacion) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  sheet.getRange(rowNumber, 6, 1, 2).setValues([[justificacion, observacion]]);
  _cacheClear('atrasos');
  return true;
}

// ==============================================
// MÓDULO 3: INGRESOS  (con caché)
// ==============================================
function getIngresosData(force) {
  try {
    if (!force) {
      const cached = _cacheGet('ingresos');
      if (cached) return cached;
    }
    const ss      = SpreadsheetApp.openById(INGRESOS_SPREADSHEET_ID);
    const sheet   = ss.getSheetByName(INGRESOS_SHEET_NAME);
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) return [];

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data    = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const tz      = Session.getScriptTimeZone();

    const idxLocal    = headers.indexOf('Local');
    const idxFecha    = headers.indexOf('Fecha de Inducción');
    const idxEstado   = headers.indexOf('Estado de inducción');
    const idxNombre   = headers.indexOf('Nombre');
    const idxRut      = headers.indexOf('Rut');
    const idxServicio = headers.indexOf('Servicio');
    const idxTelefono = headers.indexOf('Teléfono');
    const idxBolso    = headers.indexOf('ENTREGA BOLSO');

    let ingresosL94 = [];

    data.forEach(row => {
      const localStr = String(row[idxLocal] || '');
      if (localStr.includes('94') || localStr.includes('L94')) {
        let fechaObj = row[idxFecha];
        let fechaFormateada = fechaObj;
        let semana = '';
        let anio   = '';
        if (fechaObj instanceof Date) {
          fechaFormateada = Utilities.formatDate(fechaObj, tz, 'dd/MM/yyyy');
          semana = getISOWeek(fechaObj);
          anio   = fechaObj.getFullYear();
        }

        ingresosL94.push({
          fecha:          fechaFormateada || '-',
          servicio:       row[idxServicio] || '-',
          rut:            row[idxRut]      || '-',
          nombre:         row[idxNombre]   || 'Desconocido',
          estadoInduccion: String(row[idxEstado] || 'Sin Estado').trim(),
          bolso:          row[idxBolso]    || 'No',
          telefono:       row[idxTelefono] || '-',
          semana:         semana,
          anio:           anio
        });
      }
    });

    _cachePut('ingresos', ingresosL94);
    return ingresosL94;
  } catch (error) {
    return { error: error.toString() };
  }
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ==============================================
// MÓDULO 4: RECLAMOS  (con caché)
// ==============================================

function _normHeader(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function _findCol(headers, aliases) {
  var normed = headers.map(_normHeader);
  for (var a = 0; a < aliases.length; a++) {
    var i = normed.indexOf(_normHeader(aliases[a]));
    if (i !== -1) return i;
  }
  for (var a2 = 0; a2 < aliases.length; a2++) {
    var t2 = _normHeader(aliases[a2]);
    for (var h = 0; h < normed.length; h++) {
      if (normed[h] && normed[h].indexOf(t2) !== -1) return h;
    }
  }
  return -1;
}

function getReclamosData(force) {
  try {
    if (!force) {
      const cached = _cacheGet('reclamos');
      if (cached) return cached;
    }
    const ss      = SpreadsheetApp.openById(RECLAMOS_SPREADSHEET_ID);
    const sheet   = ss.getSheetByName(RECLAMOS_SHEET_NAME);
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) return [];

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data    = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const tz      = Session.getScriptTimeZone();

    const idxFecha      = _findCol(headers, ['Fecha']);
    const idxSg         = _findCol(headers, ['Numero SG', 'N° SG', 'SG', 'Nro SG']);
    const idxCausa      = _findCol(headers, ['Causa']);
    const idxDesc       = _findCol(headers, ['Descripcion', 'Descripción', 'Detalle']);
    const idxShopper    = _findCol(headers, ['Nombre shopper', 'Shopper', 'Nombre']);
    const idxAplica     = _findCol(headers, ['Aplica/No aplica', 'Aplica / No aplica', 'Aplica']);
    const idxAccion     = _findCol(headers, ['Accion', 'Acción', 'Medida']);
    const idxComentario = _findCol(headers, ['Comentario', 'Comentarios', 'Observacion']);

    function getCell(row, idx) {
      return idx === -1 ? '' : String(row[idx] || '').trim();
    }

    let reclamos = [];

    data.forEach((row, index) => {
      const sgRaw      = getCell(row, idxSg);
      const causaRaw   = getCell(row, idxCausa);
      const descRaw    = getCell(row, idxDesc);
      const shopperRaw = getCell(row, idxShopper);
      const aplicaRaw  = getCell(row, idxAplica);
      const accionRaw  = getCell(row, idxAccion);
      const comentRaw  = getCell(row, idxComentario);
      const fechaRaw   = idxFecha === -1 ? '' : row[idxFecha];
      const fechaTxt   = (fechaRaw instanceof Date) ? 'x' : String(fechaRaw || '').trim();

      if (!fechaTxt && !sgRaw && !causaRaw && !descRaw && !shopperRaw &&
          !aplicaRaw && !accionRaw && !comentRaw) return;

      let fechaFormateada = fechaRaw;
      let semana = '', anio = '', fechaISO = '';
      if (fechaRaw instanceof Date) {
        fechaFormateada = Utilities.formatDate(fechaRaw, tz, 'dd/MM/yyyy');
        fechaISO        = Utilities.formatDate(fechaRaw, tz, 'yyyy-MM-dd');
        semana          = getISOWeek(fechaRaw);
        anio            = fechaRaw.getFullYear();
      } else if (fechaTxt) {
        fechaFormateada = fechaTxt;
        var m = fechaTxt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          var yy = m[3].length === 2 ? '20' + m[3] : m[3];
          fechaISO = yy + '-' + ('0'+m[2]).slice(-2) + '-' + ('0'+m[1]).slice(-2);
          anio = parseInt(yy);
        }
      }

      reclamos.push({
        rowNumber:   index + 2,
        fecha:       fechaFormateada || '-',
        fechaISO:    fechaISO,
        sg:          sgRaw      || '-',
        causa:       causaRaw   || '-',
        descripcion: descRaw    || '-',
        shopper:     shopperRaw || 'Desconocido',
        aplica:      aplicaRaw,
        accion:      accionRaw,
        comentario:  comentRaw,
        semana:      semana,
        anio:        anio
      });
    });

    _cachePut('reclamos', reclamos);
    return reclamos;
  } catch (error) {
    return { error: error.toString() };
  }
}

function updateReclamo(rowNumber, aplica, accion, comentario) {
  try {
    const ss      = SpreadsheetApp.openById(RECLAMOS_SPREADSHEET_ID);
    const sheet   = ss.getSheetByName(RECLAMOS_SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const idxAplica     = _findCol(headers, ['Aplica/No aplica', 'Aplica / No aplica', 'Aplica']) + 1;
    const idxAccion     = _findCol(headers, ['Accion', 'Acción', 'Medida']) + 1;
    const idxComentario = _findCol(headers, ['Comentario', 'Comentarios', 'Observacion']) + 1;

    if (idxAplica > 0 && idxAccion === idxAplica + 1 && idxComentario === idxAccion + 1) {
      sheet.getRange(rowNumber, idxAplica, 1, 3).setValues([[aplica, accion, comentario]]);
    } else {
      if (idxAplica > 0)     sheet.getRange(rowNumber, idxAplica).setValue(aplica);
      if (idxAccion > 0)     sheet.getRange(rowNumber, idxAccion).setValue(accion);
      if (idxComentario > 0) sheet.getRange(rowNumber, idxComentario).setValue(comentario);
    }
    _cacheClear('reclamos');
    return true;
  } catch (error) {
    throw new Error('Error al guardar en Google Sheets: ' + error.toString());
  }
}

// ==============================================
// MÓDULO 5: PAGOS EXTRA  (con caché)
// ==============================================
function getPagosExtraData(force) {
  try {
    if (!force) {
      const cached = _cacheGet('pagos');
      if (cached) return cached;
    }
    const ss    = SpreadsheetApp.openById(PAGOS_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(PAGOS_SHEET_NAME);

    if (!sheet) return { error: 'No se encontró la pestaña "' + PAGOS_SHEET_NAME + '"' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const data   = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const result = [];

    data.forEach((row, index) => {
      if (!row[0] && !row[1] && !row[3]) return;

      let fechaStr = row[2];
      if (fechaStr instanceof Date) {
        const dd   = String(fechaStr.getDate()).padStart(2, '0');
        const mm   = String(fechaStr.getMonth() + 1).padStart(2, '0');
        const yyyy = fechaStr.getFullYear();
        fechaStr   = dd + '-' + mm + '-' + yyyy;
      }

      result.push({
        rowNumber: index + 2,
        rut:       String(row[0] || '').trim(),
        local:     String(row[1] || '').trim(),
        fecha:     fechaStr || '-',
        apoyo:     String(row[3] || '').trim(),
        monto:     parseFloat(row[4]) || 0,
        estado:    String(row[5] || 'Pendiente').trim() || 'Pendiente'
      });
    });

    const out = result.reverse();
    _cachePut('pagos', out);
    return out;
  } catch (error) {
    return { error: error.toString() };
  }
}

function addPagoExtra(rut, local, fecha, apoyo, monto) {
  try {
    const ss    = SpreadsheetApp.openById(PAGOS_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(PAGOS_SHEET_NAME);

    if (!sheet) throw new Error('No se encontró la pestaña "' + PAGOS_SHEET_NAME + '"');

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['RUT', 'Local', 'FECHA (día-mes-año)', 'Apoyo', 'Monto', 'Estado']);
    }

    const newRow = sheet.getLastRow() + 1;
    sheet.appendRow([rut, local, fecha, apoyo, monto, 'Pendiente']);
    _cacheClear('pagos');
    return newRow;
  } catch (error) {
    throw new Error('Error al escribir en Google Sheets: ' + error.toString());
  }
}

function updateEstadoPagoExtra(rowNumber, nuevoEstado) {
  try {
    const ss    = SpreadsheetApp.openById(PAGOS_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(PAGOS_SHEET_NAME);

    if (!sheet) throw new Error('No se encontró la pestaña "' + PAGOS_SHEET_NAME + '"');

    sheet.getRange(rowNumber, 6).setValue(nuevoEstado);
    _cacheClear('pagos');
    return true;
  } catch (error) {
    throw new Error('Error al actualizar estado: ' + error.toString());
  }
}

// ==============================================
// MÓDULO 6: INDICADORES  (con caché)
// ==============================================
function getIndicadoresData(force) {
  try {
    if (!force) {
      const cached = _cacheGet('indicadores');
      if (cached) return cached;
    }
    const ss      = SpreadsheetApp.openById(INDICADORES_SPREADSHEET_ID);
    const sheet   = ss.getSheetByName(INDICADORES_SHEET_NAME);
    if (!sheet) return { error: 'No se encontró la hoja "' + INDICADORES_SHEET_NAME + '"' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data    = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    const tz      = Session.getScriptTimeZone();

    const idxFecha     = headers.findIndex(h => String(h).trim().toLowerCase() === 'fecha');
    const idxLocal     = headers.findIndex(h => String(h).trim().toLowerCase() === 'local');
    const idxIndicador = headers.findIndex(h => String(h).trim().toLowerCase() === 'indicador');
    const idxHora      = headers.findIndex(h => String(h).trim().toLowerCase() === 'hora');
    const idxValor     = headers.findIndex(h => String(h).trim().toLowerCase() === 'valor');
    const idxAnio      = headers.findIndex(h => String(h).trim().toLowerCase() === 'año');
    const idxSemana    = headers.findIndex(h => String(h).trim().toLowerCase() === 'semana');

    const result = [];

    data.forEach(row => {
      const localStr = String(row[idxLocal] || '').trim();
      if (!localStr.includes('94')) return;

      let fechaStr = row[idxFecha];
      if (fechaStr instanceof Date) {
        fechaStr = Utilities.formatDate(fechaStr, tz, 'yyyy-MM-dd');
      } else {
        fechaStr = String(fechaStr || '').trim();
      }

      if (!fechaStr) return;

      const valorRaw = row[idxValor];
      let valor = 0;
      if (typeof valorRaw === 'number') {
        valor = valorRaw;
      } else {
        const cleaned = String(valorRaw || '').replace('%', '').replace(',', '.').trim();
        valor = parseFloat(cleaned) || 0;
      }

      result.push({
        fecha:     fechaStr,
        local:     localStr,
        indicador: String(row[idxIndicador] || '').trim(),
        hora:      String(row[idxHora]      || '').trim(),
        valor:     valor,
        anio:      row[idxAnio]   || '',
        semana:    row[idxSemana] || ''
      });
    });

    _cachePut('indicadores', result);
    return result;
  } catch (error) {
    return { error: error.toString() };
  }
}

// ==============================================
// MÓDULO 6b: LAT HOY
// ==============================================
function getLatHoyData(force) {
  try {
    if (!force) {
      const cached = _cacheGet('lathoy');
      if (cached) return cached;
    }
    const ss    = SpreadsheetApp.openById(INDICADORES_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LATHOY_SHEET_NAME);
    if (!sheet) return { error: 'No se encontró la hoja "' + LATHOY_SHEET_NAME + '"' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { actualizacion: '', ventanas: [] };

    const lastCol = Math.max(sheet.getLastColumn(), 11);
    const values  = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = values[0];
    const tz      = Session.getScriptTimeZone();

    let actualizacion = values[1][10];
    if (actualizacion instanceof Date) {
      actualizacion = Utilities.formatDate(actualizacion, tz, 'dd/MM/yyyy HH:mm');
    } else {
      actualizacion = String(actualizacion || '').trim();
    }

    const idxFecha = _findCol(headers, ['Fecha Data', 'Fecha']);
    const idxSala  = _findCol(headers, ['Sala']);
    const idxZona  = _findCol(headers, ['Zona despacho', 'Zona']);
    const idxVent  = _findCol(headers, ['Ventana']);
    const idxVenta = _findCol(headers, ['Venta']);
    const idxOfer  = _findCol(headers, ['Ofertado']);
    const idxOcup  = _findCol(headers, ['Ocupación', 'Ocupacion']);

    const ventanas = [];
    for (let r = 1; r < values.length; r++) {
      const row  = values[r];
      const sala = String(idxSala === -1 ? '' : (row[idxSala] || '')).trim();
      if (!sala.includes('94')) continue;

      let fecha = idxFecha === -1 ? '' : row[idxFecha];
      if (fecha instanceof Date) fecha = Utilities.formatDate(fecha, tz, 'dd/MM/yyyy');

      let ocup = idxOcup === -1 ? 0 : row[idxOcup];
      if (typeof ocup !== 'number') {
        ocup = parseFloat(String(ocup || '').replace('%', '').replace(',', '.')) || 0;
      }
      const pct = ocup <= 1.5 ? ocup * 100 : ocup;

      ventanas.push({
        fecha:     String(fecha || '-'),
        sala:      sala,
        zona:      idxZona === -1 ? '-' : String(row[idxZona] || '-'),
        ventana:   idxVent === -1 ? '-' : String(row[idxVent] || '-'),
        venta:     Number(idxVenta === -1 ? 0 : row[idxVenta]) || 0,
        ofertado:  Number(idxOfer  === -1 ? 0 : row[idxOfer])  || 0,
        ocupacion: +pct.toFixed(1)
      });
    }

    const result = { actualizacion: actualizacion, ventanas: ventanas };
    _cachePut('lathoy', result, 60);
    return result;
  } catch (error) {
    return { error: error.toString() };
  }
}

// ==============================================
// MÓDULO 7: ACTIVACIÓN / ASISTENCIA DE SHOPPERS
// ==============================================

function _activParseHeaderDate(cell, fallbackYear) {
  if (cell instanceof Date) {
    return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(cell || '').trim();
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    var d = ('0' + m[1]).slice(-2);
    var mo = ('0' + m[2]).slice(-2);
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + mo + '-' + d;
  }
  var m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    var d2 = ('0' + m2[1]).slice(-2);
    var mo2 = ('0' + m2[2]).slice(-2);
    return (fallbackYear || new Date().getFullYear()) + '-' + mo2 + '-' + d2;
  }
  return null;
}

function _activGetSheets() {
  var ss = SpreadsheetApp.openById(ACTIVACION_SPREADSHEET_ID);
  var shopperSheet = ss.getSheetByName(SHOPPER_SHEET_NAME);
  if (!shopperSheet) throw new Error('No se encontró la hoja "' + SHOPPER_SHEET_NAME + '"');

  var asistSheet = ss.getSheetByName(ASISTENCIA_SHEET_NAME);
  if (!asistSheet) {
    asistSheet = ss.insertSheet(ASISTENCIA_SHEET_NAME);
    asistSheet.appendRow(['RUT', 'Nombre']);
  }
  return { ss: ss, shopperSheet: shopperSheet, asistSheet: asistSheet };
}

function _activReadAsistencia(asistSheet) {
  var lastRow = asistSheet.getLastRow();
  var lastCol = asistSheet.getLastColumn();
  var values  = asistSheet.getRange(1, 1, Math.max(lastRow, 1), Math.max(lastCol, 2)).getValues();
  var headers = values[0];
  var rowsByRut = {};
  var rutRowIndex = {};
  for (var r = 1; r < values.length; r++) {
    var rut = String(values[r][0] || '').trim();
    if (!rut) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[String(headers[c])] = values[r][c];
    }
    rowsByRut[rut] = obj;
    rutRowIndex[rut] = r + 1;
  }
  return { headers: headers, rowsByRut: rowsByRut, rutRowIndex: rutRowIndex };
}

function getActivacionData(fechaISO, force) {
  try {
    var target = fechaISO || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var cacheKey = 'activ_' + target;
    if (!force) {
      var cached = _cacheGet(cacheKey);
      if (cached) return cached;
    }

    var sheets = _activGetSheets();
    var shopperSheet = sheets.shopperSheet;

    var lastRow = shopperSheet.getLastRow();
    var lastCol = shopperSheet.getLastColumn();
    if (lastRow < 2) return { fecha: target, turnos: [], fechasDisponibles: [] };

    var all = shopperSheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headerRow = all[0];
    var targetYear = parseInt(target.split('-')[0]);

    var colDate = {};
    var fechasDisponibles = [];
    for (var c = 2; c < headerRow.length; c++) {
      var key = _activParseHeaderDate(headerRow[c], targetYear);
      if (key) {
        colDate[c] = key;
        if (fechasDisponibles.indexOf(key) === -1) fechasDisponibles.push(key);
      }
    }
    fechasDisponibles.sort();

    var targetCol = -1;
    for (var ci in colDate) {
      if (colDate[ci] === target) { targetCol = parseInt(ci); break; }
    }

    var asist = _activReadAsistencia(sheets.asistSheet);
    var asistColName = 'asist_' + target;

    var turnos = [];
    if (targetCol !== -1) {
      for (var r = 1; r < all.length; r++) {
        var nombre = String(all[r][0] || '').trim();
        var rut    = String(all[r][1] || '').trim();
        if (!nombre && !rut) continue;

        var turnoRaw = String(all[r][targetCol] || '').trim();
        var turnoUp  = turnoRaw.toUpperCase();
        if (turnoUp !== 'AM' && turnoUp !== 'PM' && turnoUp !== 'FULL') continue;

        var asistVal = null;
        if (asist.rowsByRut[rut] && asist.rowsByRut[rut].hasOwnProperty(asistColName)) {
          var v = asist.rowsByRut[rut][asistColName];
          if (v === 1 || v === '1') asistVal = 1;
          else if (v === 0 || v === '0') asistVal = 0;
        }

        turnos.push({
          rut:    rut,
          nombre: nombre,
          turno:  turnoUp,
          asistencia: asistVal
        });
      }
    }

    turnos.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });

    var result = {
      fecha: target,
      turnos: turnos,
      fechasDisponibles: fechasDisponibles,
      tieneColumna: targetCol !== -1
    };
    _cachePut(cacheKey, result);
    return result;
  } catch (e) {
    return { error: e.toString() };
  }
}

function marcarAsistencia(rut, nombre, fechaISO, estado) {
  try {
    var sheets = _activGetSheets();
    var asistSheet = sheets.asistSheet;
    var asistColName = 'asist_' + fechaISO;

    var lastCol = asistSheet.getLastColumn();
    var headers = asistSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var colIdx = headers.indexOf(asistColName);
    if (colIdx === -1) {
      asistSheet.getRange(1, lastCol + 1).setValue(asistColName);
      colIdx = lastCol;
    }
    var colNum = colIdx + 1;

    var lastRow = asistSheet.getLastRow();
    var ruts = lastRow >= 2 ? asistSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(function(x){ return String(x).trim(); }) : [];
    var rowNum = -1;
    for (var i = 0; i < ruts.length; i++) {
      if (ruts[i] === String(rut).trim()) { rowNum = i + 2; break; }
    }
    if (rowNum === -1) {
      rowNum = asistSheet.getLastRow() + 1;
      asistSheet.getRange(rowNum, 1, 1, 2).setValues([[rut, nombre]]);
    }

    var cell = asistSheet.getRange(rowNum, colNum);
    if (estado === null || estado === '' || typeof estado === 'undefined') {
      cell.clearContent();
    } else {
      cell.setValue(estado === 1 || estado === '1' ? 1 : 0);
    }
    _cacheClear('activ_' + fechaISO);
    _cacheClear('asistStats');
    return true;
  } catch (e) {
    throw new Error('Error al guardar asistencia: ' + e.toString());
  }
}

function getAsistenciaStats(force) {
  try {
    if (!force) {
      var cached = _cacheGet('asistStats');
      if (cached) return cached;
    }
    var sheets = _activGetSheets();
    var asistSheet = sheets.asistSheet;
    var lastRow = asistSheet.getLastRow();
    var lastCol = asistSheet.getLastColumn();
    if (lastRow < 2 || lastCol < 3) return [];

    var values = asistSheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0];

    var fechaCols = [];
    for (var c = 2; c < headers.length; c++) {
      if (String(headers[c]).indexOf('asist_') === 0) fechaCols.push(c);
    }

    var stats = [];
    for (var r = 1; r < values.length; r++) {
      var rut = String(values[r][0] || '').trim();
      var nombre = String(values[r][1] || '').trim();
      if (!rut && !nombre) continue;

      var presentes = 0, ausentes = 0;
      fechaCols.forEach(function(c) {
        var v = values[r][c];
        if (v === 1 || v === '1') presentes++;
        else if (v === 0 || v === '0') ausentes++;
      });
      var total = presentes + ausentes;
      if (total === 0) continue;

      stats.push({
        rut: rut,
        nombre: nombre,
        presentes: presentes,
        ausentes: ausentes,
        total: total,
        pctCumplimiento: total > 0 ? Math.round((presentes / total) * 100) : 0,
        pctAusentismo:   total > 0 ? Math.round((ausentes / total) * 100) : 0
      });
    }

    stats.sort(function(a, b) { return b.pctAusentismo - a.pctAusentismo; });
    _cachePut('asistStats', stats);
    return stats;
  } catch (e) {
    return { error: e.toString() };
  }
}

// ==============================================
// MÓDULO 8: FLEJES (con caché)
// ==============================================

function uploadFleje(dataB64, fileName, categoria, nombreCustom) {
  try {
    const folder = DriveApp.getFolderById(FLEJES_FOLDER_ID);
    const contentType = dataB64.substring(5, dataB64.indexOf(';'));
    const bytes = Utilities.base64Decode(dataB64.substr(dataB64.indexOf('base64,') + 7));
    const blob = Utilities.newBlob(bytes, contentType, fileName);
    const file = folder.createFile(blob);
    const fileUrl = file.getUrl();
    const ss = SpreadsheetApp.openById(FLEJES_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(FLEJES_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(FLEJES_SHEET_NAME);
      sheet.appendRow(['Fecha', 'Categoría', 'URL Archivo', 'Nombre Archivo', 'Nombre Personalizado']);
      sheet.getRange("A1:E1").setFontWeight("bold").setBackground("#0B1C49").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }
    const tz = Session.getScriptTimeZone();
    const fechaActual = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([fechaActual, categoria, fileUrl, fileName, nombreCustom]);
    _cacheClear('flejes');
    return { success: true, url: fileUrl };
  } catch (error) {
    throw new Error('Error al guardar fleje: ' + error.message);
  }
}

function getFlejesData(force) {
  try {
    if (!force) {
      const cached = _cacheGet('flejes');
      if (cached) return cached;
    }
    const ss = SpreadsheetApp.openById(FLEJES_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(FLEJES_SHEET_NAME);
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    const result = [];
    const tz = Session.getScriptTimeZone();
    data.forEach(row => {
      if (!row[0] && !row[1]) return;
      let fechaLimpia = row[0];
      if (fechaLimpia instanceof Date) {
        fechaLimpia = Utilities.formatDate(fechaLimpia, tz, 'dd/MM/yyyy HH:mm');
      } else {
        fechaLimpia = String(fechaLimpia || '').trim();
      }
      result.push({
        fecha: fechaLimpia,
        categoria: String(row[1] || 'Sin categoría').trim(),
        url: String(row[2] || '').trim(),
        nombreArchivo: String(row[3] || '').trim(),
        nombreCustom: String(row[4] || '').trim()
      });
    });
    const out = result.reverse();
    _cachePut('flejes', out);
    return out;
  } catch (error) {
    return { error: error.message };
  }
}

// ==============================================
// MÓDULO 9: PENDIENTES DE CIERRE
// Lógica de estados duplicados por Orden:
//   Recogido + Entregado          → FINALIZADO (se excluye)
//   Recogido + otro estado        → ALERTA     (se muestra con bandera)
//   Un solo estado o combinación normal → pendiente normal
// ==============================================

function getPendientesCierreData(force) {
  const KEY = 'pendientes_cierre';
  if (!force) {
    const c = _cacheGet(KEY);
    if (c) return c;
  }
  const result = _buildPendientesCierre();
  if (result.ok) _cachePut(KEY, result, 180); // caché de 3 minutos
  return result;
}

function _buildPendientesCierre() {
  try {
    const ss   = SpreadsheetApp.openById(PENDIENTES_CIERRE_SPREADSHEET_ID);
    const hoja = ss.getSheets().find(s => s.getSheetId() === PENDIENTES_CIERRE_GID);

    if (!hoja) {
      return { ok: false, error: 'No se encontró la hoja con GID ' + PENDIENTES_CIERRE_GID + '. Verifica que la hoja L94_Hoy exista.' };
    }

    const lastRow = hoja.getLastRow();
    if (lastRow < 2) return { ok: true, pendientes: [], finalizados: 0, alertas: 0, totalOrdenes: 0 };

    const values  = hoja.getRange(1, 1, lastRow, hoja.getLastColumn()).getValues();
    const headers = values[0];

    const iOrden   = _findCol(headers, ['orden', 'order', 'nro orden', 'numero orden', 'n orden', 'no orden', 'numero de orden']);
    const iEstado  = _findCol(headers, ['estado', 'status', 'estado orden', 'estado de la orden']);
    const iUsuario = _findCol(headers, ['usuario movil', 'usuario movil', 'usuario_movil', 'repartidor', 'courier', 'chofer', 'driver', 'nombre conductor']);
    const iMin     = _findCol(headers, ['tiempo min entrega', 'tiempo_min_entrega', 'min entrega', 'ventana inicio', 'desde', 'hora inicio', 'tiempo minimo entrega']);
    const iMax     = _findCol(headers, ['tiempo max entrega', 'tiempo_max_entrega', 'max entrega', 'ventana fin', 'hasta', 'hora fin', 'tiempo maximo entrega']);

    if (iOrden === -1 || iEstado === -1) {
      return {
        ok: false,
        error: 'Columnas "Orden" o "Estado" no encontradas. Encabezados detectados: ' + headers.slice(0, 15).join(' | ')
      };
    }

    // Agrupar registros por Orden
    const grupos = {};
    for (let r = 1; r < values.length; r++) {
      const row   = values[r];
      const orden = String(row[iOrden] || '').trim();
      if (!orden) continue;

      const estado  = String(row[iEstado]  || '').trim();
      const usuario = iUsuario !== -1 ? String(row[iUsuario] || '').trim() : '';
      const ventana = _pcVentana(
        iMin !== -1 ? row[iMin] : '',
        iMax !== -1 ? row[iMax] : ''
      );

      if (!grupos[orden]) grupos[orden] = [];
      grupos[orden].push({ estado, usuario, ventana });
    }

    const pendientes = [];
    let finalizados  = 0;
    let totalAlertas = 0;

    Object.keys(grupos).forEach(orden => {
      const regs    = grupos[orden];
      const estados = regs.map(r => r.estado.toUpperCase());
      const rep     = regs[regs.length - 1]; // registro más reciente como representativo

      const tieneRecogido  = estados.some(e => e === 'RECOGIDO');
      const tieneEntregado = estados.some(e => e === 'ENTREGADO');
      const otrosEstados   = estados.filter(e => e !== 'RECOGIDO' && e !== 'ENTREGADO');

      // FINALIZADO: tiene Recogido Y Entregado → se excluye completamente
      if (tieneRecogido && tieneEntregado) {
        finalizados++;
        return;
      }

      // ALERTA: tiene Recogido + algún otro estado inesperado
      const esAlerta = tieneRecogido && otrosEstados.length > 0;
      if (esAlerta) totalAlertas++;

      pendientes.push({
        orden:            orden,
        estado:           rep.estado,
        usuario:          rep.usuario || '-',
        ventana:          rep.ventana || '-',
        esAlerta:         esAlerta,
        duplicado:        regs.length > 1,
        // Para alertas: lista de todos los estados combinados
        estadosCombinados: regs.length > 1 ? [...new Set(regs.map(r => r.estado))].filter(Boolean) : null
      });
    });

    // Ordenar: alertas primero, luego por ventana
    pendientes.sort((a, b) => {
      if (a.esAlerta && !b.esAlerta) return -1;
      if (!a.esAlerta && b.esAlerta) return 1;
      return (a.ventana || '').localeCompare(b.ventana || '');
    });

    return {
      ok:          true,
      pendientes:  pendientes,
      finalizados: finalizados,
      alertas:     totalAlertas,
      totalOrdenes: Object.keys(grupos).length
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// Construye "HH:MM – HH:MM" desde dos campos de fecha-hora
function _pcVentana(desde, hasta) {
  const h1 = _pcHora(desde);
  const h2 = _pcHora(hasta);
  if (!h1 && !h2) return '-';
  if (!h1) return h2;
  if (!h2) return h1;
  return h1 + ' – ' + h2;
}

// Extrae "HH:MM" de un valor que puede ser Date o string "2026-06-17 17:00:00"
function _pcHora(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return ('0' + val.getHours()).slice(-2) + ':' + ('0' + val.getMinutes()).slice(-2);
  }
  const s = String(val).trim();
  const m = s.match(/\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

// ==============================================
// EXPORTS A EXCEL (Reclamos / Atrasos)
// ==============================================

function _exportSpreadsheetAsXlsx(ss, fileNameBase) {
  const fileId = ss.getId();
  const file = DriveApp.getFileById(fileId);
  const blob = file.getAs('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const base64 = Utilities.base64Encode(blob.getBytes());
  try { file.setTrashed(true); } catch (e) {}
  return {
    base64:  base64,
    fileName: fileNameBase + '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
}

function _styleHeaderRow(sheet, row, numCols) {
  const range = sheet.getRange(row, 1, 1, numCols);
  range.setFontWeight('bold');
  range.setBackground('#0B1C49');
  range.setFontColor('#FFFFFF');
  range.setHorizontalAlignment('center');
  sheet.setFrozenRows(row);
}

function _autoFitColumns(sheet, numCols) {
  for (let c = 1; c <= numCols; c++) {
    sheet.autoResizeColumn(c);
  }
}

function exportReclamosExcel(desde, hasta) {
  try {
    const all = getReclamosData();
    if (all && all.error) throw new Error(all.error);

    const filtered = (all || []).filter(r => {
      if (!desde && !hasta) return true;
      if (!r.fechaISO) return false;
      if (desde && r.fechaISO < desde) return false;
      if (hasta && r.fechaISO > hasta) return false;
      return true;
    });

    const tz = Session.getScriptTimeZone();
    const rangoLabel = (desde || hasta)
      ? ((desde || '…') + ' a ' + (hasta || '…'))
      : 'Histórico completo';

    const tmp = SpreadsheetApp.create('TMP_Export_Reclamos_' + new Date().getTime());

    const resumen = tmp.getSheets()[0];
    resumen.setName('Resumen');

    resumen.getRange('A1').setValue('REPORTE DE RECLAMOS – LOCAL 94');
    resumen.getRange('A1').setFontWeight('bold').setFontSize(14).setFontColor('#0B1C49');
    resumen.getRange('A2').setValue('Rango de fechas: ' + rangoLabel);
    resumen.getRange('A3').setValue('Generado el: ' + Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm'));
    resumen.getRange('A2:A3').setFontColor('#555555');

    const pendientes = filtered.filter(isReclamoSinRevisionGS).length;
    const aplica     = filtered.filter(r => String(r.aplica||'').trim().toLowerCase() === 'aplica').length;
    const noAplica   = filtered.filter(r => String(r.aplica||'').trim().toLowerCase() === 'no aplica').length;
    const sinClasif  = filtered.length - aplica - noAplica;

    let row = 5;
    resumen.getRange(row, 1, 1, 2).setValues([['KPI', 'Valor']]);
    _styleHeaderRow(resumen, row, 2);
    row++;
    const kpiRows = [
      ['Total de Reclamos (en el rango)', filtered.length],
      ['Pendientes de Revisión',          pendientes],
      ['Clasificados como "Aplica"',      aplica],
      ['Clasificados como "No Aplica"',   noAplica],
      ['Sin Clasificar',                  sinClasif]
    ];
    resumen.getRange(row, 1, kpiRows.length, 2).setValues(kpiRows);
    resumen.getRange(row, 2, kpiRows.length, 1).setFontWeight('bold').setHorizontalAlignment('center');
    row += kpiRows.length + 2;

    const porCausa = _gsAggregate(filtered, 'causa');
    resumen.getRange(row, 1).setValue('Reclamos por Causa');
    resumen.getRange(row, 1).setFontWeight('bold').setFontColor('#0B1C49');
    row++;
    resumen.getRange(row, 1, 1, 3).setValues([['Causa', 'Cantidad', '% del Total']]);
    _styleHeaderRow(resumen, row, 3);
    row++;
    porCausa.sort((a,b)=>b.count-a.count).forEach(item => {
      resumen.getRange(row, 1, 1, 3).setValues([[item.label, item.count, filtered.length ? (item.count/filtered.length) : 0]]);
      resumen.getRange(row, 3).setNumberFormat('0.0%');
      row++;
    });
    row += 1;

    const porAccion = _gsAggregate(filtered.filter(r => String(r.accion||'').trim() !== ''), 'accion');
    resumen.getRange(row, 1).setValue('Reclamos por Acción Tomada');
    resumen.getRange(row, 1).setFontWeight('bold').setFontColor('#0B1C49');
    row++;
    resumen.getRange(row, 1, 1, 3).setValues([['Acción Tomada', 'Cantidad', '% del Total']]);
    _styleHeaderRow(resumen, row, 3);
    row++;
    porAccion.sort((a,b)=>b.count-a.count).forEach(item => {
      resumen.getRange(row, 1, 1, 3).setValues([[item.label, item.count, filtered.length ? (item.count/filtered.length) : 0]]);
      resumen.getRange(row, 3).setNumberFormat('0.0%');
      row++;
    });
    row += 1;

    const porShopper = _gsAggregate(filtered, 'shopper');
    resumen.getRange(row, 1).setValue('Top 10 Shoppers con más Reclamos');
    resumen.getRange(row, 1).setFontWeight('bold').setFontColor('#0B1C49');
    row++;
    resumen.getRange(row, 1, 1, 3).setValues([['Shopper', 'Cantidad', '% del Total']]);
    _styleHeaderRow(resumen, row, 3);
    row++;
    porShopper.sort((a,b)=>b.count-a.count).slice(0,10).forEach(item => {
      resumen.getRange(row, 1, 1, 3).setValues([[item.label, item.count, filtered.length ? (item.count/filtered.length) : 0]]);
      resumen.getRange(row, 3).setNumberFormat('0.0%');
      row++;
    });

    _autoFitColumns(resumen, 3);

    const detalleHeaders = ['Fecha', 'N° SG', 'Causa', 'Descripción', 'Shopper', '¿Aplica?', 'Acción Tomada', 'Comentario', 'Semana', 'Año'];
    const detalleSheet = tmp.insertSheet('Todos los Reclamos');
    detalleSheet.getRange(1, 1, 1, detalleHeaders.length).setValues([detalleHeaders]);
    _styleHeaderRow(detalleSheet, 1, detalleHeaders.length);

    const detalleRows = filtered
      .slice()
      .sort((a,b) => (a.fechaISO||'').localeCompare(b.fechaISO||''))
      .map(r => [
        r.fecha, r.sg, r.causa, r.descripcion, r.shopper,
        r.aplica || 'Sin clasificar', r.accion || '-', r.comentario || '-',
        r.semana || '-', r.anio || '-'
      ]);
    if (detalleRows.length) {
      detalleSheet.getRange(2, 1, detalleRows.length, detalleHeaders.length).setValues(detalleRows);
    }
    detalleSheet.setColumnWidth(4, 380);
    detalleSheet.setColumnWidth(8, 250);
    _autoFitColumns(detalleSheet, detalleHeaders.length);
    detalleSheet.setColumnWidth(4, 380);
    detalleSheet.setColumnWidth(8, 250);

    const causas = [...new Set(filtered.map(r => (r.causa || 'Sin Causa').trim()))].filter(Boolean);
    causas.forEach(causa => {
      const subset = filtered
        .filter(r => (r.causa || 'Sin Causa').trim() === causa)
        .sort((a,b) => (a.fechaISO||'').localeCompare(b.fechaISO||''));
      if (!subset.length) return;

      let sheetName = causa.substring(0, 95).replace(/[\[\]\*\/\\\?:]/g, '');
      sheetName = _gsUniqueSheetName(tmp, sheetName || 'Causa');

      const sh = tmp.insertSheet(sheetName);
      sh.getRange(1, 1, 1, detalleHeaders.length).setValues([detalleHeaders]);
      _styleHeaderRow(sh, 1, detalleHeaders.length);
      const rows = subset.map(r => [
        r.fecha, r.sg, r.causa, r.descripcion, r.shopper,
        r.aplica || 'Sin clasificar', r.accion || '-', r.comentario || '-',
        r.semana || '-', r.anio || '-'
      ]);
      sh.getRange(2, 1, rows.length, detalleHeaders.length).setValues(rows);
      sh.setColumnWidth(4, 380);
      sh.setColumnWidth(8, 250);
      _autoFitColumns(sh, detalleHeaders.length);
      sh.setColumnWidth(4, 380);
      sh.setColumnWidth(8, 250);
    });

    SpreadsheetApp.flush();
    const fileNameBase = 'Reclamos_L94_' + (desde || 'inicio') + '_a_' + (hasta || 'hoy');
    return _exportSpreadsheetAsXlsx(tmp, fileNameBase);

  } catch (error) {
    return { error: error.toString() };
  }
}

function exportAtrasosExcel(anio, mes, semana) {
  try {
    const initial = getInitialData();
    if (initial && initial.error) throw new Error(initial.error);
    const all = initial.statsData || [];

    const filtered = all.filter(d =>
      (anio==='TODOS'||String(d.anio)===String(anio)) &&
      (mes ==='TODOS'||String(d.mes) ===String(mes))  &&
      (semana==='TODOS'||String(d.semana)===String(semana))
    );

    const tz = Session.getScriptTimeZone();
    const nm = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const filtroLabel = 'Año: ' + (anio==='TODOS'?'Todos':anio) +
                         ' | Mes: ' + (mes==='TODOS'?'Todos':(nm[parseInt(mes)]||mes)) +
                         ' | Semana: ' + (semana==='TODOS'?'Todas':semana);

    const tmp = SpreadsheetApp.create('TMP_Export_Atrasos_' + new Date().getTime());

    const resumen = tmp.getSheets()[0];
    resumen.setName('Resumen');

    resumen.getRange('A1').setValue('REPORTE DE ATRASOS – LOCAL 94');
    resumen.getRange('A1').setFontWeight('bold').setFontSize(14).setFontColor('#0B1C49');
    resumen.getRange('A2').setValue('Filtros aplicados: ' + filtroLabel);
    resumen.getRange('A3').setValue('Generado el: ' + Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm'));
    resumen.getRange('A2:A3').setFontColor('#555555');

    const pendientes = filtered.filter(d => !d.justificacion || String(d.justificacion).trim()==='').length;
    const justificados = filtered.length - pendientes;

    let row = 5;
    resumen.getRange(row, 1, 1, 2).setValues([['KPI', 'Valor']]);
    _styleHeaderRow(resumen, row, 2);
    row++;
    const kpiRows = [
      ['Total de Atrasos (en el rango)', filtered.length],
      ['Pendientes de Justificar',       pendientes],
      ['Justificados',                   justificados],
      ['% Justificado', filtered.length ? (justificados/filtered.length) : 0]
    ];
    resumen.getRange(row, 1, kpiRows.length, 2).setValues(kpiRows);
    resumen.getRange(row, 2, kpiRows.length, 1).setFontWeight('bold').setHorizontalAlignment('center');
    resumen.getRange(row + kpiRows.length - 1, 2).setNumberFormat('0.0%');
    row += kpiRows.length + 2;

    const porJust = _gsAggregate(filtered.filter(d=>d.justificacion && String(d.justificacion).trim()!==''), 'justificacion');
    resumen.getRange(row, 1).setValue('Atrasos por Justificación (Causa Raíz)');
    resumen.getRange(row, 1).setFontWeight('bold').setFontColor('#0B1C49');
    row++;
    resumen.getRange(row, 1, 1, 3).setValues([['Justificación', 'Cantidad', '% del Total']]);
    _styleHeaderRow(resumen, row, 3);
    row++;
    porJust.sort((a,b)=>b.count-a.count).forEach(item => {
      resumen.getRange(row, 1, 1, 3).setValues([[item.label, item.count, filtered.length ? (item.count/filtered.length) : 0]]);
      resumen.getRange(row, 3).setNumberFormat('0.0%');
      row++;
    });
    row += 1;

    const porResp = _gsAggregate(filtered, 'responsabilidad');
    resumen.getRange(row, 1).setValue('Atrasos por Responsabilidad');
    resumen.getRange(row, 1).setFontWeight('bold').setFontColor('#0B1C49');
    row++;
    resumen.getRange(row, 1, 1, 3).setValues([['Responsabilidad', 'Cantidad', '% del Total']]);
    _styleHeaderRow(resumen, row, 3);
    row++;
    porResp.sort((a,b)=>b.count-a.count).forEach(item => {
      resumen.getRange(row, 1, 1, 3).setValues([[item.label, item.count, filtered.length ? (item.count/filtered.length) : 0]]);
      resumen.getRange(row, 3).setNumberFormat('0.0%');
      row++;
    });
    row += 1;

    const porVentana = _gsAggregate(filtered, 'ventana');
    resumen.getRange(row, 1).setValue('Atrasos por Ventana Horaria');
    resumen.getRange(row, 1).setFontWeight('bold').setFontColor('#0B1C49');
    row++;
    resumen.getRange(row, 1, 1, 3).setValues([['Ventana', 'Cantidad', '% del Total']]);
    _styleHeaderRow(resumen, row, 3);
    row++;
    porVentana.sort((a,b)=>a.label.localeCompare(b.label)).forEach(item => {
      resumen.getRange(row, 1, 1, 3).setValues([[item.label, item.count, filtered.length ? (item.count/filtered.length) : 0]]);
      resumen.getRange(row, 3).setNumberFormat('0.0%');
      row++;
    });
    row += 1;

    const porNombre = _gsAggregate(filtered, 'nombre');
    resumen.getRange(row, 1).setValue('Top 10 Pickers / Shoppers con Atrasos');
    resumen.getRange(row, 1).setFontWeight('bold').setFontColor('#0B1C49');
    row++;
    resumen.getRange(row, 1, 1, 3).setValues([['Picker / Shopper', 'Cantidad', '% del Total']]);
    _styleHeaderRow(resumen, row, 3);
    row++;
    porNombre.sort((a,b)=>b.count-a.count).slice(0,10).forEach(item => {
      resumen.getRange(row, 1, 1, 3).setValues([[item.label, item.count, filtered.length ? (item.count/filtered.length) : 0]]);
      resumen.getRange(row, 3).setNumberFormat('0.0%');
      row++;
    });

    _autoFitColumns(resumen, 3);

    const detalleHeaders = ['Fecha', 'Ventana', 'SG', 'Picker / Shopper', 'Justificación', 'Observación', 'Semana', 'Mes', 'Año', 'Responsabilidad'];
    const detalleSheet = tmp.insertSheet('Todos los Atrasos');
    detalleSheet.getRange(1, 1, 1, detalleHeaders.length).setValues([detalleHeaders]);
    _styleHeaderRow(detalleSheet, 1, detalleHeaders.length);

    const detalleRows = filtered
      .slice()
      .sort((a,b) => (a.anio - b.anio) || (a.mes - b.mes) || (a.semana - b.semana))
      .map(r => [
        r.fecha, r.ventana, r.sg, r.nombre,
        r.justificacion || 'Pendiente', r.observacion || '-',
        r.semana || '-', r.mes ? (nm[parseInt(r.mes)]||r.mes) : '-', r.anio || '-',
        r.responsabilidad || 'Sin Asignar'
      ]);
    if (detalleRows.length) {
      detalleSheet.getRange(2, 1, detalleRows.length, detalleHeaders.length).setValues(detalleRows);
    }
    detalleSheet.setColumnWidth(6, 280);
    _autoFitColumns(detalleSheet, detalleHeaders.length);
    detalleSheet.setColumnWidth(6, 280);

    const justs = [...new Set(filtered.map(r => {
      const j = (r.justificacion || '').trim();
      return j === '' ? 'Pendiente de Justificar' : j;
    }))].filter(Boolean);

    justs.forEach(just => {
      const subset = filtered
        .filter(r => {
          const j = (r.justificacion || '').trim();
          return (j === '' ? 'Pendiente de Justificar' : j) === just;
        })
        .sort((a,b) => (a.anio - b.anio) || (a.mes - b.mes) || (a.semana - b.semana));
      if (!subset.length) return;

      let sheetName = just.substring(0, 95).replace(/[\[\]\*\/\\\?:]/g, '');
      sheetName = _gsUniqueSheetName(tmp, sheetName || 'Justificacion');

      const sh = tmp.insertSheet(sheetName);
      sh.getRange(1, 1, 1, detalleHeaders.length).setValues([detalleHeaders]);
      _styleHeaderRow(sh, 1, detalleHeaders.length);
      const rows = subset.map(r => [
        r.fecha, r.ventana, r.sg, r.nombre,
        r.justificacion || 'Pendiente', r.observacion || '-',
        r.semana || '-', r.mes ? (nm[parseInt(r.mes)]||r.mes) : '-', r.anio || '-',
        r.responsabilidad || 'Sin Asignar'
      ]);
      sh.getRange(2, 1, rows.length, detalleHeaders.length).setValues(rows);
      sh.setColumnWidth(6, 280);
      _autoFitColumns(sh, detalleHeaders.length);
      sh.setColumnWidth(6, 280);
    });

    SpreadsheetApp.flush();
    const anioLabel  = anio==='TODOS' ? 'Todos' : anio;
    const mesLabel   = mes==='TODOS' ? 'Todos' : (nm[parseInt(mes)] || mes);
    const fileNameBase = 'Atrasos_L94_' + anioLabel + '_' + mesLabel;
    return _exportSpreadsheetAsXlsx(tmp, fileNameBase);

  } catch (error) {
    return { error: error.toString() };
  }
}

// ── HELPERS COMPARTIDOS ──

function isReclamoSinRevisionGS(item) {
  const aplica     = String(item.aplica     || '').trim();
  const accion     = String(item.accion     || '').trim();
  const comentario = String(item.comentario || '').trim();
  return aplica === '' && accion === '' && comentario === '';
}

function _gsAggregate(arr, key) {
  const counts = {};
  arr.forEach(item => {
    let val = item[key];
    if (!val || String(val).trim() === '') val = 'Sin Asignar';
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.keys(counts).map(k => ({ label: k, count: counts[k] }));
}

function _gsUniqueSheetName(ss, baseName) {
  let name = baseName.substring(0, 95) || 'Hoja';
  let final = name;
  let n = 2;
  const existing = ss.getSheets().map(s => s.getName());
  while (existing.indexOf(final) !== -1) {
    final = (name.substring(0, 90)) + ' (' + n + ')';
    n++;
  }
  return final;
}

function forzarPermisoDriveCompleto() {
  DriveApp.createFile("archivo_prueba_borrar.txt", "texto de prueba");
}
