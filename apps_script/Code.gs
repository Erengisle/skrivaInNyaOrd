/**
 * Google Apps Script for collecting difficult words from students,
 * counting frequency, and estimating Swedish verb forms + verb group.
 *
 * Expected sheet structure:
 * - Sheet "Svar":
 *   Col A: Timestamp (autofill when using web app)
 *   Col B: Elev (optional)
 *   Col C: Ord (required, exactly one word)
 *
 * Generated sheets:
 * - "Översikt": lemma, ordklass, frekvens, verbgrupp, infinitiv, imperativ,
 *               presens, preteritum, supinum.
 */

const INPUT_SHEET = 'Svar';
const OUTPUT_SHEET = 'Översikt';

/**
 * Publishes an input page for students.
 */
function doGet() {
  const html = hamtaHtmlMedFallback_();
  return HtmlService.createHtmlOutput(html)
    .setTitle('Svåra ord')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Loads Index.html if present; otherwise returns a minimal fallback page
 * so the app still works even if the HTML file was not copied yet.
 */
function hamtaHtmlMedFallback_() {
  const candidates = ['Index', 'index'];

  for (let i = 0; i < candidates.length; i++) {
    try {
      return HtmlService.createHtmlOutputFromFile(candidates[i]).getContent();
    } catch (err) {
      // Try next candidate.
    }
  }

  return [
    '<!DOCTYPE html>',
    '<html lang="sv"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Svåra ord</title></head><body style="font-family:system-ui;padding:20px;max-width:700px">',
    '<h1>HTML-filen saknas</h1>',
    '<p>Kunde inte hitta <strong>Index.html</strong> i Apps Script-projektet.</p>',
    '<p>Lägg till filen och deploya igen. Under tiden kan du mata in ord direkt i bladet <code>Svar</code> kolumn C.</p>',
    '</body></html>'
  ].join('');
}

/**
 * Receives one submitted word from the web app and stores it in Svar.
 * @param {{word:string, student?:string}} payload
 * @return {{ok:boolean, message:string}}
 */
function submitWord(payload) {
  const word = (payload.word || '').toString().trim().toLowerCase();
  const student = (payload.student || '').toString().trim();

  if (!arEttOrd_(word)) {
    return { ok: false, message: 'Skriv exakt ett ord (inga mellanslag).' };
  }

  return submitWords({ words: [word], student: student });
}

/**
 * Receives many one-word entries and stores one row per word in Svar.
 * @param {{words:string[], student?:string}} payload
 * @return {{ok:boolean, message:string}}
 */
function submitWords(payload) {
  const words = Array.isArray(payload.words) ? payload.words : [];
  const student = (payload.student || '').toString().trim();

  const cleaned = words
    .map(w => (w || '').toString().trim().toLowerCase())
    .filter(arEttOrd_);

  if (!cleaned.length) {
    return { ok: false, message: 'Inga giltiga enordsinmatningar hittades.' };
  }

  const ss = SpreadsheetApp.getActive();
  const input = hamtaEllerSkapaBlad_(ss, INPUT_SHEET);

  const rows = cleaned.map(word => [new Date(), student, word]);
  input.getRange(input.getLastRow() + 1, 1, rows.length, 3).setValues(rows);

  return {
    ok: true,
    message: cleaned.length + ' ord sparades.'
  };
}

function uppdateraOversikt() {
  const ss = SpreadsheetApp.getActive();
  const input = ss.getSheetByName(INPUT_SHEET);
  if (!input) {
    throw new Error('Hittar inte bladet "' + INPUT_SHEET + '".');
  }

  const values = input.getDataRange().getValues();
  if (values.length < 2) {
    skrivUtOversikt_(ss, []);
    return;
  }

  const rows = values.slice(1); // skip header
  const words = rows
    .map(r => (r[2] || '').toString().trim().toLowerCase())
    .filter(arEttOrd_);

  const freq = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });

  const result = Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a] || a.localeCompare(b, 'sv'))
    .map(word => {
      const ordklass = gissaOrdklass_(word);
      const verb = ordklass === 'verb' ? analyseraVerb_(word) : tomVerbAnalys_();

      return {
        lemma: word,
        ordklass,
        frekvens: freq[word],
        ...verb
      };
    });

  skrivUtOversikt_(ss, result);
}

function skrivUtOversikt_(ss, rows) {
  let output = ss.getSheetByName(OUTPUT_SHEET);
  if (!output) {
    output = ss.insertSheet(OUTPUT_SHEET);
  }

  output.clear();
  const headers = [
    'lemma',
    'ordklass',
    'frekvens',
    'verbgrupp',
    'infinitiv',
    'imperativ',
    'presens',
    'preteritum',
    'supinum'
  ];

  output.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (!rows.length) {
    return;
  }

  const values = rows.map(r => [
    r.lemma,
    r.ordklass,
    r.frekvens,
    r.verbgrupp,
    r.infinitiv,
    r.imperativ,
    r.presens,
    r.preteritum,
    r.supinum
  ]);

  output.getRange(2, 1, values.length, headers.length).setValues(values);
  output.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  output.autoResizeColumns(1, headers.length);
}

/**
 * Adds data validation in column C so only a single word is accepted.
 */
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

/**
 * Optional edit trigger for manual edits in sheet.
 */
function onEdit(e) {
  const range = e && e.range;
  if (!range) return;

  const sheet = range.getSheet();
  if (sheet.getName() !== INPUT_SHEET || range.getColumn() !== 3 || range.getRow() < 2) {
    return;
  }

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
  // Minimal heuristic. For robust tagging, connect to a proper lexicon/API.
  if (word.endsWith('a') || word.endsWith('era') || word.endsWith('ar')) {
    return 'verb';
  }
  if (word.endsWith('ning') || word.endsWith('het') || word.endsWith('else')) {
    return 'substantiv';
  }
  if (word.endsWith('ig') || word.endsWith('isk') || word.endsWith('ad')) {
    return 'adjektiv';
  }
  return 'okänd';
}

function tomVerbAnalys_() {
  return {
    verbgrupp: '',
    infinitiv: '',
    imperativ: '',
    presens: '',
    preteritum: '',
    supinum: ''
  };
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

  if (irregular[lemma]) {
    return irregular[lemma];
  }

  // Group 1: -a, present -ar, preterite -ade, supine -at
  if (lemma.endsWith('a')) {
    const stem = lemma.slice(0, -1);
    return {
      verbgrupp: '1',
      infinitiv: lemma,
      imperativ: stem,
      presens: stem + 'ar',
      preteritum: stem + 'ade',
      supinum: stem + 'at'
    };
  }

  // Group 3: short verbs (bo, tro) often -r / -dde / -tt
  if (lemma.length <= 4) {
    return {
      verbgrupp: '3',
      infinitiv: lemma,
      imperativ: lemma,
      presens: lemma + 'r',
      preteritum: lemma + 'dde',
      supinum: lemma + 'tt'
    };
  }

  // Default weak pattern as fallback (group 2b-ish)
  return {
    verbgrupp: '2b (gissning)',
    infinitiv: lemma,
    imperativ: lemma,
    presens: lemma + 'er',
    preteritum: lemma + 'de',
    supinum: lemma + 't'
  };
}

function arEttOrd_(value) {
  return /^[A-Za-zÅÄÖåäöÉéÜü]+$/.test(value);
}

function hamtaEllerSkapaBlad_(ss, namn) {
  let sheet = ss.getSheetByName(namn);
  if (!sheet) {
    sheet = ss.insertSheet(namn);
  }
  return sheet;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ordverktyg')
    .addItem('Uppdatera översikt', 'uppdateraOversikt')
    .addItem('Konfigurera enords-validering', 'konfigureraValidering')
    .addToUi();
}
