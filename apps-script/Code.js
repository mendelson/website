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
 * So each stub also POSTs one row here, and the row carries NOTHING that
 * identifies a person: the time, the code, the destination and the browser
 * language. No cookie is set or read (the stub sends with credentials:'omit',
 * so not even a Google login cookie travels with it), and Apps Script never
 * sees the caller's IP address. That is what lets it count without consent.
 *
 * Container-bound to its spreadsheet ("Short links - mmendelson.com", in the
 * owner's "Garmin spreadsheets" folder); the only OAuth scope is
 * spreadsheets.currentonly — this script can touch its own sheet and nothing
 * else in the account, which matters for code that anyone may call.
 *
 *   doPost  code, to, lang [, test=1]  -> appends a row (test=1: to "Teste")
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
var HEADER = ['Data/hora', 'Código', 'Destino', 'Idioma'];

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
  // test=1 proves the whole path — anonymous POST, the OAuth grant, the
  // sheet, the write — without adding a row anyone would count.
  var tab = p.test === '1' ? TAB_TEST : TAB_HITS;
  // Code as text ('1', not 1): the Resumo QUERYs group on it, and a column of
  // numbers would turn a future code like '01' into 1.
  var sheet = tab_(tab);
  sheet.appendRow([new Date(), "'" + code, to, lang]);
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
var SETUP_VERSION = '4';

function setup() {
  tab_(TAB_HITS);
  var test = tab_(TAB_TEST);
  var s = tab_(TAB_SUMMARY, true);
  var book = s.getParent();
  // The rows store instants; the sheet decides what clock they are shown in
  // and what "a day" is in Resumo. A sheet created through the Drive API
  // comes up on Pacific time, so align it with the script (appsscript.json).
  book.setSpreadsheetTimeZone(Session.getScriptTimeZone());
  s.clear();
  // Per-day goes LAST: its pivot grows one column per code, rightwards into
  // nothing.
  summary_(s, ['A1', 'D1', 'G1'], TAB_HITS);
  // QUERY's own `format` clause did not reach the cells (measured: the day
  // column of the live sheet still showed serials like 46297), so the column
  // the per-day pivot writes into is formatted directly.
  s.getRange('G2:G').setNumberFormat('dd/MM/yyyy');
  // The same three formulas over Teste, beside its rows: a test=1 POST then
  // proves the formulas against real rows without adding a count to Acessos.
  test.getRange('F:Z').clear();
  summary_(test, ['F1', 'I1', 'L1'], TAB_TEST);
  test.getRange('L2:L').setNumberFormat('dd/MM/yyyy');
  // Resumo first. Cosmetic, so it may not fail the setup.
  try { book.setActiveSheet(s); book.moveActiveSheet(1); } catch (e) {}
  // A new spreadsheet comes with an empty "Página1"; drop any EMPTY tab that
  // is not one of ours. A tab with anything in it is never touched.
  book.getSheets().forEach(function (sh) {
    var n = sh.getName();
    if (n !== TAB_HITS && n !== TAB_TEST && n !== TAB_SUMMARY &&
        sh.getLastRow() === 0) book.deleteSheet(sh);
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

// Per code, per language, and per day (one column per code). Wrapped in
// IFERROR only for the empty sheet (QUERY over no rows is an error, not an
// empty table): a formula that does not PARSE is #ERROR! whatever wraps it,
// and writeFormula_ relies on exactly that.
function summary_(sheet, cells, src) {
  var r = src + '!A:D';
  var q = [
    "select B, count(A) where B <> '' group by B " +
      "label B 'Código', count(A) 'Acessos'",
    "select D, count(A) where B <> '' group by D order by count(A) desc " +
      "label D 'Idioma', count(A) 'Acessos'",
    "select toDate(A), count(A) where B <> '' group by toDate(A) pivot B " +
      "order by toDate(A) desc label toDate(A) 'Dia'"
  ];
  for (var i = 0; i < cells.length; i++) {
    writeFormula_(sheet.getRange(cells[i]),
      '=IFERROR(QUERY(' + r + ', "' + q[i] + '", 1), "Ainda sem acessos")');
  }
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
