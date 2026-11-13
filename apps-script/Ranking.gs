/**
 * It's About Time — ranking y votos.
 *
 * Aplicación web que escribe en las hojas `players_info` y `comments` de esta planilla. El juego
 * LEE la planilla publicada en la web (CSV) y ESCRIBE solo a través de este script.
 * Instalación: docs/ranking.md.
 *
 * Sin login: cada navegador manda una llave secreta al azar; en la planilla (que es pública) se
 * guarda solo un hash de esa llave, así nadie puede escribir en la fila de otro.
 */

var PLAYERS = 'players_info';
var COMMENTS = 'comments';
var PLAYER_HEAD = ['id', 'nombre', 'puntaje', 'misiones', 'total', 'actualizado', 'creado'];
var COMMENT_HEAD = ['fecha', 'id', 'nombre', 'estrellas', 'comentario', 'puntaje', 'misiones'];
var NAME_MIN = 2;
var NAME_MAX = 16;
var COMMENT_MAX = 280;
/** Topes de cordura para lo que manda el cliente (el juego tiene bastante menos). */
var MAX_SCORE = 5000;
var MAX_MISSIONS = 100;
/** Segundos mínimos entre envíos del mismo jugador. */
var COOLDOWN = { score: 5, vote: 30 };

function doGet() {
  return json({ ok: true, service: 'its-about-time-ranking' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'bad_request' });
  }
  var action = body.action === 'vote' ? 'vote' : 'score';
  var key = String(body.key || '');
  if (!/^[0-9a-f]{32}$/.test(key)) return json({ ok: false, error: 'bad_request' });
  var id = hashKey(key);

  var name = cleanName(body.name);
  if (!name) return json({ ok: false, error: 'bad_name' });

  var cache = CacheService.getScriptCache();
  var coolKey = action + ':' + id;
  if (cache.get(coolKey)) return json({ ok: false, error: 'too_fast' });

  var score = clampInt(body.score, MAX_SCORE);
  var missions = clampInt(body.missions, MAX_MISSIONS);
  var total = clampInt(body.total, MAX_SCORE);
  var stars = clampInt(body.stars, 5);
  if (action === 'vote' && stars < 1) return json({ ok: false, error: 'bad_request' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json({ ok: false, error: 'busy' });
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var players = sheetWithHead(ss, PLAYERS, PLAYER_HEAD);
    var now = new Date().toISOString();

    var data = players.getDataRange().getValues();
    var row = -1;
    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][0]);
      if (rowId === id) row = i + 1;
      else if (normalize(unescapeCell(String(data[i][1]))) === normalize(name)) {
        return json({ ok: false, error: 'name_taken' });
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
  } finally {
    lock.releaseLock();
  }

  cache.put(coolKey, '1', COOLDOWN[action]);
  return json({ ok: true, id: id });
}

/** Primeros 12 caracteres hex del SHA-256 de la llave. */
function hashKey(key) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < 6; i++) hex += ((bytes[i] + 256) % 256).toString(16).replace(/^(.)$/, '0$1');
  return hex;
}

function cleanName(raw) {
  var name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return '';
  if (!/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÀ-ÿ ._\-]+$/.test(name)) return '';
  return name;
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

/** La hoja `name` con su fila de encabezados (la crea o la completa si está vacía). Todo como texto plano. */
function sheetWithHead(ss, name, head) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
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
