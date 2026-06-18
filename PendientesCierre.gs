// ============================================================
//  PENDIENTES DE CIERRE - Backend Module
//  Sheet fuente : 1w3i-sKKGMc2dh_7Nx8vWrUC-tgrMaOcbVQ7-6hUXcs8
//  Tab gid      : 561516213  (L94_Hoy o la hoja que corresponda)
// ============================================================
//  Lógica de estados duplicados por Orden:
//    Recogido + Entregado          → FINALIZADO  (se excluye de pendientes)
//    Recogido + otro estado        → ALERTA      (se muestra con bandera)
//    Un solo estado                → se muestra tal cual
// ============================================================

var PC_SHEET_ID  = '1w3i-sKKGMc2dh_7Nx8vWrUC-tgrMaOcbVQ7-6hUXcs8';
var PC_HOJA_NAME = 'L94_Hoy';   // cambia si el tab tiene otro nombre

// ----------------------------------------------------------
// FUNCIÓN PRINCIPAL llamada desde el frontend
// ----------------------------------------------------------
function getPendientesCierre() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('PC_DATA');
  if (cached) return JSON.parse(cached);

  var result = _buildPendientesCierre();

  try {
    cache.put('PC_DATA', JSON.stringify(result), 300); // 5 min
  } catch(e) { /* dato muy grande, sin caché */ }

  return result;
}

function clearPendientesCache() {
  CacheService.getScriptCache().remove('PC_DATA');
}

// ----------------------------------------------------------
// CONSTRUCCIÓN DE DATOS
// ----------------------------------------------------------
function _buildPendientesCierre() {
  var ss   = SpreadsheetApp.openById(PC_SHEET_ID);
  var hoja = ss.getSheetByName(PC_HOJA_NAME);

  if (!hoja) {
    return { ok: false, error: 'Hoja "' + PC_HOJA_NAME + '" no encontrada.' };
  }

  var datos = hoja.getDataRange().getValues();
  if (datos.length < 2) {
    return { ok: true, pendientes: [], alertas: [], finalizados: 0 };
  }

  var headers = datos[0].map(function(h) { return String(h).trim(); });

  // ── Índices de columnas (búsqueda flexible) ──────────────
  var iOrden    = _findColPC(headers, ['orden','order','nro orden','numero orden','n° orden']);
  var iEstado   = _findColPC(headers, ['estado','status','estado orden']);
  var iUsuario  = _findColPC(headers, ['usuario movil','usuario móvil','usuario_movil','repartidor','courier','chofer']);
  var iTiempoMin = _findColPC(headers, ['tiempo min entrega','tiempo_min_entrega','min entrega','ventana inicio','desde']);
  var iTiempoMax = _findColPC(headers, ['tiempo max entrega','tiempo_max_entrega','max entrega','ventana fin','hasta']);

  if (iOrden === -1 || iEstado === -1) {
    return { ok: false, error: 'No se encontraron columnas Orden o Estado en la hoja.' };
  }

  // ── Agrupar filas por Orden ───────────────────────────────
  var grupos = {};   // { ordenId: [{ estado, usuario, ventana }, ...] }

  for (var r = 1; r < datos.length; r++) {
    var fila   = datos[r];
    var orden  = String(fila[iOrden]).trim();
    var estado = String(iEstado  !== -1 ? fila[iEstado]  : '').trim();

    if (!orden || orden === '') continue;

    var ventana = _extraerVentana(
      iTiempoMin !== -1 ? fila[iTiempoMin] : '',
      iTiempoMax !== -1 ? fila[iTiempoMax] : ''
    );

    var usuario = iUsuario !== -1 ? String(fila[iUsuario]).trim() : '';

    if (!grupos[orden]) grupos[orden] = [];
    grupos[orden].push({ estado: estado, usuario: usuario, ventana: ventana });
  }

  // ── Clasificar cada grupo ─────────────────────────────────
  var pendientes = [];
  var alertas    = [];
  var finalizados = 0;

  Object.keys(grupos).forEach(function(orden) {
    var registros = grupos[orden];
    var estados   = registros.map(function(r) { return r.estado.toUpperCase(); });

    var tieneRecogido   = estados.some(function(e) { return e === 'RECOGIDO'; });
    var tieneEntregado  = estados.some(function(e) { return e === 'ENTREGADO'; });
    var otrosEstados    = estados.filter(function(e) {
      return e !== 'RECOGIDO' && e !== 'ENTREGADO';
    });

    // Tomar el registro más reciente como representativo
    var rep = registros[registros.length - 1];

    if (tieneRecogido && tieneEntregado) {
      // ✅ FINALIZADO — no se muestra en pendientes
      finalizados++;
      return;
    }

    if (tieneRecogido && otrosEstados.length > 0) {
      // ⚠️ ALERTA — Recogido coexiste con estado inesperado
      alertas.push({
        orden   : orden,
        estados : registros.map(function(r) { return r.estado; }),
        usuario : rep.usuario,
        ventana : rep.ventana
      });
      return;
    }

    // 🕐 PENDIENTE normal
    pendientes.push({
      orden  : orden,
      estado : rep.estado,
      usuario: rep.usuario,
      ventana: rep.ventana,
      duplicado: registros.length > 1
    });
  });

  // Ordenar pendientes por ventana horaria ascendente
  pendientes.sort(function(a, b) {
    return (a.ventana || '').localeCompare(b.ventana || '');
  });

  return {
    ok         : true,
    pendientes : pendientes,
    alertas    : alertas,
    finalizados: finalizados,
    totalOrdenes: Object.keys(grupos).length
  };
}

// ----------------------------------------------------------
// HELPERS
// ----------------------------------------------------------

// Extrae "HH:MM – HH:MM" de dos campos datetime "2026-06-17 17:00:00"
function _extraerVentana(desde, hasta) {
  var h1 = _soloHora(desde);
  var h2 = _soloHora(hasta);
  if (!h1 && !h2) return '';
  if (!h1) return h2;
  if (!h2) return h1;
  return h1 + ' – ' + h2;
}

function _soloHora(valor) {
  if (!valor) return '';
  var s = String(valor).trim();
  // Formato "2026-06-17 17:00:00" → extraer "17:00"
  var m = s.match(/\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2})/);
  if (m) return m[1];
  // Si ya es Date object de Sheets
  if (valor instanceof Date) {
    var hh = String(valor.getHours()).padStart(2, '0');
    var mm = String(valor.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  return '';
}

// Búsqueda flexible de columna por aliases (insensible a mayúsculas/tildes)
function _findColPC(headers, aliases) {
  var norm = function(s) {
    return s.toLowerCase()
      .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i')
      .replace(/ó/g,'o').replace(/ú/g,'u').replace(/ñ/g,'n')
      .replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
  };
  var normHeaders = headers.map(norm);
  for (var a = 0; a < aliases.length; a++) {
    var idx = normHeaders.indexOf(norm(aliases[a]));
    if (idx !== -1) return idx;
  }
  return -1;
}
