function getDashboardData() {
  const sheet = getInputSheet();
  const data = sheet.getDataRange().getValues();

  const stats = {
    totalWords: 0,
    perStudent: {},
    lastEntries: []
  };

  // hoppa över rubrikrad
  for (let i = 1; i < data.length; i++) {
    const time = data[i][0];
    const student = data[i][1];
    const word = data[i][2];

    if (!student || !word) continue;

    stats.totalWords++;

    // per elev
    if (!stats.perStudent[student]) {
      stats.perStudent[student] = 0;
    }
    stats.perStudent[student]++;

    // senaste
    stats.lastEntries.push({
      time,
      student,
      word
    });
  }

  stats.lastEntries = stats.lastEntries
    .slice(-10)
    .reverse();

  return stats;
}
