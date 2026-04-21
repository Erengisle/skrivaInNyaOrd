const CONFIG = {
  INPUT_SHEET: 'Svar',
  OUTPUT_SHEET: 'Översikt',
  WORDBANK_SHEET: 'Ordbank',
  LOG_SHEET: 'Logg',
  TIMESTAMP_COLUMN: 1,
  NAME_COLUMN: 2,
  WORD_COLUMN: 3
};

function getInputSheet() {
  return SpreadsheetApp.getActive().getSheetByName(CONFIG.INPUT_SHEET);
}
