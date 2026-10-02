/**
 * Short-link counter for the mmendelson.com family.
 *
 * The tracked short links (TRACKED_SHORT_LINKS in build.py — mmendelson.com/1
 * and whatever follows it) are printed on paper and put into QR codes, so the
 * one question they exist to answer is "how many people came in through THIS
 * link". GA4 cannot answer it: the stub defaults to Consent Mode denied and
 * shows no banner, and for a property this size GA4 drops every un-consented
 * hit from its reports (it keeps them only as input to behavioral modeling,
 * which needs >= 1,000 denied events a day to switch on). Measured on the live
 * /1/ stub: a first-time visitor's page_view and short_link_click both go out
 * as gcs=G100 — which is to say, almost every card that gets scanned.
 *
 * So each stub also POSTs one row here, and the row carries only COARSE
 * categories: the time, the code, the destination, the browser language, the
 * device type (celular/tablet/computador), the OS family and the browser
 * family — each checked against a closed list below, no versions, no device
 * model — plus the device's time zone and the country estimated from it
 * (Zones.js; no IP, no third-party lookup). No cookie is set or read (the stub
 * sends with credentials:'omit', so not even a Google login cookie travels
 * with it), and Apps Script never sees the caller's IP address.
 *
 * Container-bound to its spreadsheet ("Short links - mmendelson.com", in the
 * owner's "Garmin spreadsheets" folder); the only OAuth scope is
 * spreadsheets.currentonly — this script can touch its own sheet and nothing
 * else in the account, which matters for code that anyone may call.
 *
 *   doPost  code, to, lang, type, os, browser, tz [, test=1]
 *                                       -> appends a row (test=1: to "Teste")
 *   doGet                               -> health only; reads and writes nothing
 *   setup()                             -> creates the tabs and the Resumo
 *                                          formulas, and sets the sheet's time
 *                                          zone. Runs by itself on the first POST
 *                                          after a deploy that bumped
 *                                          SETUP_VERSION, so nobody has to
 *                                          remember it; re-runnable from the editor.
 */

var TAB_HITS = 'Acessos';
var TAB_TEST = 'Teste';
var TAB_SUMMARY = 'Resumo';
var TAB_TEST_SUMMARY = 'Teste resumo';
// A:I. The QUERYs in summary_ name these columns by letter.
var HEADER = ['Data/hora', 'Código', 'Destino', 'Idioma', 'Tipo', 'Sistema',
              'Navegador', 'Fuso horário', 'País (estimado)'];

// The stub classifies the user agent into these and nothing finer; anything
// else becomes an empty cell. Closed lists, so the anonymous endpoint cannot
// be used to write free text into the sheet. tools/test_stub.js checks every
// value the stub can emit is on its list.
var TYPES = ['celular', 'tablet', 'computador'];
var OSES = ['Android', 'iOS', 'iPadOS', 'Windows', 'macOS', 'ChromeOS', 'Linux',
            'outro'];
var BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Samsung Internet', 'Edge',
                'Opera', 'Instagram', 'Facebook', 'outro'];
// IANA zone: "America/Sao_Paulo", "America/Argentina/Buenos_Aires", "UTC".
var TZ_RE = /^[A-Za-z]+(\/[A-Za-z0-9_+-]+){0,2}$/;

// A code is the slug of a TRACKED_SHORT_LINKS entry: digits only, appended in
// order, never reused. Anything else is not one of ours and is refused rather
// than counted — the endpoint is anonymous, so the shape check is the only
// thing between it and junk rows.
var CODE_RE = /^[0-9]{1,4}$/;
// `to_site` vocabulary from build.py: home/apps/run, or a bare host.
var TO_RE = /^[a-z0-9][a-z0-9.-]{0,62}$/;
// navigator.language: "pt-BR", "en", "zh-Hans-CN". Anything else is dropped
// to an empty cell rather than refusing the hit — the count is what matters.
var LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;

function doPost(e) {
  var p = (e && e.parameter) || {};
  var code = String(p.code || '');
  var to = String(p.to || '');
  var lang = String(p.lang || '');
  if (!CODE_RE.test(code)) return json_({ result: 'BAD_CODE' });
  if (!TO_RE.test(to)) return json_({ result: 'BAD_TO' });
  if (!LANG_RE.test(lang)) lang = '';
  var tz = String(p.tz || '');
  if (tz.length > 40 || !TZ_RE.test(tz)) tz = '';
  var country = (tz && typeof ZONE_COUNTRY !== 'undefined' &&
                 Object.prototype.hasOwnProperty.call(ZONE_COUNTRY, tz))
    ? ZONE_COUNTRY[tz] : '';
  // test=1 proves the whole path — anonymous POST, the OAuth grant, the
  // sheet, the write — without adding a row anyone would count.
  var tab = p.test === '1' ? TAB_TEST : TAB_HITS;
  // Code as text ('1', not 1): the Resumo QUERYs group on it, and a column of
  // numbers would turn a future code like '01' into 1.
  var sheet = tab_(tab);
  sheet.appendRow([new Date(), "'" + code, to, lang,
                   pick_(p.type, TYPES), pick_(p.os, OSES),
                   pick_(p.browser, BROWSERS), tz, country]);
  // Count FIRST, then tidy: a setup that fails (two first hits racing to
  // create Resumo) must never cost the hit that triggered it.
  try {
    if (needsSetup_(sheet.getParent())) setup();
  } catch (err) {}
  return json_({ result: 'OK', tab: tab });
}

function doGet() {
  return json_({ result: 'OK', service: 'short-link-counter' });
}

// Bump when setup() changes: the next POST then re-runs it on the live sheet,
// so a fix to the tabs or formulas reaches production with the deploy alone.
var SETUP_VERSION = '5';

function setup() {
  var hits = tab_(TAB_HITS);
  var test = tab_(TAB_TEST);
  var s = tab_(TAB_SUMMARY, true);
  var ts = tab_(TAB_TEST_SUMMARY, true);
  var book = s.getParent();
  // The rows store instants; the sheet decides what clock they are shown in
  // and what "a day" is in Resumo. A sheet created through the Drive API
  // comes up on Pacific time, so align it with the script (appsscript.json).
  book.setSpreadsheetTimeZone(Session.getScriptTimeZone());
  // Up to v4 Teste carried its own summary formulas from column F on, which
  // is where the v5 data columns now are. Clear FORMULA cells only (their
  // spilled results go with them); a row's data is never a formula, so this
  // can run on every setup without touching a single hit.
  clearFormulas_(test);
  // Header row of both data tabs: older rows simply have the new columns
  // empty.
  [hits, test].forEach(function (sh) {
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  });
  // The same summary over Acessos and over Teste: a test=1 POST then proves
  // the formulas against real rows without adding a count to Acessos.
  [[s, TAB_HITS], [ts, TAB_TEST]].forEach(function (pair) {
    pair[0].clear();
    summary_(pair[0], pair[1]);
  });
  // Resumo first. Cosmetic, so it may not fail the setup.
  try { book.setActiveSheet(s); book.moveActiveSheet(1); } catch (e) {}
  // A new spreadsheet comes with an empty "Página1"; drop any EMPTY tab that
  // is not one of ours. A tab with anything in it is never touched.
  var ours = [TAB_HITS, TAB_TEST, TAB_SUMMARY, TAB_TEST_SUMMARY];
  book.getSheets().forEach(function (sh) {
    if (ours.indexOf(sh.getName()) < 0 && sh.getLastRow() === 0) {
      book.deleteSheet(sh);
    }
  });
  s.getDeveloperMetadata().forEach(function (m) {
    if (m.getKey() === 'setup') m.remove();
  });
  s.addDeveloperMetadata('setup', SETUP_VERSION);
  return 'OK';
}

function needsSetup_(book) {
  var s = book.getSheetByName(TAB_SUMMARY);
  if (!s) return true;
  return !s.getDeveloperMetadata().some(function (m) {
    return m.getKey() === 'setup' && m.getValue() === SETUP_VERSION;
  });
}

// One block per question, side by side, each two columns wide with a blank
// column between; per-day goes LAST because its pivot grows one column per
// code, rightwards into nothing. Wrapped in IFERROR only for the empty sheet
// (QUERY over no rows is an error, not an empty table): a formula that does
// not PARSE is #ERROR! whatever wraps it, and writeFormula_ relies on that.
var SUMMARY = [
  ['A1', "select B, count(A) where B <> '' group by B " +
         "label B 'Código', count(A) 'Acessos'"],
  ['D1', byCount_('E', 'Tipo')],
  ['G1', byCount_('F', 'Sistema')],
  ['J1', byCount_('G', 'Navegador')],
  ['M1', byCount_('I', 'País (estimado)')],
  ['P1', byCount_('D', 'Idioma')],
  ['S1', "select toDate(A), count(A) where B <> '' group by toDate(A) " +
         "pivot B order by toDate(A) desc label toDate(A) 'Dia'"]
];
var DAY_COLUMN = 'S2:S';

function byCount_(col, label) {
  return 'select ' + col + ", count(A) where B <> '' group by " + col +
    ' order by count(A) desc label ' + col + " '" + label +
    "', count(A) 'Acessos'";
}

function summary_(sheet, src) {
  // The per-day pivot needs room to grow; a new tab has 26 columns.
  if (sheet.getMaxColumns() < 40) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 40 - sheet.getMaxColumns());
  }
  SUMMARY.forEach(function (b) {
    writeFormula_(sheet.getRange(b[0]), '=IFERROR(QUERY(' + src + '!A:I, "' +
      b[1] + '", 1), "Ainda sem acessos")');
  });
  // QUERY's own `format` clause did not reach the cells (measured: the day
  // column of the live sheet still showed serials like 46297), so the column
  // the per-day pivot writes into is formatted directly.
  sheet.getRange(DAY_COLUMN).setNumberFormat('dd/MM/yyyy');
}

function clearFormulas_(sheet) {
  var range = sheet.getDataRange();
  var f = range.getFormulas();
  for (var r = 0; r < f.length; r++) {
    for (var c = 0; c < f[r].length; c++) {
      if (f[r][c]) sheet.getRange(r + 1, c + 1).clearContent();
    }
  }
}

function pick_(v, list) {
  v = String(v || '');
  return list.indexOf(v) >= 0 ? v : '';
}

// Whether setFormula wants the spreadsheet locale's argument separator (";"
// in pt_BR) or always the English ",": not settled by any documentation we
// trust. Measured on the live pt_BR sheet: with "," all three cells were
// #ERROR! — including the per-code QUERY, which over the same empty data now
// renders its header — so this sheet wanted ";". Ask the sheet rather than
// assume: write ",", and if it does not parse, write ";". Separators inside
// the quoted query text are left alone.
function writeFormula_(range, f) {
  range.setFormula(f);
  SpreadsheetApp.flush();
  if (range.getDisplayValue() === '#ERROR!') range.setFormula(semicolons_(f));
}

function semicolons_(f) {
  var out = '', quoted = false;
  for (var i = 0; i < f.length; i++) {
    var c = f.charAt(i);
    if (c === '"') quoted = !quoted;
    out += (c === ',' && !quoted) ? ';' : c;
  }
  return out;
}

function tab_(name, noHeader) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    if (!noHeader) {
      sheet.appendRow(HEADER);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
