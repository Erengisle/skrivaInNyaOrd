function getDashboardData() {
  const sheet = getInputSheet();
  if (!sheet) return { totalWords: 0, perStudent: {}, lastEntries: [] };

  const data = sheet.getDataRange().getValues();
  const stats = { totalWords: 0, perStudent: {}, lastEntries: [] };

  for (let i = 1; i < data.length; i++) {
    const [time, student, word] = data[i];
    if (!student || !word) continue;

    stats.totalWords++;
    stats.perStudent[student] = (stats.perStudent[student] || 0) + 1;
    stats.lastEntries.push({ time, student, word });
  }

  stats.lastEntries = stats.lastEntries.slice(-10).reverse();
  return stats;
}
