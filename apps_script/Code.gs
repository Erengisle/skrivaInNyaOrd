function getDashboardData() {
  const sheet = getInputSheet();
  if (!sheet) return { totalWords: 0, perStudent: {}, studentDetails: {}, lastEntries: [] };

  const data = sheet.getDataRange().getValues();
  const stats = { totalWords: 0, perStudent: {}, studentDetails: {}, lastEntries: [] };

  for (let i = 1; i < data.length; i++) {
    const [time, student, word] = data[i];
    if (!student || !word) continue;

    stats.totalWords++;
    stats.perStudent[student] = (stats.perStudent[student] || 0) + 1;
    const timeStr = time instanceof Date ? time.toISOString() : String(time);
    stats.lastEntries.push({ time: timeStr, student: String(student), word: String(word) });

    if (!stats.studentDetails[student]) {
      stats.studentDetails[student] = { count: 0, lastTime: timeStr };
    }
    stats.studentDetails[student].count++;
    if (timeStr > stats.studentDetails[student].lastTime) {
      stats.studentDetails[student].lastTime = timeStr;
    }
  }

  stats.lastEntries = stats.lastEntries.slice(-10).reverse();
  return stats;
}

function getDashboardWords() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(CONFIG.OUTPUT_SHEET);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => h.toString().toLowerCase());
  const idx = {};
  for (const key of ['lemma', 'ordklass', 'frekvens', 'verbgrupp', 'deklination']) {
    idx[key] = headers.indexOf(key);
  }

  return values.slice(1)
    .map(r => {
      const get = key => idx[key] >= 0 ? r[idx[key]] : '';
      return {
        lemma: get('lemma'),
        ordklass: get('ordklass'),
        frekvens: Number(get('frekvens')) || 0,
        verbgrupp: get('verbgrupp'),
        deklination: get('deklination')
      };
    })
    .filter(w => w.lemma);
}
