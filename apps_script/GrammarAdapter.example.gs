/**
 * Google Apps Script for collecting difficult words from students,
 * counting frequency, and estimating Swedish morphology.
 */

const INPUT_SHEET = 'Svar';
const OUTPUT_SHEET = 'Översikt';
const WORDBANK_SHEET = 'Ordbank';

// Imported logic baseline from:
// - src/data/questions_verb.ts
// - src/components/GrammarApp.tsx (noun declension group descriptions)
const VERB_GROUP_FROM_IMPERATIV = {
  // Group 1
  måla: '1', jobba: '1', starta: '1', titta: '1', hoppas: '1',
  // Group 2a
  bygg: '2a', kör: '2a', lägg: '2a', sälj: '2a', gör: '2a', sätt: '2a',
  // Group 2b
  sök: '2b', hjälp: '2b', sköt: '2b', lås: '2b', väx: '2b',
  // Group 3
  tro: '3', bo: '3', sy: '3', klä: '3', nå: '3',
  // Group 4
  bind: '4', drick: '4', spring: '4', sitt: '4', vinn: '4', skriv: '4',
  stig: '4', bit: '4', bli: '4', driv: '4', bjud: '4', ljug: '4', bryt: '4',
  flyg: '4', frys: '4', stryk: '4', dra: '4', ta: '4', slå: '4', bär: '4',
  skär: '4', stjäl: '4', gråt: '4', låt: '4', fall: '4', håll: '4', kom: '4',
  var: '4', se: '4', gå: '4'
};

function doGet(e) {
  const view = e && e.parameter && e.parameter.view;

  if (view === 'ordbank') {
    const html = hamtaHtmlMedFallback_('Wordbank', fallbackWordbankHtml_());
    return HtmlService.createHtmlOutput(html)
      .setTitle('Klassens ordbank')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const html = hamtaHtmlMedFallback_('Index', fallbackInputHtml_());
  return HtmlService.createHtmlOutput(html)
    .setTitle('Svåra ord')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function hamtaHtmlMedFallback_(baseName, fallbackHtml) {
  const candidates = [baseName, baseName.toLowerCase()];

  for (let i = 0; i < candidates.length; i++) {
    try {
      return HtmlService.createHtmlOutputFromFile(candidates[i]).getContent();
    } catch (err) {
      // Try next candidate.
    }
  }

  return fallbackHtml;
}

function fallbackInputHtml_() {
  return [
    '<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Svåra ord</title></head><body style="font-family:system-ui;padding:20px;max-width:700px">',
    '<h1>HTML-filen saknas</h1>',
    '<p>Kunde inte hitta <strong>Index.html</strong> i Apps Script-projektet.</p>',
    '</body></html>'
  ].join('');
}

function fallbackWordbankHtml_() {
  return [
    '<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Klassens ordbank</title></head><body style="font-family:system-ui;padding:20px;max-width:700px">',
    '<h1>HTML-filen saknas</h1>',
    '<p>Kunde inte hitta <strong>Wordbank.html</strong> i Apps Script-projektet.</p>',
    '</body></html>'
  ].join('');
}

function submitWord(payload) {
  const student = (payload.student || '').toString().trim();
  const word = (payload.word || '').toString();
  return submitWords({ words: [word], student: student });
}

function submitWords(payload) {
  const student = (payload.student || '').toString().trim();
  if (!arGiltigtFornamn_(student)) {
    return { ok: false, message: 'Förnamn är obligatoriskt och måste vara giltigt.' };
  }

  const cleaned = normaliseraOrdLista_(payload.words);
  if (!cleaned.length) {
    return { ok: false, message: 'Inga giltiga ord hittades.' };
  }

  const ss = SpreadsheetApp.getActive();
  const input = hamtaEllerSkapaBlad_(ss, INPUT_SHEET);
  const rows = cleaned.map(word => [new Date(), student, word]);
  input.getRange(input.getLastRow() + 1, 1, rows.length, 3).setValues(rows);

  return { ok: true, message: cleaned.length + ' ord sparades.' };
}

function uppdateraOversikt() {
  const ss = SpreadsheetApp.getActive();
  const input = ss.getSheetByName(INPUT_SHEET);
  if (!input) throw new Error('Hittar inte bladet "' + INPUT_SHEET + '".');

  const values = input.getDataRange().getValues();
  if (values.length < 2) {
    skrivUtOversikt_(ss, []);
    return;
  }

  const words = values.slice(1)
    .map(r => (r[2] || '').toString().trim().toLowerCase())
    .filter(arEttOrd_);

  const freq = {};
  words.forEach(w => (freq[w] = (freq[w] || 0) + 1));

  const result = Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a] || a.localeCompare(b, 'sv'))
    .map(word => {
      const ordklass = gissaOrdklass_(word);
      const analys = analyseraOrdMedAdapter_(word, ordklass);
      return {
        lemma: word,
        ordklass,
        frekvens: freq[word],
        ...analys
      };
    });

  skrivUtOversikt_(ss, result);
}

function analyseraOrdMedAdapter_(lemma, ordklass) {
  const base = {
    deklination: '',
    verbgrupp: '',
    infinitiv: '',
    imperativ: '',
    presens: '',
    preteritum: '',
    supinum: ''
  };

  // Hook for external repo code: define customAnalyzeWord_(lemma, ordklass)
  if (typeof customAnalyzeWord_ === 'function') {
    try {
      return { ...base, ...customAnalyzeWord_(lemma, ordklass) };
    } catch (err) {
      // fallback below
    }
  }

  if (ordklass === 'verb') {
    return { ...base, ...analyseraVerb_(lemma) };
  }

  // Hook for external noun declension code: classifyNounDeclension_(lemma)
  if (ordklass === 'substantiv' && typeof classifyNounDeclension_ === 'function') {
    try {
      return { ...base, deklination: classifyNounDeclension_(lemma) || '' };
    } catch (err) {
      return { ...base, deklination: klassificeraDeklinationFramMall_(lemma) };
    }
  }

  if (ordklass === 'substantiv') {
    return { ...base, deklination: klassificeraDeklinationFramMall_(lemma) };
  }

  return base;
}

function skrivUtOversikt_(ss, rows) {
  let output = ss.getSheetByName(OUTPUT_SHEET);
  if (!output) output = ss.insertSheet(OUTPUT_SHEET);

  output.clear();
  const headers = [
    'lemma', 'ordklass', 'frekvens', 'deklination', 'verbgrupp',
    'infinitiv', 'imperativ', 'presens', 'preteritum', 'supinum'
  ];
  output.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!rows.length) return;

  const values = rows.map(r => [
    r.lemma, r.ordklass, r.frekvens, r.deklination, r.verbgrupp,
    r.infinitiv, r.imperativ, r.presens, r.preteritum, r.supinum
  ]);

  output.getRange(2, 1, values.length, headers.length).setValues(values);
  output.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  output.autoResizeColumns(1, headers.length);
}

function initieraOrdbank() {
  const ss = SpreadsheetApp.getActive();
  const sheet = hamtaEllerSkapaBlad_(ss, WORDBANK_SHEET);
  const headers = [
    'lemma', 'ordklass', 'frekvens', 'deklination', 'verbgrupp',
    'infinitiv', 'imperativ', 'presens', 'preteritum', 'supinum',
    'sv', 'en', 'ar', 'uk'
  ];
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

function byggOrdbankFranOversikt() {
  const ss = SpreadsheetApp.getActive();
  const overview = ss.getSheetByName(OUTPUT_SHEET);
  if (!overview) throw new Error('Kör uppdateraOversikt() först.');

  const values = overview.getDataRange().getValues();
  if (values.length < 2) {
    initieraOrdbank();
    return;
  }

  initieraOrdbank();
  const wordbank = ss.getSheetByName(WORDBANK_SHEET);
  const rows = values.slice(1).map(r => {
    const lemma = r[0] || '';
    return [
      lemma, r[1] || '', r[2] || 0, r[3] || '', r[4] || '',
      r[5] || '', r[6] || '', r[7] || '', r[8] || '', r[9] || '',
      lemma, '', '', ''
    ];
  });

  wordbank.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  wordbank.autoResizeColumns(1, 14);
}

function hamtaOrdbankData(filters) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(WORDBANK_SHEET) || ss.getSheetByName(OUTPUT_SHEET);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => (h || '').toString().toLowerCase());
  const rows = values.slice(1);

  const language = ((filters && filters.language) || '').toLowerCase();
  const ordklassFilter = ((filters && filters.ordklass) || '').toLowerCase();
  const q = ((filters && filters.q) || '').toLowerCase();

  const idx = {
    lemma: headers.indexOf('lemma'),
    ordklass: headers.indexOf('ordklass'),
    frekvens: headers.indexOf('frekvens'),
    deklination: headers.indexOf('deklination'),
    verbgrupp: headers.indexOf('verbgrupp'),
    translation: headers.indexOf(language)
  };

  return rows
    .map(r => {
      const lemma = idx.lemma >= 0 ? r[idx.lemma] : '';
      const ordklass = idx.ordklass >= 0 ? r[idx.ordklass] : '';
      const frekvens = idx.frekvens >= 0 ? r[idx.frekvens] : '';
      const deklination = idx.deklination >= 0 ? r[idx.deklination] : '';
      const verbgrupp = idx.verbgrupp >= 0 ? r[idx.verbgrupp] : '';
      const translation = idx.translation >= 0 ? r[idx.translation] : (idx.lemma >= 0 ? r[idx.lemma] : '');

      return { lemma, ordklass, frekvens, deklination, verbgrupp, translation };
    })
    .filter(row => !ordklassFilter || row.ordklass.toLowerCase() === ordklassFilter)
    .filter(row => !q || row.lemma.toLowerCase().indexOf(q) !== -1 || (row.translation || '').toString().toLowerCase().indexOf(q) !== -1)
    .sort((a, b) => (Number(b.frekvens) || 0) - (Number(a.frekvens) || 0));
}

function konfigureraValidering() {
  const ss = SpreadsheetApp.getActive();
  const input = hamtaEllerSkapaBlad_(ss, INPUT_SHEET);

  if (input.getLastRow() === 0) {
    input.appendRow(['Timestamp', 'Elev', 'Ord']);
  }

  const range = input.getRange('C2:C');
  const rule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=REGEXMATCH(C2;"^[A-Za-zÅÄÖåäöÉéÜü]+$")')
    .setAllowInvalid(false)
    .setHelpText('Skriv exakt ett ord utan mellanslag eller skiljetecken.')
    .build();

  range.setDataValidation(rule);
}

function onEdit(e) {
  const range = e && e.range;
  if (!range) return;

  const sheet = range.getSheet();
  if (sheet.getName() !== INPUT_SHEET || range.getColumn() !== 3 || range.getRow() < 2) return;

  const raw = (range.getValue() || '').toString().trim().toLowerCase();
  if (!raw) return;

  if (!arEttOrd_(raw)) {
    range.clearContent();
    SpreadsheetApp.getActive().toast('Skriv bara ett ord i taget.', 'Ogiltig inmatning', 5);
    return;
  }

  range.setValue(raw);
}

function gissaOrdklass_(word) {
  if (word.endsWith('a') || word.endsWith('era') || word.endsWith('ar')) return 'verb';
  if (word.endsWith('ning') || word.endsWith('het') || word.endsWith('else')) return 'substantiv';
  if (word.endsWith('ig') || word.endsWith('isk') || word.endsWith('ad')) return 'adjektiv';
  return 'okänd';
}

function analyseraVerb_(lemma) {
  const irregular = {
    vara: { verbgrupp: '4', infinitiv: 'vara', imperativ: 'var', presens: 'är', preteritum: 'var', supinum: 'varit' },
    gå: { verbgrupp: '4', infinitiv: 'gå', imperativ: 'gå', presens: 'går', preteritum: 'gick', supinum: 'gått' },
    komma: { verbgrupp: '4', infinitiv: 'komma', imperativ: 'kom', presens: 'kommer', preteritum: 'kom', supinum: 'kommit' },
    göra: { verbgrupp: '4', infinitiv: 'göra', imperativ: 'gör', presens: 'gör', preteritum: 'gjorde', supinum: 'gjort' },
    se: { verbgrupp: '4', infinitiv: 'se', imperativ: 'se', presens: 'ser', preteritum: 'såg', supinum: 'sett' },
    ta: { verbgrupp: '4', infinitiv: 'ta', imperativ: 'ta', presens: 'tar', preteritum: 'tog', supinum: 'tagit' },
    få: { verbgrupp: '4', infinitiv: 'få', imperativ: 'få', presens: 'får', preteritum: 'fick', supinum: 'fått' },
    bli: { verbgrupp: '4', infinitiv: 'bli', imperativ: 'bli', presens: 'blir', preteritum: 'blev', supinum: 'blivit' },
    skriva: { verbgrupp: '4', infinitiv: 'skriva', imperativ: 'skriv', presens: 'skriver', preteritum: 'skrev', supinum: 'skrivit' }
  };
  if (irregular[lemma]) return irregular[lemma];

  const grupp = klassificeraVerbgruppFramMall_(lemma);

  if (grupp === '1' || lemma.endsWith('a')) {
    const stem = lemma.endsWith('a') ? lemma.slice(0, -1) : lemma;
    return { verbgrupp: '1', infinitiv: lemma, imperativ: stem, presens: stem + 'ar', preteritum: stem + 'ade', supinum: stem + 'at' };
  }
  if (grupp === '2a') {
    return { verbgrupp: '2a', infinitiv: lemma + 'a', imperativ: lemma, presens: lemma + 'er', preteritum: lemma + 'de', supinum: lemma + 't' };
  }
  if (grupp === '2b') {
    return { verbgrupp: '2b', infinitiv: lemma + 'a', imperativ: lemma, presens: lemma + 'er', preteritum: lemma + 'te', supinum: lemma + 't' };
  }
  if (grupp === '3') {
    return { verbgrupp: '3', infinitiv: lemma, imperativ: lemma, presens: lemma + 'r', preteritum: lemma + 'dde', supinum: lemma + 'tt' };
  }

  if (lemma.length <= 4) {
    return { verbgrupp: '3', infinitiv: lemma, imperativ: lemma, presens: lemma + 'r', preteritum: lemma + 'dde', supinum: lemma + 'tt' };
  }
  return { verbgrupp: '2b (gissning)', infinitiv: lemma, imperativ: lemma, presens: lemma + 'er', preteritum: lemma + 'de', supinum: lemma + 't' };
}

function klassificeraVerbgruppFramMall_(lemma) {
  return VERB_GROUP_FROM_IMPERATIV[lemma] || '';
}

function klassificeraDeklinationFramMall_(lemma) {
  // Inspired by noun-group descriptions in GrammarApp.tsx: n1..n5
  // n1: often -a words, n4: often ett-words ending in -e, n5: invariant plural forms.
  if (lemma.endsWith('a')) return '1';
  if (lemma.endsWith('e')) return '4';
  if (lemma.endsWith('eri') || lemma.endsWith('ande')) return '5';
  if (lemma.endsWith('ning') || lemma.endsWith('het') || lemma.endsWith('else')) return '3';
  if (lemma.endsWith('are') || lemma.endsWith('ing')) return '2';
  return '2';
}

function normaliseraOrdLista_(wordsInput) {
  let words = [];
  if (Array.isArray(wordsInput)) words = wordsInput;
  else words = [wordsInput || ''];

  return words
    .map(w => (w || '').toString().toLowerCase())
    .join(' ')
    .replace(/[.,;:!?()\[\]{}"'“”‘’]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(arEttOrd_);
}

function arGiltigtFornamn_(value) {
  return /^[A-Za-zÅÄÖåäöÉéÜü-]{2,}$/.test(value);
}

function arEttOrd_(value) {
  return /^[A-Za-zÅÄÖåäöÉéÜü]+$/.test(value);
}

function hamtaEllerSkapaBlad_(ss, namn) {
  let sheet = ss.getSheetByName(namn);
  if (!sheet) sheet = ss.insertSheet(namn);
  return sheet;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ordverktyg')
    .addItem('Uppdatera översikt', 'uppdateraOversikt')
    .addItem('Konfigurera enords-validering', 'konfigureraValidering')
    .addSeparator()
    .addItem('Skapa tom Ordbank', 'initieraOrdbank')
    .addItem('Bygg Ordbank från Översikt', 'byggOrdbankFranOversikt')
    .addToUi();
}
