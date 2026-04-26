/**
 * Google Apps Script for collecting difficult words from students,
 * counting frequency, and estimating Swedish morphology.
 */

// Comprehensive group 4 lookup table built from "Starka verb, lista OCR.pdf"
// and "Lathund för verbgrupperna.xlsx". Key = infinitiv.
const GRUPP4_VERB = {
  // a → u
  binda:     { imperativ:'bind',     presens:'binder',    preteritum:'band',    supinum:'bundit'    },
  brinna:    { imperativ:'brinn',    presens:'brinner',   preteritum:'brann',   supinum:'brunnit'   },
  brista:    { imperativ:'brist',    presens:'brister',   preteritum:'brast',   supinum:'brustit'   },
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
  stinka:    { imperativ:'stink',    presens:'stinker',   preteritum:'stank',   supinum:'stunkit'   },
  vinna:     { imperativ:'vinn',     presens:'vinner',    preteritum:'vann',    supinum:'vunnit'    },
  // i → e → i
  bita:      { imperativ:'bit',      presens:'biter',     preteritum:'bet',     supinum:'bitit'     },
  bli:       { imperativ:'bli',      presens:'blir',      preteritum:'blev',    supinum:'blivit'    },
  bliva:     { imperativ:'bli',      presens:'blir',      preteritum:'blev',    supinum:'blivit'    },
  driva:     { imperativ:'driv',     presens:'driver',    preteritum:'drev',    supinum:'drivit'    },
  glida:     { imperativ:'glid',     presens:'glider',    preteritum:'gled',    supinum:'glidit'    },
  gnida:     { imperativ:'gnid',     presens:'gnider',    preteritum:'gned',    supinum:'gnidit'    },
  gripa:     { imperativ:'grip',     presens:'griper',    preteritum:'grep',    supinum:'gripit'    },
  kliva:     { imperativ:'kliv',     presens:'kliver',    preteritum:'klev',    supinum:'klivit'    },
  knipa:     { imperativ:'knip',     presens:'kniper',    preteritum:'knep',    supinum:'knipit'    },
  lida:      { imperativ:'lid',      presens:'lider',     preteritum:'led',     supinum:'lidit'     },
  pipa:      { imperativ:'pip',      presens:'piper',     preteritum:'pep',     supinum:'pipit'     },
  rida:      { imperativ:'rid',      presens:'rider',     preteritum:'red',     supinum:'ridit'     },
  riva:      { imperativ:'riv',      presens:'river',     preteritum:'rev',     supinum:'rivit'     },
  skina:     { imperativ:'skin',     presens:'skiner',    preteritum:'sken',    supinum:'skinit'    },
  skrika:    { imperativ:'skrik',    presens:'skriker',   preteritum:'skrek',   supinum:'skrikit'   },
  skriva:    { imperativ:'skriv',    presens:'skriver',   preteritum:'skrev',   supinum:'skrivit'   },
  slita:     { imperativ:'slit',     presens:'sliter',    preteritum:'slet',    supinum:'slitit'    },
  smita:     { imperativ:'smit',     presens:'smiter',    preteritum:'smet',    supinum:'smitit'    },
  stiga:     { imperativ:'stig',     presens:'stiger',    preteritum:'steg',    supinum:'stigit'    },
  strida:    { imperativ:'strid',    presens:'strider',   preteritum:'stred',   supinum:'stridit'   },
  svida:     { imperativ:'svid',     presens:'svider',    preteritum:'sved',    supinum:'svidit'    },
  svika:     { imperativ:'svik',     presens:'sviker',    preteritum:'svek',    supinum:'svikit'    },
  tiga:      { imperativ:'tig',      presens:'tiger',     preteritum:'teg',     supinum:'tigit'     },
  vrida:     { imperativ:'vrid',     presens:'vrider',    preteritum:'vred',    supinum:'vridit'    },
  // ju → jö → u
  bjuda:     { imperativ:'bjud',     presens:'bjuder',    preteritum:'bjöd',    supinum:'bjudit'    },
  hugga:     { imperativ:'hugg',     presens:'hugger',    preteritum:'högg',    supinum:'huggit'    },
  ljuga:     { imperativ:'ljug',     presens:'ljuger',    preteritum:'ljög',    supinum:'ljugit'    },
  njuta:     { imperativ:'njut',     presens:'njuter',    preteritum:'njöt',    supinum:'njutit'    },
  sjuda:     { imperativ:'sjud',     presens:'sjuder',    preteritum:'sjöd',    supinum:'sjudit'    },
  sjunga:    { imperativ:'sjung',    presens:'sjunger',   preteritum:'sjöng',   supinum:'sjungit'   },
  sjunka:    { imperativ:'sjunk',    presens:'sjunker',   preteritum:'sjönk',   supinum:'sjunkit'   },
  skjuta:    { imperativ:'skjut',    presens:'skjuter',   preteritum:'sköt',    supinum:'skjutit'   },
  suga:      { imperativ:'sug',      presens:'suger',     preteritum:'sög',     supinum:'sugit'     },
  supa:      { imperativ:'sup',      presens:'super',     preteritum:'söp',     supinum:'supit'     },
  tjuta:     { imperativ:'tjut',     presens:'tjuter',    preteritum:'tjöt',    supinum:'tjutit'    },
  // y → ö → u
  bryta:     { imperativ:'bryt',     presens:'bryter',    preteritum:'bröt',    supinum:'brutit'    },
  flyga:     { imperativ:'flyg',     presens:'flyger',    preteritum:'flög',    supinum:'flugit'    },
  flyta:     { imperativ:'flyt',     presens:'flyter',    preteritum:'flöt',    supinum:'flutit'    },
  frysa:     { imperativ:'frys',     presens:'fryser',    preteritum:'frös',    supinum:'frusit'    },
  knyta:     { imperativ:'knyt',     presens:'knyter',    preteritum:'knöt',    supinum:'knutit'    },
  krypa:     { imperativ:'kryp',     presens:'kryper',    preteritum:'kröp',    supinum:'krupit'    },
  skryta:    { imperativ:'skryt',    presens:'skryter',   preteritum:'skröt',   supinum:'skrutit'   },
  smyga:     { imperativ:'smyg',     presens:'smyger',    preteritum:'smög',    supinum:'smugit'    },
  snyta:     { imperativ:'snyt',     presens:'snyter',    preteritum:'snöt',    supinum:'snutit'    },
  stryka:    { imperativ:'stryk',    presens:'stryker',   preteritum:'strök',   supinum:'strukit'   },
  // Mixed strong
  dra:       { imperativ:'dra',      presens:'drar',      preteritum:'drog',    supinum:'dragit'    },
  draga:     { imperativ:'dra',      presens:'drar',      preteritum:'drog',    supinum:'dragit'    },
  fara:      { imperativ:'far',      presens:'far',       preteritum:'for',     supinum:'farit'     },
  ta:        { imperativ:'ta',       presens:'tar',       preteritum:'tog',     supinum:'tagit'     },
  taga:      { imperativ:'ta',       presens:'tar',       preteritum:'tog',     supinum:'tagit'     },
  slå:       { imperativ:'slå',      presens:'slår',      preteritum:'slog',    supinum:'slagit'    },
  bära:      { imperativ:'bär',      presens:'bär',       preteritum:'bar',     supinum:'burit'     },
  skära:     { imperativ:'skär',     presens:'skär',      preteritum:'skar',    supinum:'skurit'    },
  stjäla:    { imperativ:'stjäl',    presens:'stjäl',     preteritum:'stal',    supinum:'stulit'    },
  svära:     { imperativ:'svär',     presens:'svär',      preteritum:'svor',    supinum:'svurit'    },
  gråta:     { imperativ:'gråt',     presens:'gråter',    preteritum:'grät',    supinum:'gråtit'    },
  låta:      { imperativ:'låt',      presens:'låter',     preteritum:'lät',     supinum:'låtit'     },
  äta:       { imperativ:'ät',       presens:'äter',      preteritum:'åt',      supinum:'ätit'      },
  falla:     { imperativ:'fall',     presens:'faller',    preteritum:'föll',    supinum:'fallit'    },
  hålla:     { imperativ:'håll',     presens:'håller',    preteritum:'höll',    supinum:'hållit'    },
  // Irregular
  vara:      { imperativ:'var',      presens:'är',        preteritum:'var',     supinum:'varit'     },
  gå:        { imperativ:'gå',       presens:'går',       preteritum:'gick',    supinum:'gått'      },
  komma:     { imperativ:'kom',      presens:'kommer',    preteritum:'kom',     supinum:'kommit'    },
  göra:      { imperativ:'gör',      presens:'gör',       preteritum:'gjorde',  supinum:'gjort'     },
  se:        { imperativ:'se',       presens:'ser',       preteritum:'såg',     supinum:'sett'      },
  få:        { imperativ:'få',       presens:'får',       preteritum:'fick',    supinum:'fått'      },
  ge:        { imperativ:'ge',       presens:'ger',       preteritum:'gav',     supinum:'gett'      },
  giva:      { imperativ:'ge',       presens:'ger',       preteritum:'gav',     supinum:'gett'      },
  sova:      { imperativ:'sov',      presens:'sover',     preteritum:'sov',     supinum:'sovit'     },
  be:        { imperativ:'be',       presens:'ber',       preteritum:'bad',     supinum:'bett'      },
  bedja:     { imperativ:'be',       presens:'ber',       preteritum:'bad',     supinum:'bett'      },
  dö:        { imperativ:'dö',       presens:'dör',       preteritum:'dog',     supinum:'dött'      },
  le:        { imperativ:'le',       presens:'ler',       preteritum:'log',     supinum:'lett'      },
  stå:       { imperativ:'stå',      presens:'står',      preteritum:'stod',    supinum:'stått'     },
  ha:        { imperativ:'ha',       presens:'har',       preteritum:'hade',    supinum:'haft'      },
  hava:      { imperativ:'ha',       presens:'har',       preteritum:'hade',    supinum:'haft'      },
  leva:      { imperativ:'lev',      presens:'lever',     preteritum:'levde',   supinum:'levt'      },
  ligga:     { imperativ:'ligg',     presens:'ligger',    preteritum:'låg',     supinum:'legat'     },
  heta:      { imperativ:'heta',     presens:'heter',     preteritum:'hette',   supinum:'hetat'     },
  // From svenska_verb_lista.pdf — compound/prefixed strong verbs
  anhålla:   { imperativ:'anhåll',   presens:'anhåller',  preteritum:'anhöll',  supinum:'anhållit'  },
  avlida:    { imperativ:'avlid',    presens:'avlider',   preteritum:'avled',   supinum:'avlidit'   },
  bedriva:   { imperativ:'bedriv',   presens:'bedriver',  preteritum:'bedrev',  supinum:'bedrivit'  },
  begripa:   { imperativ:'begrip',   presens:'begriper',  preteritum:'begrep',  supinum:'begripit'  },
  behålla:   { imperativ:'behåll',   presens:'behåller',  preteritum:'behöll',  supinum:'behållit'  },
  beskära:   { imperativ:'beskär',   presens:'beskär',    preteritum:'beskar',  supinum:'beskurit'  },
  finnas:    { imperativ:'',         presens:'finns',     preteritum:'fanns',   supinum:'funnits'   },
  förbjuda:  { imperativ:'förbjud',  presens:'förbjuder', preteritum:'förbjöd', supinum:'förbjudit' },
  föreslå:   { imperativ:'föreslå',  presens:'föreslår',  preteritum:'föreslog',supinum:'föreslagit'},
  förtiga:   { imperativ:'förtig',   presens:'förtiger',  preteritum:'förteg',  supinum:'förtigit'  },
  svärja:    { imperativ:'svärj',    presens:'svärjer',   preteritum:'svor',    supinum:'svurit'    },
  // Mixed/irregular — vowel change but treated as grupp 4
  sälja:     { imperativ:'sälj',    presens:'säljer',    preteritum:'sålde',   supinum:'sålt'      },
  svälja:    { imperativ:'svälj',   presens:'sväljer',   preteritum:'svalde',  supinum:'svalt'     },
  ställa:    { imperativ:'ställ',   presens:'ställer',   preteritum:'ställde', supinum:'ställt'    },
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

  const ss = SpreadsheetApp.getActive();
  const input = hamtaEllerSkapaBlad_(ss, CONFIG.INPUT_SHEET);
  const rows = cleaned.map(word => [new Date(), student, word]);
  input.getRange(input.getLastRow() + 1, 1, rows.length, 3).setValues(rows);

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

  const words = values.slice(1)
    .map(r => (r[2] || '').toString().trim().toLowerCase())
    .filter(arEttOrd_);

  const freq = {};
  words.forEach(w => (freq[w] = (freq[w] || 0) + 1));

  const result = Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a] || a.localeCompare(b, 'sv'))
    .map(word => {
      const ordklass = gissaOrdklass_(word);
      return { lemma: word, ordklass, frekvens: freq[word], ...analyseraOrdMedAdapter_(word, ordklass) };
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

  return values.slice(1)
    .map(r => {
      const get = key => idx[key] >= 0 ? r[idx[key]] : '';
      const translations = {};
      LANGUAGES.forEach(lang => {
        translations[lang] = langIdx[lang] >= 0 ? (r[langIdx[lang]] || '') : '';
      });
      const translation = language ? (translations[language] || '') : '';
      return {
        lemma: get('lemma'),
        ordklass: get('ordklass'),
        frekvens: get('frekvens'),
        deklination: get('deklination'),
        verbgrupp: get('verbgrupp'),
        translation,
        translations
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
  return 'övrigt';
}

function analyseraVerb_(lemma) {
  // 1. Direct lookup in group 4 table (by infinitiv)
  if (GRUPP4_VERB[lemma]) {
    return { verbgrupp: '4', infinitiv: lemma, ...GRUPP4_VERB[lemma] };
  }

  // 2. Lookup by imperativ form (student may have entered the imperativ)
  const byImperativ = Object.entries(GRUPP4_VERB).find(([, d]) => d.imperativ === lemma);
  if (byImperativ) {
    const [infinitiv, d] = byImperativ;
    return { verbgrupp: '4', infinitiv, ...d };
  }

  // 3. Rule-based fallback for groups 1–3
  // Grupp 1: infinitiv ends in unstressed -a
  if (lemma.endsWith('a')) {
    const stem = lemma.slice(0, -1);
    return { verbgrupp: '1', infinitiv: lemma, imperativ: stem, presens: `${stem}ar`, preteritum: `${stem}ade`, supinum: `${stem}at` };
  }

  // Grupp 3: imperativ ends in stressed vowel (short words like tro, bo, sy, klä, nå, må)
  if (/[aeiouåäöyuAEIOUÅÄÖY]$/.test(lemma)) {
    return { verbgrupp: '3', infinitiv: lemma, imperativ: lemma, presens: `${lemma}r`, preteritum: `${lemma}dde`, supinum: `${lemma}tt` };
  }

  // Grupp 2b: imperativ ends in p, t, k, s, x
  if (/[ptksx]$/.test(lemma)) {
    return { verbgrupp: '2b', infinitiv: `${lemma}a`, imperativ: lemma, presens: `${lemma}er`, preteritum: `${lemma}te`, supinum: `${lemma}t` };
  }

  // Grupp 2a: imperativ ends in other consonant
  return { verbgrupp: '2a', infinitiv: `${lemma}a`, imperativ: lemma, presens: `${lemma}er`, preteritum: `${lemma}de`, supinum: `${lemma}t` };
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
  return /^[A-Za-zÅÄÖåäöÉéÜü-]{2,}( [A-Za-zÅÄÖåäö]{1,3})?$/.test(value);
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
    .addItem('Lägg till ordklass-dropdown', 'konfigureraOrdklassDropdown')
    .addSeparator()
    .addItem('Skapa tom Ordbank', 'initieraOrdbank')
    .addItem('Bygg Ordbank från Översikt', 'byggOrdbankFranOversikt')
    .addSeparator()
    .addItem('Översätt ord med AI', 'oversattAllaOrd')
    .addItem('Analysera grammatik med AI', 'analyseraGrammatikMedAI')
    .addItem('Ange API-nyckel', 'sattApiNyckel')
    .addToUi();
}

function konfigureraOrdklassDropdown() {
  const ss = SpreadsheetApp.getActive();
  const sheets = [
    ss.getSheetByName(CONFIG.OUTPUT_SHEET),
    ss.getSheetByName(CONFIG.WORDBANK_SHEET)
  ].filter(Boolean);

  if (!sheets.length) {
    SpreadsheetApp.getUi().alert('Varken Översikt eller Ordbank hittades. Kör "Uppdatera översikt" först.');
    return;
  }

  let totalChanged = 0;

  sheets.forEach(sheet => {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => h.toString().toLowerCase());
    const col = headers.indexOf('ordklass');
    if (col < 0) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const range = sheet.getRange(2, col + 1, lastRow - 1, 1);

    // Step 1: clear any existing validation so it can't block writes
    range.clearDataValidations();

    // Step 2: replace "okänd" (any case/spacing) with "övrigt"
    const values = range.getValues();
    values.forEach(row => {
      if ((row[0] || '').toString().trim().toLowerCase() === 'okänd') {
        row[0] = 'övrigt';
        totalChanged++;
      }
    });
    range.setValues(values);

    // Step 3: apply the new dropdown validation
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['verb', 'substantiv', 'adjektiv', 'övrigt'], true)
      .setAllowInvalid(false)
      .build();
    range.setDataValidation(rule);
  });

  SpreadsheetApp.getActive().toast(
    `Dropdown tillagd. ${totalChanged} celler ändrade från "okänd" till "övrigt".`,
    'Klar', 5
  );
}

// ── AI-grammatikanalys ───────────────────────────────────────────────────────

const GRAMMAR_KEYS = ['ordklass', 'deklination', 'verbgrupp', 'infinitiv', 'imperativ', 'presens', 'preteritum', 'supinum'];

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
      lemma:           (r[idx.lemma]      || '').toString().trim(),
      existingOrdklass: idx.ordklass  >= 0 ? (r[idx.ordklass]  || '').toString().trim() : '',
      existingGrupp:    idx.verbgrupp >= 0 ? (r[idx.verbgrupp] || '').toString().trim() : ''
    }))
    .filter(w => w.lemma);

  if (!words.length) return;

  // Clear data validation on ordklass column before writing to avoid user-defined validation errors
  const lastRow = oversikt.getLastRow();
  if (idx.ordklass >= 0 && lastRow >= 2) {
    oversikt.getRange(2, idx.ordklass + 1, lastRow - 1, 1).clearDataValidations();
  }

  // Build Ordbank lookup so we can update grammar there too (without wiping translations)
  const wordbank = ss.getSheetByName(CONFIG.WORDBANK_SHEET);
  let wbIdx = null;
  const wbLemmaRow = {};
  if (wordbank) {
    const wbHeaders = wordbank.getRange(1, 1, 1, wordbank.getLastColumn()).getValues()[0]
      .map(h => h.toString().toLowerCase());
    wbIdx = {};
    for (const key of ['lemma', ...GRAMMAR_KEYS]) wbIdx[key] = wbHeaders.indexOf(key);
    if (wbIdx.ordklass >= 0 && wordbank.getLastRow() >= 2) {
      wordbank.getRange(2, wbIdx.ordklass + 1, wordbank.getLastRow() - 1, 1).clearDataValidations();
    }
    wordbank.getDataRange().getValues().slice(1).forEach((r, i) => {
      const lemma = (r[wbIdx.lemma] || '').toString().trim();
      if (lemma) wbLemmaRow[lemma] = i + 1;
    });
  }

  const VERB_KEYS = new Set(['verbgrupp','infinitiv','imperativ','presens','preteritum','supinum']);

  const BATCH_SIZE = 20;
  for (let b = 0; b < words.length; b += BATCH_SIZE) {
    const batch = words.slice(b, b + BATCH_SIZE);
    const results = anropaClaudeGrammatik_(apiKey, batch.map(w => w.lemma));

    batch.forEach(({ rowIndex, lemma, existingOrdklass, existingGrupp }) => {
      const analysis = results[lemma] || results[lemma.toLowerCase()] || {};

      // Columns B (ordklass) and E (verbgrupp) are protected: never overwrite if already set.
      // If verbgrupp is set but ordklass is empty, the word is definitely a verb.
      const effectiveOrdklass = existingOrdklass ||
        (existingGrupp ? 'verb' : '') ||
        analysis.ordklass || '';
      if (!effectiveOrdklass) return;

      if (effectiveOrdklass === 'verb') {
        // Use lemma as fallback imperativ if AI didn't return one,
        // so grupp 1 verbs like "korsa" still get correct forms derived.
        const imperativ = (analysis.imperativ || '').trim() || lemma;
        const forms = bojaVerbFranImperativ_(imperativ, lemma, existingGrupp || null);
        if (forms.verbgrupp) Object.assign(analysis, forms);
      }

      const writeCell = (sheet, sheetIdx, key) => {
        if (sheetIdx[key] < 0) return;
        if (key === 'ordklass' && existingOrdklass) return;   // B protected
        if (key === 'verbgrupp' && existingGrupp) return;     // E protected
        if (effectiveOrdklass !== 'verb' && VERB_KEYS.has(key)) return; // skip verb fields for non-verbs
        const val = key === 'ordklass' ? effectiveOrdklass : (analysis[key] || '');
        sheet.getRange(rowIndex + 1, sheetIdx[key] + 1).setValue(val);
      };

      GRAMMAR_KEYS.forEach(key => writeCell(oversikt, idx, key));

      if (wordbank && wbIdx) {
        const wbRow = wbLemmaRow[lemma];
        if (wbRow !== undefined) {
          GRAMMAR_KEYS.forEach(key => {
            if (wbIdx[key] < 0) return;
            if (key === 'ordklass' && existingOrdklass) return;
            if (key === 'verbgrupp' && existingGrupp) return;
            if (effectiveOrdklass !== 'verb' && VERB_KEYS.has(key)) return;
            const val = key === 'ordklass' ? effectiveOrdklass : (analysis[key] || '');
            wordbank.getRange(wbRow + 1, wbIdx[key] + 1).setValue(val);
          });
        }
      }
    });

    if (b + BATCH_SIZE < words.length) Utilities.sleep(1000);
  }

  ss.toast('Grammatikanalys klar — Översikt och Ordbank uppdaterade.', 'Klar', 5);
}

function bojaVerbFranImperativ_(imperativ, originalLemma, forcedGrupp) {
  const imp = (imperativ || '').trim().toLowerCase();
  const lem = (originalLemma || '').trim().toLowerCase();

  // Group 4: direct lookup by imperativ or lemma as infinitiv key
  for (const [infinitiv, d] of Object.entries(GRUPP4_VERB)) {
    if (d.imperativ === imp) return { verbgrupp: '4', infinitiv, ...d };
  }
  if (lem && GRUPP4_VERB[lem]) return { verbgrupp: '4', infinitiv: lem, ...GRUPP4_VERB[lem] };

  // Group 4: look up lemma across ALL stored forms (handles preteritum/supinum submitted as lemma)
  const byAllForms = slaUppAllaVerbFormer_(lem);
  if (byAllForms) return byAllForms;

  // Compound verb: strip prefix and match base in any lookup table
  const compound = finnSammansattVerb_(imp) || (lem !== imp && finnSammansattVerb_(lem));
  if (compound) return compound;

  if (!imp) return {};

  // Determine group: respect teacher's existing value, else derive from imperativ ending
  const grupp = forcedGrupp && ['1','2a','2b','3','4'].includes(forcedGrupp)
    ? forcedGrupp
    : imp.endsWith('a') ? '1'
    : /[eiouåäöy]$/.test(imp) ? '3'
    : /[ptksx]$/.test(imp) ? '2b'
    : '2a';

  if (grupp === '1') {
    const imperativFull = imp.endsWith('a') ? imp : imp + 'a';
    const stem = imperativFull.slice(0, -1);
    return { verbgrupp: '1', infinitiv: imperativFull, imperativ: imperativFull,
      presens: stem + 'ar', preteritum: stem + 'ade', supinum: stem + 'at' };
  }
  if (grupp === '3') {
    return { verbgrupp: '3', infinitiv: imp, imperativ: imp,
      presens: imp + 'r', preteritum: imp + 'dde', supinum: imp + 'tt' };
  }
  if (grupp === '2b') {
    return { verbgrupp: '2b', infinitiv: imp + 'a', imperativ: imp,
      presens: imp + 'er', preteritum: imp + 'te', supinum: imp + 't' };
  }
  // 2a (default)
  return { verbgrupp: '2a', infinitiv: imp + 'a', imperativ: imp,
    presens: imp + 'er', preteritum: imp + 'de', supinum: imp + 't' };
}

// Verbs where AI commonly drops the final consonant from the stem,
// particularly -lj and -rj endings. Also used for compound detection.
const VERB_UTÖKAT = {
  följa:   { verbgrupp:'2a', imperativ:'följ',   presens:'följer',   preteritum:'följde',   supinum:'följt'   },
  välja:   { verbgrupp:'2a', imperativ:'välj',   presens:'väljer',   preteritum:'valde',    supinum:'valt'    },
  röja:    { verbgrupp:'2a', imperativ:'röj',    presens:'röjer',    preteritum:'röjde',    supinum:'röjt'    },
  // Verbs where presens = imperativ (no -er/-ar suffix)
  röra:    { verbgrupp:'2a', imperativ:'rör',    presens:'rör',      preteritum:'rörde',    supinum:'rört'    },
  höra:    { verbgrupp:'2a', imperativ:'hör',    presens:'hör',      preteritum:'hörde',    supinum:'hört'    },
  köra:    { verbgrupp:'2a', imperativ:'kör',    presens:'kör',      preteritum:'körde',    supinum:'kört'    },
  föra:    { verbgrupp:'2a', imperativ:'för',    presens:'för',      preteritum:'förde',    supinum:'fört'    },
  störa:   { verbgrupp:'2a', imperativ:'stör',   presens:'stör',     preteritum:'störde',   supinum:'stört'   },
};

const VERB_PREFIXES = [
  'återupp', 'åter', 'under', 'vidare', 'över', 'bort', 'fram', 'till',
  'upp', 'ned', 'ner', 'sam', 'an', 'av', 'be', 'för', 'in', 'om', 'på', 'ut',
  'små', 'stor', 'halv', 'ny'
].sort((a, b) => b.length - a.length);

function slaUppAllaVerbFormer_(form) {
  if (!form) return null;
  const f = form.toLowerCase();
  // GRUPP4_VERB — always verbgrupp '4'
  if (GRUPP4_VERB[f]) return { verbgrupp: '4', infinitiv: f, ...GRUPP4_VERB[f] };
  for (const [infinitiv, d] of Object.entries(GRUPP4_VERB)) {
    if (d.imperativ === f || d.presens === f || d.preteritum === f || d.supinum === f) {
      return { verbgrupp: '4', infinitiv, ...d };
    }
  }
  // VERB_UTÖKAT — verbgrupp stored in each entry
  if (VERB_UTÖKAT[f]) return { infinitiv: f, ...VERB_UTÖKAT[f] };
  for (const [infinitiv, d] of Object.entries(VERB_UTÖKAT)) {
    if (d.imperativ === f || d.presens === f || d.preteritum === f || d.supinum === f) {
      return { infinitiv, ...d };
    }
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
          verbgrupp:   result.verbgrupp,
          infinitiv:   prefix + result.infinitiv,
          imperativ:   prefix + (result.imperativ || ''),
          presens:     prefix + result.presens,
          preteritum:  prefix + result.preteritum,
          supinum:     prefix + result.supinum
        };
      }
    }
  }
  return null;
}

function anropaClaudeGrammatik_(apiKey, lemmas) {
  const prompt = `You are an expert in Swedish morphology. Analyze these Swedish words.
Reply with ONLY a valid JSON object — no explanation, no markdown, no code fences.

YOUR ONLY JOB FOR VERBS is to provide:
1. ordklass = "verb"
2. imperativ = the imperative stem of the verb (this is the ONLY verb field that matters — all other forms are computed by code)

IMPERATIV RULES:
- Grupp 1 (imperativ ends in -a): cykla→cykla, arbeta→arbeta, hoppa→hoppa
- Grupp 2a (imperativ ends in consonant NOT p/t/k/s/x): leva→lev, bygga→bygg, stänga→stäng
- Grupp 2b (imperativ ends in p/t/k/s/x): köpa→köp, söka→sök, läsa→läs, åka→åk
- Grupp 3 (imperativ ends in stressed vowel): tro→tro, bo→bo, sy→sy
- Grupp 4 (strong/irregular): skriva→skriv, springa→spring, dricka→drick, vara→var, gå→gå, komma→kom
IMPORTANT: For verbs with stems ending in -lj or -rj, keep the j: följa→följ (NOT föl), välja→välj (NOT väl), svälja→svälj (NOT sväl), förfölja→förfölj (NOT förföl)

ADVERBS vs ADJECTIVES:
- Adverbs and particles (snabbt, fort, gärna, ofta, alltid, aldrig, inte, bara) → ordklass "övrigt"
- Only use "adjektiv" for words that inflect for gender/number (snabb/snabbt/snabba)

NOUN DECLENSION:
- Dekl 1: en-words ending in -a, plural -or (flicka, stuga)
- Dekl 2: en-words, plural -ar (bil, pojke, arm)
- Dekl 3: en-words, plural -er (tid, stad, hand)
- Dekl 4: ett-words, plural -n (äpple, hjärta)
- Dekl 5: invariant plural (hus, barn, rum)

Each key = a Swedish word. Value = object with:
- ordklass: "verb", "substantiv", "adjektiv", or "övrigt"
- verbs: imperativ ONLY (do not invent presens/preteritum/supinum)
- nouns: deklination
- others: just ordklass

Swedish words: ${JSON.stringify(lemmas)}

Example:
{"springa":{"ordklass":"verb","imperativ":"spring"},"hus":{"ordklass":"substantiv","deklination":"5"},"snabb":{"ordklass":"adjektiv"},"fort":{"ordklass":"övrigt"},"söka":{"ordklass":"verb","imperativ":"sök"},"cykla":{"ordklass":"verb","imperativ":"cykla"}}`;

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    payload: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
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

  const BATCH_SIZE = 10;
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
      max_tokens: 8192,
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
