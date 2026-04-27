/**
 * Google Apps Script for collecting difficult words from students,
 * counting frequency, and estimating Swedish morphology.
 */

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

const LANGUAGES = ['sv', 'en', 'es', 'ar', 'ur', 'tr', 'zh', 'th', 'ti', 'mn', 'uk'];

function doGet(e) {
  const view = e && e.parameter && e.parameter.view;

  if (view === 'ordbank') {
    return HtmlService
      .createHtmlOutput(hamtaHtmlMedFallback_('Wordbank', fallbackWordbankHtml_()))
      .setTitle('Klassens ordbank')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (view === 'dashboard') {
    return HtmlService
      .createHtmlOutput(hamtaHtmlMedFallback_('dashboard', fallbackInputHtml_()))
      .setTitle('Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService
    .createHtmlOutput(hamtaHtmlMedFallback_('Index', fallbackInputHtml_()))
    .setTitle('Svåra ord')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function hamtaHtmlMedFallback_(baseName, fallbackHtml) {
  for (const name of [baseName, baseName.toLowerCase()]) {
    try {
      return HtmlService.createHtmlOutputFromFile(name).getContent();
    } catch {}
  }
  return fallbackHtml;
}

function fallbackInputHtml_() {
  return `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Svåra ord</title></head>
<body style="font-family:system-ui;padding:20px;max-width:700px">
<h1>HTML-filen saknas</h1>
<p>Kunde inte hitta <strong>Index.html</strong> i Apps Script-projektet.</p>
</body></html>`;
}

function fallbackWordbankHtml_() {
  return `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Klassens ordbank</title></head>
<body style="font-family:system-ui;padding:20px;max-width:700px">
<h1>HTML-filen saknas</h1>
<p>Kunde inte hitta <strong>Wordbank.html</strong> i Apps Script-projektet.</p>
</body></html>`;
}

function submitWord(payload) {
  const student = (payload.student || '').toString().trim();
  const word = (payload.word || '').toString();
  return submitWords({ words: [word], student });
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

  const ordklass    = ['verb','substantiv','adjektiv','övrigt'].includes(payload.ordklass) ? payload.ordklass : '';
  const verbgrupp   = ['1','2a','2b','3','4'].includes(payload.verbgrupp) ? payload.verbgrupp : '';
  const deklination = ['1','2','3','4','5'].includes(payload.deklination) ? payload.deklination : '';

  const ss = SpreadsheetApp.getActive();
  const input = hamtaEllerSkapaBlad_(ss, CONFIG.INPUT_SHEET);
  const rows = cleaned.map(word => [new Date(), student, word, ordklass, verbgrupp, deklination]);
  input.getRange(input.getLastRow() + 1, 1, rows.length, 6).setValues(rows);

  return { ok: true, message: `${cleaned.length} ord sparades.` };
}

function uppdateraOversikt() {
  const ss = SpreadsheetApp.getActive();
  const input = ss.getSheetByName(CONFIG.INPUT_SHEET);
  if (!input) throw new Error(`Hittar inte bladet "${CONFIG.INPUT_SHEET}".`);

  const values = input.getDataRange().getValues();
  if (values.length < 2) {
    skrivUtOversikt_(ss, []);
    return;
  }

  const freq = {};
  const votes = {};

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const word = (r[2] || '').toString().trim().toLowerCase();
    if (!arEttOrd_(word)) continue;
    freq[word] = (freq[word] || 0) + 1;
    if (!votes[word]) votes[word] = { ordklass: {}, verbgrupp: {}, deklination: {} };
    const ok = (r[3] || '').toString().trim();
    const vg = (r[4] || '').toString().trim();
    const dk = (r[5] || '').toString().trim();
    if (ok) votes[word].ordklass[ok]    = (votes[word].ordklass[ok]    || 0) + 1;
    if (vg) votes[word].verbgrupp[vg]   = (votes[word].verbgrupp[vg]   || 0) + 1;
    if (dk) votes[word].deklination[dk] = (votes[word].deklination[dk] || 0) + 1;
  }

  const majoritet = obj => {
    const e = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
    return e.length ? e[0][0] : '';
  };

  const result = Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a] || a.localeCompare(b, 'sv'))
    .map(word => {
      const v = votes[word];
      const ordklass    = majoritet(v.ordklass)    || gissaOrdklass_(word);
      const verbgrupp   = majoritet(v.verbgrupp)   || '';
      const deklination = majoritet(v.deklination) || '';
      const adapter = analyseraOrdMedAdapter_(word, ordklass);
      return {
        lemma: word,
        ordklass,
        frekvens: freq[word],
        deklination: deklination || adapter.deklination || '',
        verbgrupp:   verbgrupp   || adapter.verbgrupp   || '',
        infinitiv:   adapter.infinitiv  || '',
        imperativ:   adapter.imperativ  || '',
        presens:     adapter.presens    || '',
        preteritum:  adapter.preteritum || '',
        supinum:     adapter.supinum    || ''
      };
    });

  skrivUtOversikt_(ss, result);
}

function analyseraOrdMedAdapter_(lemma, ordklass) {
  const base = { deklination: '', verbgrupp: '', infinitiv: '', imperativ: '', presens: '', preteritum: '', supinum: '' };

  if (typeof customAnalyzeWord_ === 'function') {
    try { return { ...base, ...customAnalyzeWord_(lemma, ordklass) }; } catch {}
  }

  if (ordklass === 'verb') return { ...base, ...analyseraVerb_(lemma) };

  if (ordklass === 'substantiv') {
    const deklination = typeof classifyNounDeclension_ === 'function'
      ? (classifyNounDeclension_(lemma) || klassificeraDeklinationFramMall_(lemma))
      : klassificeraDeklinationFramMall_(lemma);
    return { ...base, deklination };
  }

  return base;
}

function skrivUtOversikt_(ss, rows) {
  const output = hamtaEllerSkapaBlad_(ss, CONFIG.OUTPUT_SHEET);
  output.clear();

  const headers = ['lemma', 'ordklass', 'frekvens', 'deklination', 'verbgrupp', 'infinitiv', 'imperativ', 'presens', 'preteritum', 'supinum'];
  const headerRange = output.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]).setFontWeight('bold');

  if (!rows.length) return;

  const values = rows.map(r => [r.lemma, r.ordklass, r.frekvens, r.deklination, r.verbgrupp, r.infinitiv, r.imperativ, r.presens, r.preteritum, r.supinum]);
  output.getRange(2, 1, values.length, headers.length).setValues(values);
  output.autoResizeColumns(1, headers.length);
}

function initieraOrdbank() {
  const ss = SpreadsheetApp.getActive();
  const sheet = hamtaEllerSkapaBlad_(ss, CONFIG.WORDBANK_SHEET);
  const headers = [
    'lemma', 'ordklass', 'frekvens', 'deklination', 'verbgrupp',
    'infinitiv', 'imperativ', 'presens', 'preteritum', 'supinum',
    ...LANGUAGES
  ];
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
}

function byggOrdbankFranOversikt() {
  const ss = SpreadsheetApp.getActive();
  const overview = ss.getSheetByName(CONFIG.OUTPUT_SHEET);
  if (!overview) throw new Error('Kör uppdateraOversikt() först.');

  initieraOrdbank();

  const values = overview.getDataRange().getValues();
  if (values.length < 2) return;

  const wordbank = ss.getSheetByName(CONFIG.WORDBANK_SHEET);
  const emptyTranslations = LANGUAGES.map(() => '');
  const rows = values.slice(1).map(r => {
    const lemma = r[0] || '';
    const langValues = emptyTranslations.slice();
    langValues[0] = lemma; // sv = lemma as placeholder
    return [lemma, r[1] || '', r[2] || 0, r[3] || '', r[4] || '', r[5] || '', r[6] || '', r[7] || '', r[8] || '', r[9] || '', ...langValues];
  });

  wordbank.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  wordbank.autoResizeColumns(1, 10 + LANGUAGES.length);
}

function hamtaRöstdata_() {
  const input = SpreadsheetApp.getActive().getSheetByName(CONFIG.INPUT_SHEET);
  if (!input) return {};
  const values = input.getDataRange().getValues();
  const votes = {};
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const word = (r[2] || '').toString().trim().toLowerCase();
    if (!word) continue;
    if (!votes[word]) votes[word] = { ordklass: {}, verbgrupp: {}, deklination: {} };
    const ok = (r[3] || '').toString().trim();
    const vg = (r[4] || '').toString().trim();
    const dk = (r[5] || '').toString().trim();
    if (ok) votes[word].ordklass[ok]    = (votes[word].ordklass[ok]    || 0) + 1;
    if (vg) votes[word].verbgrupp[vg]   = (votes[word].verbgrupp[vg]   || 0) + 1;
    if (dk) votes[word].deklination[dk] = (votes[word].deklination[dk] || 0) + 1;
  }
  return votes;
}

function hamtaOrdbankData(filters) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(CONFIG.WORDBANK_SHEET) || ss.getSheetByName(CONFIG.OUTPUT_SHEET);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => (h || '').toString().toLowerCase());
  const idx = {};
  for (const key of ['lemma', 'ordklass', 'frekvens', 'deklination', 'verbgrupp']) {
    idx[key] = headers.indexOf(key);
  }
  const langIdx = {};
  LANGUAGES.forEach(lang => { langIdx[lang] = headers.indexOf(lang); });

  const language = ((filters && filters.language) || '').toLowerCase();
  const ordklassFilter = ((filters && filters.ordklass) || '').toLowerCase();
  const q = ((filters && filters.q) || '').toLowerCase();

  const allVotes = hamtaRöstdata_();

  return values.slice(1)
    .map(r => {
      const get = key => idx[key] >= 0 ? r[idx[key]] : '';
      const translations = {};
      LANGUAGES.forEach(lang => {
        translations[lang] = langIdx[lang] >= 0 ? (r[langIdx[lang]] || '') : '';
      });
      const translation = language ? (translations[language] || '') : '';
      const lemma = (get('lemma') || '').toString().toLowerCase();
      return {
        lemma: get('lemma'),
        ordklass: get('ordklass'),
        frekvens: get('frekvens'),
        deklination: get('deklination'),
        verbgrupp: get('verbgrupp'),
        translation,
        translations,
        votes: allVotes[lemma] || { ordklass: {}, verbgrupp: {}, deklination: {} }
      };
    })
    .filter(row => !ordklassFilter || row.ordklass.toLowerCase() === ordklassFilter)
    .filter(row => !q || row.lemma.toLowerCase().includes(q) || (row.translation || '').toString().toLowerCase().includes(q))
    .sort((a, b) => (Number(b.frekvens) || 0) - (Number(a.frekvens) || 0));
}

function konfigureraValidering() {
  const ss = SpreadsheetApp.getActive();
  const input = hamtaEllerSkapaBlad_(ss, CONFIG.INPUT_SHEET);

  if (input.getLastRow() === 0) {
    input.appendRow(['Timestamp', 'Elev', 'Ord']);
  }

  const rule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=REGEXMATCH(C2;"^[A-Za-zÅÄÖåäöÉéÜü]+$")')
    .setAllowInvalid(false)
    .setHelpText('Skriv exakt ett ord utan mellanslag eller skiljetecken.')
    .build();

  input.getRange('C2:C').setDataValidation(rule);
}

function onEdit(e) {
  const range = e && e.range;
  if (!range) return;

  const sheet = range.getSheet();
  if (sheet.getName() !== CONFIG.INPUT_SHEET || range.getColumn() !== 3 || range.getRow() < 2) return;

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
  const result = slaUppAllaVerbFormer_(lemma);
  if (result) return result;
  return bojaVerbFranImperativ_(lemma, lemma, null);
}

function klassificeraVerbgruppFramMall_(lemma) {
  return VERB_GROUP_FROM_IMPERATIV[lemma] || '';
}

function klassificeraDeklinationFramMall_(lemma) {
  if (lemma.endsWith('a')) return '1';
  if (lemma.endsWith('e')) return '4';
  if (lemma.endsWith('eri') || lemma.endsWith('ande')) return '5';
  if (lemma.endsWith('ning') || lemma.endsWith('het') || lemma.endsWith('else')) return '3';
  return '2';
}

function normaliseraOrdLista_(wordsInput) {
  const words = Array.isArray(wordsInput) ? wordsInput : [wordsInput || ''];
  return words
    .map(w => (w || '').toString().toLowerCase())
    .join(' ')
    .replace(/[.,;:!?()\[\]{}"'""'']/g, ' ')
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
  return ss.getSheetByName(namn) || ss.insertSheet(namn);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ordverktyg')
    .addItem('Uppdatera översikt', 'uppdateraOversikt')
    .addItem('Konfigurera enords-validering', 'konfigureraValidering')
    .addSeparator()
    .addItem('Skapa tom Ordbank', 'initieraOrdbank')
    .addItem('Bygg Ordbank från Översikt', 'byggOrdbankFranOversikt')
    .addSeparator()
    .addItem('Översätt ord med AI', 'oversattAllaOrd')
    .addItem('Analysera grammatik med AI', 'analyseraGrammatikMedAI')
    .addItem('Ange API-nyckel', 'sattApiNyckel')
    .addToUi();
}

// ── AI-grammatikanalys ───────────────────────────────────────────────────────

const GRAMMAR_KEYS = ['ordklass', 'deklination', 'verbgrupp', 'infinitiv', 'imperativ', 'presens', 'preteritum', 'supinum'];
const VERB_ONLY_KEYS = new Set(['verbgrupp', 'infinitiv', 'imperativ', 'presens', 'preteritum', 'supinum']);

// Group-4 (strong) verbs – full forms. Key = infinitiv.
const GRUPP4_VERB = {
  binda:     { imperativ:'bind',     presens:'binder',    preteritum:'band',    supinum:'bundit'    },
  brinna:    { imperativ:'brinn',    presens:'brinner',   preteritum:'brann',   supinum:'brunnit'   },
  dricka:    { imperativ:'drick',    presens:'dricker',   preteritum:'drack',   supinum:'druckit'   },
  finna:     { imperativ:'finn',     presens:'finner',    preteritum:'fann',    supinum:'funnit'    },
  försvinna: { imperativ:'försvinn', presens:'försvinner',preteritum:'försvann',supinum:'försvunnit'},
  hinna:     { imperativ:'hinn',     presens:'hinner',    preteritum:'hann',    supinum:'hunnit'    },
  rinna:     { imperativ:'rinn',     presens:'rinner',    preteritum:'rann',    supinum:'runnit'    },
  sitta:     { imperativ:'sitt',     presens:'sitter',    preteritum:'satt',    supinum:'suttit'    },
  slippa:    { imperativ:'slipp',    presens:'slipper',   preteritum:'slapp',   supinum:'sluppit'   },
  spinna:    { imperativ:'spinn',    presens:'spinner',   preteritum:'spann',   supinum:'spunnit'   },
  spricka:   { imperativ:'sprick',   presens:'spricker',  preteritum:'sprack',  supinum:'spruckit'  },
  springa:   { imperativ:'spring',   presens:'springer',  preteritum:'sprang',  supinum:'sprungit'  },
  sticka:    { imperativ:'stick',    presens:'sticker',   preteritum:'stack',   supinum:'stuckit'   },
  vinna:     { imperativ:'vinn',     presens:'vinner',    preteritum:'vann',    supinum:'vunnit'    },
  bita:      { imperativ:'bit',      presens:'biter',     preteritum:'bet',     supinum:'bitit'     },
  bli:       { imperativ:'bli',      presens:'blir',      preteritum:'blev',    supinum:'blivit'    },
  bliva:     { imperativ:'bli',      presens:'blir',      preteritum:'blev',    supinum:'blivit'    },
  driva:     { imperativ:'driv',     presens:'driver',    preteritum:'drev',    supinum:'drivit'    },
  glida:     { imperativ:'glid',     presens:'glider',    preteritum:'gled',    supinum:'glidit'    },
  gripa:     { imperativ:'grip',     presens:'griper',    preteritum:'grep',    supinum:'gripit'    },
  kliva:     { imperativ:'kliv',     presens:'kliver',    preteritum:'klev',    supinum:'klivit'    },
  lida:      { imperativ:'lid',      presens:'lider',     preteritum:'led',     supinum:'lidit'     },
  rida:      { imperativ:'rid',      presens:'rider',     preteritum:'red',     supinum:'ridit'     },
  riva:      { imperativ:'riv',      presens:'river',     preteritum:'rev',     supinum:'rivit'     },
  skina:     { imperativ:'skin',     presens:'skiner',    preteritum:'sken',    supinum:'skinit'    },
  skrika:    { imperativ:'skrik',    presens:'skriker',   preteritum:'skrek',   supinum:'skrikit'   },
  skriva:    { imperativ:'skriv',    presens:'skriver',   preteritum:'skrev',   supinum:'skrivit'   },
  slita:     { imperativ:'slit',     presens:'sliter',    preteritum:'slet',    supinum:'slitit'    },
  smita:     { imperativ:'smit',     presens:'smiter',    preteritum:'smet',    supinum:'smitit'    },
  stiga:     { imperativ:'stig',     presens:'stiger',    preteritum:'steg',    supinum:'stigit'    },
  svika:     { imperativ:'svik',     presens:'sviker',    preteritum:'svek',    supinum:'svikit'    },
  tiga:      { imperativ:'tig',      presens:'tiger',     preteritum:'teg',     supinum:'tigit'     },
  vrida:     { imperativ:'vrid',     presens:'vrider',    preteritum:'vred',    supinum:'vridit'    },
  bjuda:     { imperativ:'bjud',     presens:'bjuder',    preteritum:'bjöd',    supinum:'bjudit'    },
  hugga:     { imperativ:'hugg',     presens:'hugger',    preteritum:'högg',    supinum:'huggit'    },
  ljuga:     { imperativ:'ljug',     presens:'ljuger',    preteritum:'ljög',    supinum:'ljugit'    },
  njuta:     { imperativ:'njut',     presens:'njuter',    preteritum:'njöt',    supinum:'njutit'    },
  sjunga:    { imperativ:'sjung',    presens:'sjunger',   preteritum:'sjöng',   supinum:'sjungit'   },
  sjunka:    { imperativ:'sjunk',    presens:'sjunker',   preteritum:'sjönk',   supinum:'sjunkit'   },
  skjuta:    { imperativ:'skjut',    presens:'skjuter',   preteritum:'sköt',    supinum:'skjutit'   },
  bryta:     { imperativ:'bryt',     presens:'bryter',    preteritum:'bröt',    supinum:'brutit'    },
  flyga:     { imperativ:'flyg',     presens:'flyger',    preteritum:'flög',    supinum:'flugit'    },
  flyta:     { imperativ:'flyt',     presens:'flyter',    preteritum:'flöt',    supinum:'flutit'    },
  frysa:     { imperativ:'frys',     presens:'fryser',    preteritum:'frös',    supinum:'frusit'    },
  knyta:     { imperativ:'knyt',     presens:'knyter',    preteritum:'knöt',    supinum:'knutit'    },
  krypa:     { imperativ:'kryp',     presens:'kryper',    preteritum:'kröp',    supinum:'krupit'    },
  smyga:     { imperativ:'smyg',     presens:'smyger',    preteritum:'smög',    supinum:'smugit'    },
  stryka:    { imperativ:'stryk',    presens:'stryker',   preteritum:'strök',   supinum:'strukit'   },
  dra:       { imperativ:'dra',      presens:'drar',      preteritum:'drog',    supinum:'dragit'    },
  draga:     { imperativ:'dra',      presens:'drar',      preteritum:'drog',    supinum:'dragit'    },
  fara:      { imperativ:'far',      presens:'far',       preteritum:'for',     supinum:'farit'     },
  ta:        { imperativ:'ta',       presens:'tar',       preteritum:'tog',     supinum:'tagit'     },
  taga:      { imperativ:'ta',       presens:'tar',       preteritum:'tog',     supinum:'tagit'     },
  slå:       { imperativ:'slå',      presens:'slår',      preteritum:'slog',    supinum:'slagit'    },
  bära:      { imperativ:'bär',      presens:'bär',       preteritum:'bar',     supinum:'burit'     },
  skära:     { imperativ:'skär',     presens:'skär',      preteritum:'skar',    supinum:'skurit'    },
  stjäla:    { imperativ:'stjäl',    presens:'stjäl',     preteritum:'stal',    supinum:'stulit'    },
  gråta:     { imperativ:'gråt',     presens:'gråter',    preteritum:'grät',    supinum:'gråtit'    },
  låta:      { imperativ:'låt',      presens:'låter',     preteritum:'lät',     supinum:'låtit'     },
  falla:     { imperativ:'fall',     presens:'faller',    preteritum:'föll',    supinum:'fallit'    },
  hålla:     { imperativ:'håll',     presens:'håller',    preteritum:'höll',    supinum:'hållit'    },
  komma:     { imperativ:'kom',      presens:'kommer',    preteritum:'kom',     supinum:'kommit'    },
  vara:      { imperativ:'var',      presens:'är',        preteritum:'var',     supinum:'varit'     },
  se:        { imperativ:'se',       presens:'ser',       preteritum:'såg',     supinum:'sett'      },
  gå:        { imperativ:'gå',       presens:'går',       preteritum:'gick',    supinum:'gått'      },
  få:        { imperativ:'få',       presens:'får',       preteritum:'fick',    supinum:'fått'      },
  göra:      { imperativ:'gör',      presens:'gör',       preteritum:'gjorde',  supinum:'gjort'     },
  sälja:     { imperativ:'sälj',     presens:'säljer',    preteritum:'sålde',   supinum:'sålt'      },
  svälja:    { imperativ:'svälj',    presens:'sväljer',   preteritum:'svalde',  supinum:'svalt'     },
  ställa:    { imperativ:'ställ',    presens:'ställer',   preteritum:'ställde', supinum:'ställt'    },
  // Common irregulars missing from earlier versions
  stå:       { imperativ:'stå',      presens:'står',      preteritum:'stod',    supinum:'stått'     },
  förstå:    { imperativ:'förstå',   presens:'förstår',   preteritum:'förstod', supinum:'förstått'  },
  bestå:     { imperativ:'bestå',    presens:'består',    preteritum:'bestod',  supinum:'bestått'   },
  uppstå:    { imperativ:'uppstå',   presens:'uppstår',   preteritum:'uppstod', supinum:'uppstått'  },
  ge:        { imperativ:'ge',       presens:'ger',       preteritum:'gav',     supinum:'gett'      },
  giva:      { imperativ:'ge',       presens:'ger',       preteritum:'gav',     supinum:'gett'      },
  sätta:     { imperativ:'sätt',     presens:'sätter',    preteritum:'satte',   supinum:'satt'      },
  lägga:     { imperativ:'lägg',     presens:'lägger',    preteritum:'lade',    supinum:'lagt'      },
  ligga:     { imperativ:'ligg',     presens:'ligger',    preteritum:'låg',     supinum:'legat'     },
  sova:      { imperativ:'sov',      presens:'sover',     preteritum:'sov',     supinum:'sovit'     },
};

// Verbs AI commonly conjugates wrong (e.g. drops -j from -lj/-rj stems).
const VERB_UTÖKAT = {
  följa:  { verbgrupp:'2a', imperativ:'följ',  presens:'följer',  preteritum:'följde',  supinum:'följt'  },
  välja:  { verbgrupp:'2a', imperativ:'välj',  presens:'väljer',  preteritum:'valde',   supinum:'valt'   },
  röja:   { verbgrupp:'2a', imperativ:'röj',   presens:'röjer',   preteritum:'röjde',   supinum:'röjt'   },
  röra:   { verbgrupp:'2a', imperativ:'rör',   presens:'rör',     preteritum:'rörde',   supinum:'rört'   },
  höra:   { verbgrupp:'2a', imperativ:'hör',   presens:'hör',     preteritum:'hörde',   supinum:'hört'   },
  köra:   { verbgrupp:'2a', imperativ:'kör',   presens:'kör',     preteritum:'körde',   supinum:'kört'   },
  föra:   { verbgrupp:'2a', imperativ:'för',   presens:'för',     preteritum:'förde',   supinum:'fört'   },
  störa:  { verbgrupp:'2a', imperativ:'stör',  presens:'stör',    preteritum:'störde',  supinum:'stört'  },
};

const VERB_PREFIXES = [
  'an','av','be','bi','del','efter','en','er','fast','för','ge','hem','hit',
  'i','igen','in','inne','inter','kring','miss','mot','ned','o','om','på',
  'sam','samman','till','under','upp','ut','utan','vid','åter','över'
];

function slaUppAllaVerbFormer_(form) {
  if (!form) return null;
  const f = form.toLowerCase();
  if (GRUPP4_VERB[f]) return { verbgrupp: '4', infinitiv: f, ...GRUPP4_VERB[f] };
  for (const [infinitiv, d] of Object.entries(GRUPP4_VERB)) {
    if (d.imperativ === f || d.presens === f || d.preteritum === f || d.supinum === f)
      return { verbgrupp: '4', infinitiv, ...d };
  }
  if (VERB_UTÖKAT[f]) return { infinitiv: f, ...VERB_UTÖKAT[f] };
  for (const [infinitiv, d] of Object.entries(VERB_UTÖKAT)) {
    if (d.imperativ === f || d.presens === f || d.preteritum === f || d.supinum === f)
      return { infinitiv, ...d };
  }
  return null;
}

function finnSammansattVerb_(word) {
  if (!word) return null;
  const w = word.toLowerCase();
  for (const prefix of VERB_PREFIXES) {
    if (w.startsWith(prefix) && w.length > prefix.length + 2) {
      const base = w.slice(prefix.length);
      const result = slaUppAllaVerbFormer_(base);
      if (result) {
        return {
          verbgrupp:  result.verbgrupp,
          infinitiv:  prefix + result.infinitiv,
          imperativ:  prefix + (result.imperativ || ''),
          presens:    prefix + result.presens,
          preteritum: prefix + result.preteritum,
          supinum:    prefix + result.supinum
        };
      }
    }
  }
  return null;
}

function bojaVerbFranImperativ_(imperativ, originalLemma, forcedGrupp) {
  const imp = (imperativ || '').trim().toLowerCase();
  const lem = (originalLemma || '').trim().toLowerCase();

  // Direct table lookup by imperativ or lemma
  for (const [infinitiv, d] of Object.entries(GRUPP4_VERB)) {
    if (d.imperativ === imp) return { verbgrupp: '4', infinitiv, ...d };
  }
  if (lem && GRUPP4_VERB[lem]) return { verbgrupp: '4', infinitiv: lem, ...GRUPP4_VERB[lem] };

  // Search all stored forms in both tables
  const byAllForms = slaUppAllaVerbFormer_(lem);
  if (byAllForms) return byAllForms;

  // Compound verb detection
  const compound = finnSammansattVerb_(imp) || (lem !== imp && finnSammansattVerb_(lem));
  if (compound) return compound;

  if (!imp) return {};

  // When teacher has confirmed group 1, recover the correct imperativ (= infinitiv for -a verbs).
  // AI often returns just the stem (e.g. "halt" for "halta"); undo that here.
  if (forcedGrupp === '1') {
    const g1imp = lem.endsWith('a') ? lem : (imp.endsWith('a') ? imp : imp + 'a');
    const stem = g1imp.slice(0, -1);
    return { verbgrupp: '1', infinitiv: g1imp, imperativ: g1imp,
      presens: stem + 'ar', preteritum: stem + 'ade', supinum: stem + 'at' };
  }

  // Imperativ ending in -a is ALWAYS group 1, even if column E says otherwise
  if (imp.endsWith('a')) {
    const stem = imp.slice(0, -1);
    return { verbgrupp: '1', infinitiv: imp, imperativ: imp,
      presens: stem + 'ar', preteritum: stem + 'ade', supinum: stem + 'at' };
  }

  // Determine group from rules, respecting forcedGrupp for groups 2a/2b/3
  const grupp = forcedGrupp && ['2a','2b','3'].includes(forcedGrupp)
    ? forcedGrupp
    : /[eiouåäöy]$/.test(imp) ? '3'
    : /[ptksx]$/.test(imp) ? '2b'
    : '2a';

  if (grupp === '3') {
    return { verbgrupp: '3', infinitiv: imp, imperativ: imp,
      presens: imp + 'r', preteritum: imp + 'dde', supinum: imp + 'tt' };
  }
  if (grupp === '2b') {
    return { verbgrupp: '2b', infinitiv: imp + 'a', imperativ: imp,
      presens: imp + 'er', preteritum: imp + 'te', supinum: imp + 't' };
  }
  // Group 2a: stems ending in -nd simplify double consonant (vänd+de→vände, vänd+t→vänt)
  if (imp.endsWith('nd')) {
    const base = imp.slice(0, -1);
    return { verbgrupp: '2a', infinitiv: imp + 'a', imperativ: imp,
      presens: imp + 'er', preteritum: base + 'de', supinum: base + 't' };
  }
  return { verbgrupp: '2a', infinitiv: imp + 'a', imperativ: imp,
    presens: imp + 'er', preteritum: imp + 'de', supinum: imp + 't' };
}

function analyseraGrammatikMedAI() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) { SpreadsheetApp.getUi().alert('Lägg till din API-nyckel via Ordverktyg → Ange API-nyckel.'); return; }

  const ss = SpreadsheetApp.getActive();
  const oversikt = ss.getSheetByName(CONFIG.OUTPUT_SHEET);
  if (!oversikt) { SpreadsheetApp.getUi().alert('Kör "Uppdatera översikt" först.'); return; }

  const values = oversikt.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0].map(h => h.toString().toLowerCase());
  const idx = {};
  for (const key of ['lemma', ...GRAMMAR_KEYS]) idx[key] = headers.indexOf(key);

  const words = values.slice(1)
    .map((r, i) => ({
      rowIndex: i + 1,
      lemma:            (r[idx.lemma]      || '').toString().trim(),
      existingOrdklass: idx.ordklass  >= 0 ? (r[idx.ordklass]  || '').toString().trim() : '',
      existingGrupp:    idx.verbgrupp >= 0 ? (r[idx.verbgrupp] || '').toString().trim() : ''
    }))
    .filter(w => w.lemma);

  if (!words.length) return;

  // Build Ordbank lookup so we can update grammar there too
  const wordbank = ss.getSheetByName(CONFIG.WORDBANK_SHEET);
  let wbIdx = null;
  const wbLemmaRow = {};
  if (wordbank) {
    const wbHeaders = wordbank.getRange(1, 1, 1, wordbank.getLastColumn()).getValues()[0]
      .map(h => h.toString().toLowerCase());
    wbIdx = {};
    for (const key of ['lemma', ...GRAMMAR_KEYS]) wbIdx[key] = wbHeaders.indexOf(key);
    wordbank.getDataRange().getValues().slice(1).forEach((r, i) => {
      const lemma = (r[wbIdx.lemma] || '').toString().trim();
      if (lemma) wbLemmaRow[lemma] = i + 1;
    });
  }

  const BATCH_SIZE = 20;
  for (let b = 0; b < words.length; b += BATCH_SIZE) {
    const batch = words.slice(b, b + BATCH_SIZE);
    let results;
    try {
      results = anropaClaudeGrammatik_(apiKey, batch.map(w => w.lemma));
    } catch (e) {
      Logger.log('API-fel för batch ' + b + ': ' + e.message);
      ss.toast('API-fel: ' + e.message, 'Fel', 8);
      break;
    }

    batch.forEach(({ rowIndex, lemma, existingOrdklass, existingGrupp }) => {
      const analysis = results[lemma] || results[lemma.toLowerCase()] || {};

      // Teacher's manual value always wins; fall back to AI
      const effectiveOrdklass = existingOrdklass ||
        (existingGrupp ? 'verb' : '') ||
        analysis.ordklass || '';
      if (!effectiveOrdklass) return;

      // Build enriched object with deterministic verb forms
      const enriched = { ordklass: effectiveOrdklass };
      if (effectiveOrdklass === 'verb') {
        const imperativ = (analysis.imperativ || '').trim() || lemma;
        const forms = bojaVerbFranImperativ_(imperativ, lemma, existingGrupp || null);
        Object.assign(enriched, forms);
      } else if (effectiveOrdklass === 'substantiv' && analysis.deklination) {
        enriched.deklination = analysis.deklination;
      }

      const writeToSheet = (sheet, sheetIdx, dataRow) => {
        for (const key of GRAMMAR_KEYS) {
          if (sheetIdx[key] < 0) continue;
          if (key === 'ordklass' && existingOrdklass) continue;   // col B protected
          if (key === 'verbgrupp' && existingGrupp) continue;     // col E protected
          let val;
          if (effectiveOrdklass !== 'verb' && VERB_ONLY_KEYS.has(key)) {
            val = ''; // clear stale verb forms for non-verbs
          } else {
            val = enriched[key] !== undefined ? enriched[key] : '';
          }
          sheet.getRange(dataRow + 1, sheetIdx[key] + 1).setValue(val);
        }
      };

      writeToSheet(oversikt, idx, rowIndex);

      if (wordbank && wbIdx) {
        const wbRow = wbLemmaRow[lemma];
        if (wbRow !== undefined) writeToSheet(wordbank, wbIdx, wbRow);
      }
    });

    if (b + BATCH_SIZE < words.length) Utilities.sleep(1000);
  }

  ss.toast('Grammatikanalys klar — Översikt och Ordbank uppdaterade.', 'Klar', 5);
}

function anropaClaudeGrammatik_(apiKey, lemmas) {
  const prompt = `Analyze these Swedish words grammatically.
Reply with ONLY a valid JSON object — no explanation, no markdown.

Each key is a word from the list. The value is an object with:
- "ordklass": "verb", "substantiv", "adjektiv", or "övrigt"
- For verbs: "imperativ" only (the command form). Rules: (1) group-1 verbs whose infinitive ends in -a have imperativ = full infinitive (e.g. "cykla"→"cykla", "halta"→"halta", "snegla"→"snegla"). (2) group-2/3/4 verbs use the bare stem (e.g. "spring", "sälj", "kör"). Keep -j in -lj/-rj stems: följ, välj, sälj.
- For nouns: "deklination" ("1","2","3","4","5")
- For others: just ordklass

Swedish words: ${JSON.stringify(lemmas)}

Example:
{"springa":{"ordklass":"verb","imperativ":"spring"},"hus":{"ordklass":"substantiv","deklination":"5"},"snabb":{"ordklass":"adjektiv"}}`;

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    payload: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) throw new Error('Claude API-fel: ' + response.getContentText());
  const text = JSON.parse(response.getContentText()).content[0].text.trim();
  try { return JSON.parse(text); } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    Logger.log('Kunde inte parsa svar: ' + text);
    return {};
  }
}

// ── AI-översättning ─────────────────────────────────────────────────────────

const LANGUAGE_NAMES_FOR_API = {
  en: 'English', es: 'Spanish', ar: 'Arabic', ur: 'Urdu',
  tr: 'Turkish', zh: 'Mandarin Chinese', th: 'Thai',
  ti: 'Tigrinya', mn: 'Mongolian', uk: 'Ukrainian'
};

function sattApiNyckel() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt('Anthropic API-nyckel', 'Klistra in din API-nyckel:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('CLAUDE_API_KEY', result.getResponseText().trim());
    ui.alert('API-nyckeln sparad.');
  }
}

function oversattAllaOrd() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) {
    SpreadsheetApp.getUi().alert('Lägg till din API-nyckel via Ordverktyg → Ange API-nyckel.');
    return;
  }

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(CONFIG.WORDBANK_SHEET);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Kör "Bygg Ordbank från Översikt" först.');
    return;
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0].map(h => h.toString().toLowerCase());
  const lemmaIdx = headers.indexOf('lemma');
  const langIdx = {};
  LANGUAGES.forEach(lang => { langIdx[lang] = headers.indexOf(lang); });

  const wordsToTranslate = [];
  for (let i = 1; i < values.length; i++) {
    const lemma = (values[i][lemmaIdx] || '').toString().trim();
    if (!lemma) continue;
    const needsTranslation = Object.keys(LANGUAGE_NAMES_FOR_API).some(lang => {
      const idx = langIdx[lang];
      return idx >= 0 && !values[i][idx];
    });
    if (needsTranslation) wordsToTranslate.push({ rowIndex: i, lemma });
  }

  if (!wordsToTranslate.length) {
    ss.toast('Alla ord är redan översatta.', 'Klar', 3);
    return;
  }

  const BATCH_SIZE = 20;
  for (let b = 0; b < wordsToTranslate.length; b += BATCH_SIZE) {
    const batch = wordsToTranslate.slice(b, b + BATCH_SIZE);
    const results = anropaClaudeBatch_(apiKey, batch.map(w => w.lemma));

    batch.forEach(({ rowIndex, lemma }) => {
      const t = results[lemma] || results[lemma.toLowerCase()] || {};
      Object.entries(t).forEach(([lang, val]) => {
        const idx = langIdx[lang];
        if (idx < 0 || !val || values[rowIndex][idx]) return;
        sheet.getRange(rowIndex + 1, idx + 1).setValue(val.toString().trim());
      });
    });

    if (b + BATCH_SIZE < wordsToTranslate.length) Utilities.sleep(1000);
  }

  ss.toast(`${wordsToTranslate.length} ord översatta.`, 'Klar', 5);
}

function anropaClaudeBatch_(apiKey, lemmas) {
  const langList = Object.entries(LANGUAGE_NAMES_FOR_API)
    .map(([code, name]) => `${code} (${name})`)
    .join(', ');

  const prompt = `Translate these Swedish words to the following languages.
Reply with ONLY a valid JSON object — no explanation, no markdown.
Each key is a Swedish word, the value is an object with language codes as keys and translations as values.
For verbs use the infinitive form. Use the most common everyday translation.

Swedish words: ${JSON.stringify(lemmas)}

Target languages: ${langList}

Example: {"springa": {"en": "run", "es": "correr", "ar": "يركض"}}`;

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    payload: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Claude API-fel (${response.getResponseCode()}): ${response.getContentText()}`);
  }

  const text = JSON.parse(response.getContentText()).content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    Logger.log('Kunde inte parsa Claude-svar: ' + text);
    return {};
  }
}
