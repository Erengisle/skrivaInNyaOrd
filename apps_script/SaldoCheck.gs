/**
 * SaldoCheck.gs
 *
 * Kontrollerar ord mot SALDO-lexikonet från Språkbanken.
 * API-dokumentation: https://spraakbanken.gu.se/resurser/saldo
 *
 * Kör via: Ordverktyg → Kontrollera kolumn mot SALDO
 *
 * Skriver fem kolumner per kontrollerat ord:
 *   saldo_ordklass  – verb / substantiv / adjektiv osv.
 *   saldo_paradigm  – t.ex. vb_1a_tala, nn_3u_ros
 *   saldo_verbgrupp – 1 / 2a / 2b / 3 / 4  (bara för verb)
 *   saldo_status    – hittad / ej i SALDO / HTTP-fel
 *   saldo_id        – lemgram-ID (t.ex. tala..1)
 */

const SALDO_WS = 'https://spraakbanken.gu.se/ws/saldo-ws';

// Paradigmprefix → svensk ordklassklass
const SALDO_POS_MAP = {
  vb:  'verb',
  nn:  'substantiv',
  jj:  'adjektiv',
  ab:  'adverb',
  pn:  'pronomen',
  pm:  'egennamn',
  pp:  'preposition',
  kn:  'konjunktion',
  sn:  'subjunktion',
  in:  'interjektion',
  nl:  'räkneord',
  mxc: 'sammansättningsled'
};

// ─── SALDO API ─────────────────────────────────────────────────────────────────

/**
 * Slår upp ett ord i SALDO via /fl/json/{ord}.
 * Returnerar det första lemgrammet; allaSenser innehåller alla träffar.
 *
 * @param {string} word  Grundform i lowercase (t.ex. "tala", "hus")
 * @returns {{ hittad, status, ordklass, paradigm, verbgrupp, allaSenser }}
 */
function saldoSlaSuppOrd_(word) {
  const url = SALDO_WS + '/fl/json/' + encodeURIComponent(word);

  try {
    const resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { Accept: 'application/json' }
    });

    const httpCode = resp.getResponseCode();
    if (httpCode !== 200) {
      return { hittad: false, status: 'HTTP ' + httpCode };
    }

    const data = JSON.parse(resp.getContentText('UTF-8'));
    if (!Array.isArray(data) || data.length === 0) {
      return { hittad: false, status: 'ej i SALDO' };
    }

    const senses = data.map(function(e) {
      var paradigm  = e.paradigm || '';
      var ordklass  = tolkaSaldoPos_(paradigm);
      return {
        saldoId:   e.l        || '',
        paradigm:  paradigm,
        ordklass:  ordklass,
        verbgrupp: ordklass === 'verb' ? tolkaSaldoVerbgrupp_(paradigm) : ''
      };
    });

    return {
      hittad:     true,
      status:     'hittad',
      saldoId:    senses[0].saldoId,
      ordklass:   senses[0].ordklass,
      paradigm:   senses[0].paradigm,
      verbgrupp:  senses[0].verbgrupp,
      allaSenser: senses.map(function(s) { return s.saldoId; }).join(', ')
    };

  } catch (err) {
    return { hittad: false, status: 'fel: ' + err.message };
  }
}

/**
 * Plockar ut ordklass från SALDO-paradigmkoden.
 * Ex: "vb_1a_tala" → "verb", "nn_3u_ros" → "substantiv"
 */
function tolkaSaldoPos_(paradigm) {
  if (!paradigm) return '';
  var prefix = paradigm.split('_')[0];
  return SALDO_POS_MAP[prefix] || prefix;
}

/**
 * Mappar SALDO-paradigmkod till svensk verbgrupp.
 * Ex: vb_1a_tala → 1 | vb_2a_lyfta → 2a | vb_2b_söka → 2b
 *     vb_3_bo   → 3 | vb_4a_binda  → 4
 *
 * Okänt mönster returneras rå (t.ex. "5" eller "irr").
 */
function tolkaSaldoVerbgrupp_(paradigm) {
  if (!paradigm || paradigm.indexOf('vb_') !== 0) return '';
  var grp = paradigm.split('_')[1] || '';

  if (grp.charAt(0) === '1') return '1';
  if (grp === '2a')          return '2a';
  if (grp === '2b')          return '2b';
  if (grp.charAt(0) === '3') return '3';
  if (grp.charAt(0) === '4') return '4';
  return grp;
}

// ─── Menyfunktion ──────────────────────────────────────────────────────────────

/**
 * Startpunkt från menyn: frågar användaren om blad och kolumn,
 * kör sedan SALDO-kontrollen.
 */
function kontrolleraKolumnMotSaldo() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActive();

  var sheetResp = ui.prompt(
    'SALDO-kontroll — steg 1 av 2',
    'Vilket blad ska kontrolleras?\n(lämna tomt = aktivt blad)',
    ui.ButtonSet.OK_CANCEL
  );
  if (sheetResp.getSelectedButton() === ui.Button.CANCEL) return;

  var sheetName = sheetResp.getResponseText().trim();
  var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getActiveSheet();
  if (!sheet) {
    ui.alert('Hittade inte bladet "' + sheetName + '".');
    return;
  }

  var colResp = ui.prompt(
    'SALDO-kontroll — steg 2 av 2',
    'Vilken kolumnbokstav innehåller orden?\n(t.ex. A)',
    ui.ButtonSet.OK_CANCEL
  );
  if (colResp.getSelectedButton() === ui.Button.CANCEL) return;

  var colLetter = (colResp.getResponseText().trim() || 'A').toUpperCase();
  korSaldoKontrollPaBlad_(sheet, kolumnBokstavTillIndex_(colLetter));
}

/**
 * Utför SALDO-kontrollen rad för rad och skriver resultaten
 * till fem utgångskolumner i samma blad.
 */
function korSaldoKontrollPaBlad_(sheet, ordKolumn) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert(
      'Bladet behöver minst en rubrikrad och en datarad.'
    );
    return;
  }

  var posKol      = hamtaEllerSkapaKolumn_(sheet, 'saldo_ordklass');
  var paradigmKol = hamtaEllerSkapaKolumn_(sheet, 'saldo_paradigm');
  var verbgrpKol  = hamtaEllerSkapaKolumn_(sheet, 'saldo_verbgrupp');
  var statusKol   = hamtaEllerSkapaKolumn_(sheet, 'saldo_status');
  var idKol       = hamtaEllerSkapaKolumn_(sheet, 'saldo_id');

  var words   = sheet.getRange(2, ordKolumn, lastRow - 1, 1).getValues();
  var hittade = 0, ejHittade = 0, fel = 0;

  for (var i = 0; i < words.length; i++) {
    var word = (words[i][0] || '').toString().trim().toLowerCase();
    var row  = i + 2;
    if (!word) continue;

    if (i > 0 && i % 20 === 0) {
      SpreadsheetApp.getActive().toast(
        'Kontrollerar rad ' + row + ' av ' + lastRow + '…',
        'SALDO', 3
      );
    }

    Utilities.sleep(200); // respektera API:et

    var res = saldoSlaSuppOrd_(word);

    sheet.getRange(row, posKol     ).setValue(res.ordklass   || '');
    sheet.getRange(row, paradigmKol).setValue(res.paradigm   || '');
    sheet.getRange(row, verbgrpKol ).setValue(res.verbgrupp  || '');
    sheet.getRange(row, statusKol  ).setValue(res.status     || '');
    sheet.getRange(row, idKol      ).setValue(res.allaSenser || '');

    if (res.hittad)                                 hittade++;
    else if ((res.status || '').indexOf('fel') === 0) fel++;
    else                                            ejHittade++;
  }

  SpreadsheetApp.getActive().toast(
    'Hittade: ' + hittade +
    '   Ej i SALDO: ' + ejHittade +
    '   Fel: ' + fel,
    'SALDO-kontroll klar', 10
  );
}

// ─── Hjälpfunktioner ───────────────────────────────────────────────────────────

/**
 * Returnerar kolumnnumret för en rubrik; skapar kolumnen om den saknas.
 */
function hamtaEllerSkapaKolumn_(sheet, rubrik) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  for (var i = 0; i < headers.length; i++) {
    if ((headers[i] || '').toString().toLowerCase() === rubrik.toLowerCase()) {
      return i + 1;
    }
  }

  var newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue(rubrik).setFontWeight('bold');
  return newCol;
}

/**
 * Konverterar kolumnbokstav till kolumnnummer.
 * "A" → 1, "Z" → 26, "AA" → 27 osv.
 */
function kolumnBokstavTillIndex_(letter) {
  var n = 0;
  for (var i = 0; i < letter.length; i++) {
    n = n * 26 + (letter.charCodeAt(i) - 64);
  }
  return n;
}
