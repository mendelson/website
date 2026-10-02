// Offline test of apps-script/ (Zones.js + Code.js) against a mocked
// SpreadsheetApp/ContentService.
//   node tools/test_counter.js
// Asserts a count, never just an exit status: a test file that ran nothing
// must not read as a pass.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'apps-script');
const HEADER9 = ['Data/hora', 'Código', 'Destino', 'Idioma', 'Tipo', 'Sistema',
                 'Navegador', 'Fuso horário', 'País (estimado)'];

// "F1" -> [1, 6]
function rc(a1) {
  const m = a1.match(/^([A-Z]+)(\d+)/);
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return [Number(m[2]), c];
}
function a1(r, c) {
  let s = '';
  for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s + r;
}

// `semicolonLocale` mimics a pt_BR sheet IF setFormula parses in the sheet's
// locale: a formula with a "," outside its quoted text does not parse there.
function makeBook(semicolonLocale) {
  const sheets = [];
  const unquotedComma = (f) => f.replace(/"[^"]*"/g, '').includes(',');
  const mk = (name) => {
    const sh = {
      name, rows: [], formulas: {}, formats: {}, frozen: 0, meta: [], maxCols: 26,
      getName: () => name,
      appendRow: (r) => sh.rows.push(r.slice()),
      setFrozenRows: (n) => { sh.frozen = n; },
      getLastRow: () => Math.max(sh.rows.length, ...Object.keys(sh.formulas).map((k) => rc(k)[0]), 0),
      clear: () => { sh.rows = []; sh.formulas = {}; sh.formats = {}; },
      getMaxColumns: () => sh.maxCols,
      insertColumnsAfter: (after, n) => { sh.maxCols += n; },
      getRange: (a, col) => {
        const key = typeof a === 'string' ? a : a1(a, col);
        return {
          setFormula: (f) => { sh.formulas[key] = f; },
          getDisplayValue: () => (semicolonLocale && unquotedComma(sh.formulas[key] || '')) ? '#ERROR!' : 'ok',
          setNumberFormat: (f) => { sh.formats[key] = f; },
          clearContent: () => { delete sh.formulas[key]; },
          setValues: (v) => {
            const [r, c] = rc(key);
            while (sh.rows.length < r) sh.rows.push([]);
            v[0].forEach((x, i) => { sh.rows[r - 1][c - 1 + i] = x; });
          },
        };
      },
      getDataRange: () => ({
        getFormulas: () => {
          const keys = Object.keys(sh.formulas).map(rc);
          const R = Math.max(sh.rows.length, ...keys.map((k) => k[0]), 1);
          const C = Math.max(...sh.rows.map((r) => r.length), ...keys.map((k) => k[1]), 1);
          const g = Array.from({ length: R }, () => Array(C).fill(''));
          for (const k of Object.keys(sh.formulas)) { const [r, c] = rc(k); g[r - 1][c - 1] = sh.formulas[k]; }
          return g;
        },
      }),
      getParent: () => book,
      getDeveloperMetadata: () => sh.meta.map((m) => ({ getKey: () => m.k, getValue: () => m.v, remove: () => sh.meta.splice(sh.meta.indexOf(m), 1) })),
      addDeveloperMetadata: (k, v) => sh.meta.push({ k, v }),
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
    setSpreadsheetTimeZone: (tz) => { book.tz = tz; },
    moveActiveSheet: (i) => { sheets.splice(sheets.indexOf(book.active), 1); sheets.splice(i - 1, 0, book.active); },
  };
  sheets.push(mk('Página1'));
  return book;
}

// Apps Script runs every file of the project in one global scope.
function load(book, files = ['Zones.js', 'Code.js']) {
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => book, flush: () => {} },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }),
    },
  };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx);
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
const FULL = { code: '1', to: 'apps', lang: 'pt-BR', type: 'celular', os: 'Android', browser: 'Chrome', tz: 'America/Sao_Paulo' };

t('a valid hit is counted with every coarse field, code kept as text', () => {
  const b = makeBook(), g = load(b);
  eq(post(g, FULL), { result: 'OK', tab: 'Acessos' }, 'reply');
  const s = b.getSheetByName('Acessos');
  eq(s.rows[0], HEADER9, 'header');
  eq(s.rows.length, 2, 'rows');
  eq(s.rows[1].slice(1), ["'1", 'apps', 'pt-BR', 'celular', 'Android', 'Chrome', 'America/Sao_Paulo', 'Brasil'], 'row');
  if (Object.prototype.toString.call(s.rows[1][0]) !== '[object Date]') throw new Error('no timestamp');
});

t('the country is estimated from the zone, legacy names included', () => {
  const b = makeBook(), g = load(b);
  for (const [tz, country] of [['Asia/Calcutta', 'Índia'], ['Europe/Lisbon', 'Portugal'], ['America/Manaus', 'Brasil'], ['Mars/Olympus', ''], ['UTC', '']]) {
    post(g, Object.assign({}, FULL, { tz }));
    eq(b.getSheetByName('Acessos').rows.slice(-1)[0].slice(7), [tz, country], tz);
  }
});

t('anything off the closed lists is blanked, never written as text', () => {
  const b = makeBook(), g = load(b);
  post(g, Object.assign({}, FULL, { type: 'phone', os: 'Android 14', browser: '=IMPORTXML("x")', tz: '=1+1' }));
  eq(b.getSheetByName('Acessos').rows[1].slice(4), ['', '', '', '', ''], 'off-list');
  post(g, Object.assign({}, FULL, { tz: 'America/' + 'x'.repeat(40) }));
  eq(b.getSheetByName('Acessos').rows[2].slice(7), ['', ''], 'too long');
  post(g, { code: '1', to: 'apps' });
  eq(b.getSheetByName('Acessos').rows[3].slice(3), ['', '', '', '', '', ''], 'old stub, no fields');
});

t('without Zones.js the hit is still counted, country blank', () => {
  const b = makeBook(), g = load(b, ['Code.js']);
  eq(post(g, FULL).result, 'OK', 'reply');
  eq(b.getSheetByName('Acessos').rows[1][8], '', 'country');
});

t('test=1 writes to Teste, never counts in Acessos', () => {
  const b = makeBook(), g = load(b);
  eq(post(g, Object.assign({ test: '1' }, FULL)), { result: 'OK', tab: 'Teste' }, 'reply');
  eq(b.getSheetByName('Acessos').rows.length, 1, 'Acessos has only its header');
  eq(b.getSheetByName('Teste').rows.length, 2, 'Teste rows');
  eq(b.getSheetByName('Teste').rows[1][8], 'Brasil', 'Teste row complete');
});

t('the first POST builds both summaries and the time zone by itself', () => {
  const b = makeBook(), g = load(b);
  post(g, FULL);
  eq(b.sheets.map((s) => s.name), ['Resumo', 'Acessos', 'Teste', 'Teste resumo'], 'tabs');
  eq(b.tz, 'America/Sao_Paulo', 'time zone');
  for (const [tab, src] of [['Resumo', 'Acessos'], ['Teste resumo', 'Teste']]) {
    const sh = b.getSheetByName(tab), f = sh.formulas;
    eq(Object.keys(f).sort(), ['A1', 'D1', 'G1', 'J1', 'M1', 'P1', 'S1'], tab + ' blocks');
    for (const k in f) {
      if (!new RegExp('^=IFERROR\\(QUERY\\(' + src + "!A:I, \"select .* where B <> '' .*\", 1\\), \"Ainda sem acessos\"\\)$").test(f[k])) throw new Error(tab + ' ' + k + ': ' + f[k]);
    }
    for (const [cell, col, label] of [['D1', 'E', 'Tipo'], ['G1', 'F', 'Sistema'], ['J1', 'G', 'Navegador'], ['M1', 'I', 'País (estimado)'], ['P1', 'D', 'Idioma']]) {
      if (!f[cell].includes('select ' + col + ', count(A)') || !f[cell].includes("label " + col + " '" + label + "'")) throw new Error(tab + ' ' + cell + ' is not ' + label);
    }
    eq(sh.formats, { 'S2:S': 'dd/MM/yyyy' }, tab + ' day column');
    if (sh.maxCols < 40) throw new Error(tab + ' has no room for the pivot');
  }
  post(g, FULL);
  eq(b.getSheetByName('Acessos').rows.length, 3, 'second hit counted');
});

t('upgrading a v4 sheet: old Teste formulas go, every data row stays', () => {
  const b = makeBook(), g = load(b);
  // The live sheet as v4 left it: 4-column header and rows, Teste carrying
  // its summary formulas in F1/I1/L1, Resumo marked v4.
  const acc = b.insertSheet('Acessos');
  acc.rows = [['Data/hora', 'Código', 'Destino', 'Idioma'], [new Date(), "'1", 'apps', 'pt-BR']];
  const te = b.insertSheet('Teste');
  te.rows = [['Data/hora', 'Código', 'Destino', 'Idioma'], [new Date(), "'1", 'apps', 'pt-BR']];
  te.formulas = { F1: '=old', I1: '=old', L1: '=old' };
  const re = b.insertSheet('Resumo');
  re.meta = [{ k: 'setup', v: '4' }];
  post(g, Object.assign({ test: '1' }, FULL));
  eq(te.formulas, {}, 'old Teste formulas');
  eq(te.rows[0], HEADER9, 'Teste header');
  eq(acc.rows[0], HEADER9, 'Acessos header');
  eq(acc.rows[1].slice(1), ["'1", 'apps', 'pt-BR'], 'old Acessos row untouched');
  eq(te.rows.length, 3, 'old Teste row kept, new one added');
  eq(te.rows[2].length, 9, 'new row has every column');
  eq(re.meta, [{ k: 'setup', v: '5' }], 'marker');
  if (!b.getSheetByName('Teste resumo')) throw new Error('no Teste resumo');
});

t('a sheet that rejects "," gets ";" — outside the quoted query only', () => {
  const b = makeBook(true), g = load(b);
  post(g, FULL);
  const f = b.getSheetByName('Resumo').formulas.A1;
  eq(f, '=IFERROR(QUERY(Acessos!A:I; "select B, count(A) where B <> \'\' group by B label B \'Código\', count(A) \'Acessos\'"; 1); "Ainda sem acessos")', 'A1');
});

t('a sheet that takes "," keeps ","', () => {
  const b = makeBook(false), g = load(b);
  post(g, FULL);
  if (b.getSheetByName('Resumo').formulas.A1.includes(';')) throw new Error('semicolons written');
});

t('setup re-runs once per SETUP_VERSION, not on every hit', () => {
  const b = makeBook(), g = load(b);
  post(g, FULL);
  b.getSheetByName('Resumo').formulas.A1 = 'stale';
  post(g, FULL);
  eq(b.getSheetByName('Resumo').formulas.A1, 'stale', 'no re-run at the same version');
  b.getSheetByName('Resumo').meta[0].v = '1';
  post(g, FULL);
  if (b.getSheetByName('Resumo').formulas.A1 === 'stale') throw new Error('old version not re-run');
  eq(b.getSheetByName('Resumo').meta.length, 1, 'one version marker');
});

t('a failing setup never costs the hit', () => {
  const b = makeBook(), g = load(b);
  const insert = b.insertSheet;
  b.insertSheet = (n) => { if (n === 'Resumo') throw new Error('race'); return insert(n); };
  eq(post(g, FULL).result, 'OK', 'reply');
  eq(b.getSheetByName('Acessos').rows.length, 2, 'hit counted');
});

t('junk codes are refused, nothing written', () => {
  const b = makeBook(), g = load(b);
  for (const code of ['', 'abc', '12345', '1;DROP', '=1+1', undefined]) {
    eq(post(g, Object.assign({}, FULL, { code })).result, 'BAD_CODE', 'code ' + code);
  }
  eq(b.getSheetByName('Acessos'), null, 'Acessos created');
});

t('junk destinations are refused', () => {
  const b = makeBook(), g = load(b);
  for (const to of ['', 'APPS', '=HYPERLINK("x")', 'a'.repeat(70)]) {
    eq(post(g, Object.assign({}, FULL, { to })).result, 'BAD_TO', 'to ' + to);
  }
  eq(post(g, Object.assign({}, FULL, { to: 'example.com' })).result, 'OK', 'bare host');
});

t('an odd language is blanked, not refused (no formula injection)', () => {
  const b = makeBook(), g = load(b);
  for (const lang of ['=IMPORTXML("x")', 'pt_BR', 'x'.repeat(40), undefined]) {
    eq(post(g, Object.assign({}, FULL, { lang })).result, 'OK', 'lang ' + lang);
  }
  for (const r of b.getSheetByName('Acessos').rows.slice(1)) eq(r[3], '', 'lang cell');
  eq(post(g, Object.assign({}, FULL, { lang: 'zh-Hans-CN' })).result, 'OK', 'zh');
  eq(b.getSheetByName('Acessos').rows.slice(-1)[0][3], 'zh-Hans-CN', 'kept');
});

t('doGet reads and writes nothing', () => {
  const b = makeBook(), g = load(b);
  eq(JSON.parse(g.doGet({ parameter: FULL }).text), { result: 'OK', service: 'short-link-counter' }, 'reply');
  eq(b.sheets.map((s) => s.name), ['Página1'], 'sheets');
});

t('setup keeps data, drops only empty strangers, and is idempotent', () => {
  const b = makeBook(), g = load(b);
  b.insertSheet('Notas').appendRow(['keep me']);
  post(g, FULL);
  eq(g.setup(), 'OK', 'setup');
  const tabs = ['Resumo', 'Notas', 'Acessos', 'Teste', 'Teste resumo'];
  eq(b.sheets.map((s) => s.name), tabs, 'tabs');
  eq(b.getSheetByName('Acessos').rows.length, 2, 'data kept');
  eq(g.setup(), 'OK', 'again');
  eq(b.sheets.map((s) => s.name), tabs, 'tabs again');
  eq(b.getSheetByName('Acessos').rows.length, 2, 'data kept again');
});

console.log(`\nRan ${ran} tests, ${failed} failed.`);
process.exit(ran > 0 && failed === 0 ? 0 : 1);
