/**
 * It's About Time — ranking, votos, respaldo en la nube y datos de uso.
 *
 * Aplicación web que escribe en esta planilla. El juego LEE el ranking desde la planilla publicada en
 * la web (CSV) y ESCRIBE solo a través de este script. Instalación: docs/ranking.md.
 *
 * Sin login: cada navegador manda una llave secreta al azar; en la planilla se guarda solo un hash de
 * esa llave (`id`), así nadie puede escribir en la fila de otro.
 *
 * Hojas:
 * - players_info y comments: públicas (las lee el juego).
 * - player_data (respaldo) y metadata_local (sesiones): PRIVADAS. Al publicar la planilla en la web,
 *   publica solo players_info y comments, nunca "Todo el documento".
 * - resumen: fórmulas sobre las otras dos (la arma crearResumen(), se corre una vez a mano).
 */

var PLAYERS = 'players_info';
var COMMENTS = 'comments';
var DATA = 'player_data';
var SESSIONS = 'metadata_local';
var SUMMARY = 'resumen';
/**
 * Si quieres los datos privados en OTRA planilla (más seguro: esa nunca se publica), pega acá su id
 * (lo que va entre /d/ y /edit en la URL). Vacío = esta misma planilla.
 */
var PRIVATE_SPREADSHEET_ID = '';

var PLAYER_HEAD = ['id', 'nombre', 'puntaje', 'misiones', 'total', 'actualizado', 'creado'];
var COMMENT_HEAD = ['fecha', 'id', 'nombre', 'estrellas', 'comentario', 'puntaje', 'misiones'];
/** Partes del respaldo (una columna cada una, comprimidas). Mismos nombres que en src/systems/CloudSave.ts. */
var PARTS = ['partida', 'espacios', 'progreso', 'stats', 'ajustes', 'jugador'];
var DATA_HEAD = ['id', 'nombre', 'creado', 'actualizado', 'rev', 'dispositivo', 'mision', 'misiones', 'puntaje', 'minutos_juego', 'bytes', 'hashes'].concat(PARTS);
var SESSION_HEAD = [
  'sesion', 'jugador', 'inicio', 'ultimo', 'minutos', 'jugando',
  'fecha_local', 'hora_local', 'dia', 'visita', 'nuevo',
  'pais', 'region', 'ciudad', 'ip_hash', 'zona_horaria', 'idioma',
  'dispositivo', 'so', 'navegador', 'pantalla', 'pwa', 'origen',
  'mision', 'misiones', 'puntaje',
];
var NAME_MIN = 2;
var NAME_MAX = 16;
var COMMENT_MAX = 280;
/** Topes de cordura para lo que manda el cliente (el juego tiene bastante menos). */
var MAX_SCORE = 5000;
var MAX_MISSIONS = 100;
/** Una celda de Sheets admite 50.000 caracteres. */
var MAX_PART = 48000;
/** Segundos mínimos entre envíos del mismo jugador (o de la misma sesión). */
var COOLDOWN = { score: 5, vote: 30, save: 10, load: 2, session: 10 };

function doGet() {
  return json({ ok: true, service: 'its-about-time-ranking', version: 2 });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'bad_request' });
  }
  var key = String(body.key || '');
  if (!/^[0-9a-f]{32}$/.test(key)) return json({ ok: false, error: 'bad_request' });
  var id = hashKey(key);
  switch (body.action) {
    case 'save':
      return json(saveData(id, body));
    case 'load':
      return json(loadData(id, body));
    case 'session':
      return json(saveSession(id, body));
    case 'vote':
      return json(scoreOrVote(id, 'vote', body));
    default:
      return json(scoreOrVote(id, 'score', body));
  }
}

// ---------------------------------------------------------------- ranking y votos

function scoreOrVote(id, action, body) {
  var name = cleanName(body.name);
  if (!name) return { ok: false, error: 'bad_name' };

  var cache = CacheService.getScriptCache();
  var coolKey = action + ':' + id;
  if (cache.get(coolKey)) return { ok: false, error: 'too_fast' };

  var score = clampInt(body.score, MAX_SCORE);
  var missions = clampInt(body.missions, MAX_MISSIONS);
  var total = clampInt(body.total, MAX_SCORE);
  var stars = clampInt(body.stars, 5);
  if (action === 'vote' && stars < 1) return { ok: false, error: 'bad_request' };

  var result = locked(function () {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var players = sheetWithHead(ss, PLAYERS, PLAYER_HEAD);
    var now = new Date().toISOString();

    var data = players.getDataRange().getValues();
    var row = -1;
    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][0]);
      if (rowId === id) row = i + 1;
      else if (normalize(unescapeCell(String(data[i][1]))) === normalize(name)) {
        return { ok: false, error: 'name_taken' };
      }
    }

    if (row === -1) {
      writeRow(players, players.getLastRow() + 1, [id, safe(name), score, missions, total, now, now]);
    } else {
      // El puntaje nunca baja (otro navegador del mismo jugador no lo pisa con menos).
      var prev = data[row - 1];
      var best = Math.max(score, Number(prev[2]) || 0);
      var updated = best > (Number(prev[2]) || 0) ? now : String(prev[5]);
      writeRow(players, row, [
        id,
        safe(name),
        best,
        Math.max(missions, Number(prev[3]) || 0),
        Math.max(total, Number(prev[4]) || 0),
        updated,
        String(prev[6] || now),
      ]);
    }

    if (action === 'vote') {
      var comments = sheetWithHead(ss, COMMENTS, COMMENT_HEAD);
      var comment = String(body.comment || '').replace(/\s+/g, ' ').trim().slice(0, COMMENT_MAX);
      writeRow(comments, comments.getLastRow() + 1, [now, id, safe(name), stars, safe(comment), score, missions]);
    }
    return { ok: true, id: id };
  });
  if (result.ok) cache.put(coolKey, '1', COOLDOWN[action]);
  return result;
}

// ---------------------------------------------------------------- respaldo (player_data)

/** Guarda las partes que cambiaron. Las que no vienen quedan como estaban. */
function saveData(id, body) {
  if (!cooled('save', id)) return { ok: false, error: 'too_fast' };
  var parts = body.parts && typeof body.parts === 'object' ? body.parts : {};
  var hashes = body.hashes && typeof body.hashes === 'object' ? body.hashes : {};
  var incoming = {};
  for (var i = 0; i < PARTS.length; i++) {
    var p = PARTS[i];
    if (typeof parts[p] !== 'string') continue;
    var v = parts[p];
    // "gz1:" + base64 o "raw:" + JSON (ver packText en src/systems/cloudCodec.ts).
    if (v.length > MAX_PART || !/^(gz1:[A-Za-z0-9+\/=]*|raw:[\s\S]*)$/.test(v)) return { ok: false, error: 'bad_part' };
    if (!/^[0-9a-f]{8}$/.test(String(hashes[p] || ''))) return { ok: false, error: 'bad_part' };
    incoming[p] = v;
  }
  var sum = body.summary && typeof body.summary === 'object' ? body.summary : {};

  return locked(function () {
    var sheet = sheetWithHead(privateBook(), DATA, DATA_HEAD);
    var col = indexOf(DATA_HEAD);
    var row = findRow(sheet, id);
    var prev = row > 0 ? sheet.getRange(row, 1, 1, DATA_HEAD.length).getValues()[0] : null;
    var now = new Date();
    var allHashes = parseJson(prev ? prev[col.hashes] : '');
    var rev = (prev ? Number(prev[col.rev]) || 0 : 0) + 1;
    var values = [];
    var bytes = 0;
    for (var j = 0; j < PARTS.length; j++) {
      var name = PARTS[j];
      var fresh = incoming.hasOwnProperty(name);
      var value = fresh ? incoming[name] : prev ? String(prev[col[name]] || '') : '';
      if (fresh) allHashes[name] = String(hashes[name]);
      bytes += value.length;
      values.push(value);
    }
    var mission = String(sum.mission || '');
    var record = [
      id,
      safe(cleanName(sum.name) || (prev ? unescapeCell(String(prev[col.nombre])) : '')),
      prev ? prev[col.creado] : now,
      now,
      rev,
      cleanText(body.device, 40),
      /^mission\d+$/.test(mission) ? mission : '',
      clampInt(sum.missions, MAX_MISSIONS),
      clampInt(sum.score, MAX_SCORE),
      clampInt(sum.playMin, 1000000),
      bytes,
      JSON.stringify(allHashes),
    ].concat(values);
    var range = sheet.getRange(row > 0 ? row : sheet.getLastRow() + 1, 1, 1, record.length);
    range.setNumberFormats([
      DATA_HEAD.map(function (h) {
        if (h === 'creado' || h === 'actualizado') return 'yyyy-mm-dd hh:mm';
        return /^(rev|misiones|puntaje|minutos_juego|bytes)$/.test(h) ? '0' : '@';
      }),
    ]);
    range.setValues([record]);
    return { ok: true, rev: rev };
  });
}

/**
 * Lee el respaldo de un jugador: siempre los hashes de cada parte (para comparar) y, de las partes
 * pedidas en `parts`, el contenido. Así el juego baja solo lo que necesita.
 */
function loadData(id, body) {
  if (!cooled('load', id)) return { ok: false, error: 'too_fast' };
  var sheet = privateBook().getSheetByName(DATA);
  var row = sheet ? findRow(sheet, id) : -1;
  if (row < 0) return { ok: true, found: false };
  var prev = sheet.getRange(row, 1, 1, DATA_HEAD.length).getValues()[0];
  var col = indexOf(DATA_HEAD);
  var want = Array.isArray(body.parts) ? body.parts : [];
  var parts = {};
  for (var i = 0; i < want.length; i++) {
    var p = String(want[i]);
    if (PARTS.indexOf(p) >= 0) parts[p] = String(prev[col[p]] || '');
  }
  return { ok: true, found: true, rev: Number(prev[col.rev]) || 0, hashes: parseJson(prev[col.hashes]), parts: parts };
}

// ---------------------------------------------------------------- datos de uso (metadata_local)

/** Crea la fila de la sesión o actualiza sus números (minutos, misión, puntaje). */
function saveSession(id, body) {
  var session = String(body.session || '');
  if (!/^[0-9a-f]{16}$/.test(session)) return { ok: false, error: 'bad_request' };
  if (!cooled('session', session)) return { ok: false, error: 'too_fast' };
  var mission = String(body.mission || '');
  mission = /^mission\d+$/.test(mission) ? mission : '';
  var minutes = clampNum(body.minutes, 24 * 60);
  var playing = clampNum(body.playing, 24 * 60);
  var missions = clampInt(body.missions, MAX_MISSIONS);
  var score = clampInt(body.score, MAX_SCORE);

  return locked(function () {
    var sheet = sheetWithHead(privateBook(), SESSIONS, SESSION_HEAD);
    var col = indexOf(SESSION_HEAD);
    var cache = CacheService.getScriptCache();
    var row = Number(cache.get('row:' + session)) || findRow(sheet, session);
    var now = new Date();
    if (row > 0) {
      // Solo lo que cambia: último, minutos, jugando y el progreso.
      sheet.getRange(row, col.ultimo + 1, 1, 3).setValues([[now, minutes, playing]]);
      sheet.getRange(row, col.mision + 1, 1, 3).setValues([[mission, missions, score]]);
      return { ok: true };
    }
    var visit = clampInt(body.visit, 1000000);
    var values = [
      session, id, now, now, minutes, playing,
      cleanText(body.localDate, 10), clampInt(body.localHour, 23), cleanText(body.weekday, 3), visit, visit <= 1 ? 'sí' : 'no',
      cleanText(body.country, 40), cleanText(body.region, 60), cleanText(body.city, 60), ipHash(body.ip),
      cleanText(body.timezone, 40), cleanText(body.language, 20),
      cleanText(body.device, 12), cleanText(body.os, 20), cleanText(body.browser, 20), cleanText(body.screen, 12),
      body.pwa === true ? 'sí' : 'no', cleanText(body.source, 40),
      mission, missions, score,
    ];
    row = sheet.getLastRow() + 1;
    var range = sheet.getRange(row, 1, 1, values.length);
    range.setNumberFormats([
      SESSION_HEAD.map(function (h) {
        if (h === 'inicio' || h === 'ultimo') return 'yyyy-mm-dd hh:mm';
        if (h === 'minutos' || h === 'jugando') return '0.0';
        return /^(hora_local|visita|misiones|puntaje)$/.test(h) ? '0' : '@';
      }),
    ]);
    range.setValues([values]);
    cache.put('row:' + session, String(row), 21600);
    return { ok: true };
  });
}

/**
 * Hash de la IP con una sal secreta (Propiedades del script): sirve para contar conexiones distintas,
 * pero con la planilla en la mano no se puede volver a la IP. La IP no se guarda.
 */
function ipHash(ip) {
  ip = String(ip || '');
  if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return '';
  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty('IP_SALT');
  if (!salt) {
    salt = Utilities.getUuid();
    props.setProperty('IP_SALT', salt);
  }
  return toHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ip, Utilities.Charset.UTF_8), 6);
}

// ---------------------------------------------------------------- resumen

/**
 * Arma (o rehace) la hoja `resumen` con fórmulas sobre metadata_local y player_data. Córrela una vez
 * desde el editor (elige crearResumen arriba y ▶ Ejecutar); después se actualiza sola.
 */
function crearResumen() {
  var book = privateBook();
  sheetWithHead(book, SESSIONS, SESSION_HEAD);
  sheetWithHead(book, DATA, DATA_HEAD);
  var sheet = book.getSheetByName(SUMMARY) || book.insertSheet(SUMMARY);
  sheet.clear();
  var s = lettersOf(SESSION_HEAD);
  var d = lettersOf(DATA_HEAD);
  var M = "'" + SESSIONS + "'!";
  var P = "'" + DATA + "'!";
  var colOf = function (letter) {
    return M + letter + '2:' + letter;
  };
  var query = function (range, select) {
    return '=IFERROR(QUERY(' + range + ', "' + select + '", 1), "Sin datos todavía")';
  };
  var q = function (select) {
    return query(M + 'A:' + s.puntaje, select);
  };
  var label = function (pairs) {
    return ' label ' + pairs.map(function (x) { return x[0] + " '" + x[1] + "'"; }).join(', ');
  };

  var kpis = [
    ['Jugadores distintos', '=COUNTUNIQUE(' + colOf(s.jugador) + ')'],
    ['Sesiones', '=COUNTA(' + colOf('A') + ')'],
    ['Jugadores nuevos', '=COUNTIF(' + colOf(s.nuevo) + ', "sí")'],
    ['Jugadores que volvieron (2+ sesiones)', '=IFERROR(COUNTUNIQUE(FILTER(' + colOf(s.jugador) + ', ' + colOf(s.visita) + ' >= 2)), 0)'],
    ['Minutos jugando (total)', '=SUM(' + colOf(s.jugando) + ')'],
    ['Minutos por sesión con el juego abierto (promedio)', '=IFERROR(AVERAGE(' + colOf(s.minutos) + '), 0)'],
    ['Minutos jugando por sesión (promedio)', '=IFERROR(AVERAGE(' + colOf(s.jugando) + '), 0)'],
    ['Sesiones hoy', '=COUNTIF(' + colOf(s.inicio) + ', ">=" & TODAY())'],
    ['Sesiones últimos 7 días', '=COUNTIF(' + colOf(s.inicio) + ', ">=" & (TODAY() - 7))'],
    ['Instalada como app (sesiones)', '=COUNTIF(' + colOf(s.pwa) + ', "sí")'],
    ['Jugadores con respaldo en la nube', '=COUNTA(' + P + 'A2:A)'],
  ];
  sheet.getRange(1, 1).setValue('Resumen').setFontWeight('bold').setFontSize(14);
  sheet.getRange(2, 1, kpis.length, 2).setValues(kpis);
  sheet.getRange(2, 2, kpis.length, 1).setNumberFormat('0.#');

  var where = ' where A is not null';
  var blocks = [
    ['Por país', q('select ' + s.pais + ', count(A), sum(' + s.jugando + ')' + where + ' group by ' + s.pais + ' order by count(A) desc limit 30' + label([['count(A)', 'sesiones'], ['sum(' + s.jugando + ')', 'min jugando']]))],
    ['Por ciudad', q('select ' + s.pais + ', ' + s.ciudad + ', count(A)' + where + ' group by ' + s.pais + ', ' + s.ciudad + ' order by count(A) desc limit 30' + label([['count(A)', 'sesiones']]))],
    ['Por día (últimos 30)', q('select ' + s.fecha_local + ', count(A), sum(' + s.jugando + ')' + where + ' group by ' + s.fecha_local + ' order by ' + s.fecha_local + ' desc limit 30' + label([['count(A)', 'sesiones'], ['sum(' + s.jugando + ')', 'min jugando']]))],
    ['Por hora local', q('select ' + s.hora_local + ', count(A)' + where + ' group by ' + s.hora_local + ' order by ' + s.hora_local + label([['count(A)', 'sesiones']]))],
    ['Por día de la semana', q('select ' + s.dia + ', count(A)' + where + ' group by ' + s.dia + label([['count(A)', 'sesiones']]))],
    ['Por equipo', q('select ' + s.dispositivo + ', ' + s.so + ', count(A), avg(' + s.jugando + ')' + where + ' group by ' + s.dispositivo + ', ' + s.so + ' order by count(A) desc' + label([['count(A)', 'sesiones'], ['avg(' + s.jugando + ')', 'min jugando (prom.)']]))],
    ['Por origen (?ref=)', q('select ' + s.origen + ', count(A)' + where + ' group by ' + s.origen + ' order by count(A) desc limit 30' + label([['count(A)', 'sesiones']]))],
    ['Hasta dónde llegan', query(P + 'A:' + d.minutos_juego, 'select ' + d.misiones + ', count(A), avg(' + d.minutos_juego + ')' + where + ' group by ' + d.misiones + ' order by ' + d.misiones + label([[d.misiones, 'misiones completadas'], ['count(A)', 'jugadores'], ['avg(' + d.minutos_juego + ')', 'min de partida (prom.)']]))],
  ];
  // Dos columnas de bloques desde la columna D, uno debajo del otro.
  for (var i = 0; i < blocks.length; i++) {
    var c = 4 + (i % 2) * 5;
    var r = 1 + Math.floor(i / 2) * 36;
    sheet.getRange(r, c).setValue(blocks[i][0]).setFontWeight('bold');
    sheet.getRange(r + 1, c).setFormula(blocks[i][1]);
  }
  sheet.setColumnWidth(1, 320);
}

// ---------------------------------------------------------------- utilidades

/** Donde van player_data, metadata_local y resumen. */
function privateBook() {
  return PRIVATE_SPREADSHEET_ID ? SpreadsheetApp.openById(PRIVATE_SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

/** Corre `fn` con el candado del script (las escrituras van de a una). */
function locked(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'busy' };
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** false si `what:who` llegó hace menos de COOLDOWN[what] segundos; si no, lo anota. */
function cooled(what, who) {
  var cache = CacheService.getScriptCache();
  var k = what + ':' + who;
  if (cache.get(k)) return false;
  cache.put(k, '1', COOLDOWN[what]);
  return true;
}

/** Fila (desde 1) cuya columna A es exactamente `value`, o -1. */
function findRow(sheet, value) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var cell = sheet.getRange(2, 1, last - 1, 1).createTextFinder(value).matchEntireCell(true).findNext();
  return cell ? cell.getRow() : -1;
}

/** {encabezado: índice desde 0} */
function indexOf(head) {
  var out = {};
  for (var i = 0; i < head.length; i++) out[head[i]] = i;
  return out;
}

/** {encabezado: letra de la columna} (para las fórmulas). */
function lettersOf(head) {
  var out = {};
  for (var i = 0; i < head.length; i++) out[head[i]] = columnLetter(i + 1);
  return out;
}

function columnLetter(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseJson(v) {
  try {
    var o = JSON.parse(String(v || '') || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch (err) {
    return {};
  }
}

/** Primeros 12 caracteres hex del SHA-256 de la llave. */
function hashKey(key) {
  return toHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key, Utilities.Charset.UTF_8), 6);
}

function toHex(bytes, n) {
  var hex = '';
  for (var i = 0; i < n; i++) hex += ((bytes[i] + 256) % 256).toString(16).replace(/^(.)$/, '0$1');
  return hex;
}

function cleanName(raw) {
  var name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return '';
  if (!/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÀ-ÿ ._\-]+$/.test(name)) return '';
  return name;
}

/** Texto corto de una línea, sin caracteres de control y sin que pueda ser fórmula. */
function cleanText(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return safe(s);
}

function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Evita que un texto que empieza con = + - @ se interprete como fórmula. */
function safe(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function unescapeCell(s) {
  return /^'[=+\-@]/.test(s) ? s.slice(1) : s;
}

function clampInt(v, max) {
  var n = Math.floor(Number(v));
  if (!isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function clampNum(v, max) {
  var n = Number(v);
  if (!isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n * 10) / 10, max);
}

/**
 * La hoja `name` con su fila de encabezados: la crea, o escribe los encabezados si está vacía o si
 * todavía no tiene datos (solo una fila de títulos distintos, como al crearla a mano).
 */
function sheetWithHead(ss, name, head) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var last = sheet.getLastRow();
  var stale = last === 1 && sheet.getRange(1, 1, 1, head.length).getValues()[0].join('|') !== head.join('|');
  if (last === 0 || stale) {
    if (stale) sheet.getRange(1, 1, 1, sheet.getLastColumn()).clearContent();
    sheet.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Escribe una fila; las fechas e ids van como texto para que el CSV publicado las deje tal cual. */
function writeRow(sheet, row, values) {
  var range = sheet.getRange(row, 1, 1, values.length);
  var formats = values.map(function (v) {
    return typeof v === 'number' ? '0' : '@';
  });
  range.setNumberFormats([formats]).setValues([values]);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
