// Offline test of Code.js against a mocked SpreadsheetApp/ContentService.
//   node tools/test_counter.js
// Asserts a count, never just an exit status: a test file that ran nothing
// must not read as a pass.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeBook() {
  const sheets = [];
  const mk = (name) => {
    const sh = {
      name, rows: [], formulas: {}, frozen: 0,
      getName: () => name,
      appendRow: (r) => sh.rows.push(r.slice()),
      setFrozenRows: (n) => { sh.frozen = n; },
      getLastRow: () => sh.rows.length,
      clear: () => { sh.rows = []; sh.formulas = {}; },
      getRange: (a1) => ({ setFormula: (f) => { sh.formulas[a1] = f; } }),
      getParent: () => book,
    };
    return sh;
  };
  const book = {
    sheets,
    getSheetByName: (n) => sheets.find((s) => s.name === n) || null,
    insertSheet: (n) => { const s = mk(n); sheets.push(s); return s; },
    getSheets: () => sheets.slice(),
    deleteSheet: (s) => sheets.splice(sheets.indexOf(s), 1),
    setActiveSheet: (s) => { book.active = s; },
    moveActiveSheet: (i) => { sheets.splice(sheets.indexOf(book.active), 1); sheets.splice(i - 1, 0, book.active); },
  };
  sheets.push(mk('Página1'));
  return book;
}

function load(book) {
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => book },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8'), ctx);
  return ctx;
}

let ran = 0, failed = 0;
function t(name, fn) {
  ran++;
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); }
}
function eq(a, b, what) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(what + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(b));
}
const post = (g, parameter) => JSON.parse(g.doPost({ parameter }).text);

t('a valid hit is counted, code kept as text', () => {
  const b = makeBook(), g = load(b);
  eq(post(g, { code: '1', to: 'apps', lang: 'pt-BR' }), { result: 'OK', tab: 'Acessos' }, 'reply');
  const s = b.getSheetByName('Acessos');
  eq(s.rows[0], ['Data/hora', 'Código', 'Destino', 'Idioma'], 'header');
  eq(s.rows.length, 2, 'rows');
  eq(s.rows[1].slice(1), ["'1", 'apps', 'pt-BR'], 'row');
  if (!(s.rows[1][0] instanceof Date) && Object.prototype.toString.call(s.rows[1][0]) !== '[object Date]') throw new Error('no timestamp');
});

t('test=1 writes to Teste, never to Acessos', () => {
  const b = makeBook(), g = load(b);
  eq(post(g, { code: '1', to: 'apps', lang: 'en', test: '1' }), { result: 'OK', tab: 'Teste' }, 'reply');
  eq(b.getSheetByName('Acessos'), null, 'Acessos created');
  eq(b.getSheetByName('Teste').rows.length, 2, 'Teste rows');
});

t('junk codes are refused, nothing written', () => {
  const b = makeBook(), g = load(b);
  for (const code of ['', 'abc', '12345', '1;DROP', '=1+1', undefined]) {
    eq(post(g, { code, to: 'apps' }).result, 'BAD_CODE', 'code ' + code);
  }
  eq(b.getSheetByName('Acessos'), null, 'Acessos created');
});

t('junk destinations are refused', () => {
  const b = makeBook(), g = load(b);
  for (const to of ['', 'APPS', '=HYPERLINK("x")', 'a'.repeat(70)]) {
    eq(post(g, { code: '1', to }).result, 'BAD_TO', 'to ' + to);
  }
  eq(post(g, { code: '1', to: 'example.com' }).result, 'OK', 'bare host');
});

t('an odd language is blanked, not refused (no formula injection)', () => {
  const b = makeBook(), g = load(b);
  for (const lang of ['=IMPORTXML("x")', 'pt_BR', 'x'.repeat(40), undefined]) {
    eq(post(g, { code: '1', to: 'apps', lang }).result, 'OK', 'lang ' + lang);
  }
  for (const r of b.getSheetByName('Acessos').rows.slice(1)) eq(r[3], '', 'lang cell');
  eq(post(g, { code: '1', to: 'apps', lang: 'zh-Hans-CN' }).result, 'OK', 'zh');
  eq(b.getSheetByName('Acessos').rows.slice(-1)[0][3], 'zh-Hans-CN', 'kept');
});

t('doGet reads and writes nothing', () => {
  const b = makeBook(), g = load(b);
  eq(JSON.parse(g.doGet({ parameter: { code: '1', to: 'apps' } }).text), { result: 'OK', service: 'short-link-counter' }, 'reply');
  eq(b.sheets.map((s) => s.name), ['Página1'], 'sheets');
});

t('setup builds Resumo first, keeps data, drops only empty strangers', () => {
  const b = makeBook(), g = load(b);
  b.insertSheet('Notas').appendRow(['keep me']);
  post(g, { code: '1', to: 'apps', lang: 'en' });
  eq(g.setup(), 'OK', 'setup');
  eq(b.sheets.map((s) => s.name), ['Resumo', 'Notas', 'Acessos', 'Teste'], 'tabs');
  eq(b.getSheetByName('Acessos').rows.length, 2, 'data kept');
  const f = b.getSheetByName('Resumo').formulas;
  eq(Object.keys(f).sort(), ['A1', 'D1', 'J1'], 'formulas');
  for (const k in f) if (!/^=QUERY\(Acessos!A:D, "select .* where B <> '' .*", 1\)$/.test(f[k])) throw new Error('formula ' + k + ': ' + f[k]);
  eq(g.setup(), 'OK', 'setup is idempotent');
  eq(b.sheets.map((s) => s.name), ['Resumo', 'Notas', 'Acessos', 'Teste'], 'tabs again');
});

console.log(`\nRan ${ran} tests, ${failed} failed.`);
process.exit(ran > 0 && failed === 0 ? 0 : 1);
