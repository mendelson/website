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
 * Container-bound to its spreadsheet; the only OAuth scope is
 * spreadsheets.currentonly — this script can touch its own sheet and nothing
 * else in the account.
 *
 *   doPost  code, to, lang [, test=1]  -> appends a row (test=1: to "Teste")
 *   doGet                               -> health only; reads and writes nothing
 *   setup()                             -> run once from the editor: creates the
 *                                          tabs and the Resumo formulas, and is
 *                                          the step that grants the OAuth scope
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
  // test=1 proves the whole path — anonymous POST, the OAuth grant, the bound
  // sheet, the write — without adding a row anyone would count.
  var tab = p.test === '1' ? TAB_TEST : TAB_HITS;
  // Code as text ('1', not 1): the Resumo QUERYs group on it, and a column of
  // numbers would turn a future code like '01' into 1.
  tab_(tab).appendRow([new Date(), "'" + code, to, lang]);
  return json_({ result: 'OK', tab: tab });
}

function doGet() {
  return json_({ result: 'OK', service: 'short-link-counter' });
}

function setup() {
  tab_(TAB_HITS);
  tab_(TAB_TEST);
  var s = tab_(TAB_SUMMARY, true);
  s.clear();
  // setFormula takes the English spelling (commas, English names) whatever
  // the spreadsheet's locale is; the sheet shows it in its own.
  // B is a text column, so an empty cell is '' rather than null — `is not
  // null` would count every blank row below the data.
  s.getRange('A1').setFormula(
    '=QUERY(Acessos!A:D, "select B, count(A) where B <> \'\' group by B ' +
    "label B 'Código', count(A) 'Acessos'\", 1)");
  s.getRange('D1').setFormula(
    '=QUERY(Acessos!A:D, "select toDate(A), count(A) where B <> \'\' ' +
    'group by toDate(A) pivot B order by toDate(A) desc ' +
    "label toDate(A) 'Dia'\", 1)");
  s.getRange('J1').setFormula(
    '=QUERY(Acessos!A:D, "select D, count(A) where B <> \'\' group by D ' +
    "order by count(A) desc label D 'Idioma', count(A) 'Acessos'\", 1)");
  var book = s.getParent();
  book.setActiveSheet(s);
  book.moveActiveSheet(1);
  // A new spreadsheet comes with an empty "Página1"; drop any EMPTY tab that
  // is not one of ours. A tab with anything in it is never touched.
  book.getSheets().forEach(function (sh) {
    var n = sh.getName();
    if (n !== TAB_HITS && n !== TAB_TEST && n !== TAB_SUMMARY &&
        sh.getLastRow() === 0) book.deleteSheet(sh);
  });
  return 'OK';
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
