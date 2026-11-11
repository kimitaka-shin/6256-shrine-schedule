function doGet(e) {
  const spreadsheetId = '1eIe0udTznsol57gyXsMwAY1LwjMm9M-FyviS1igMUkw';
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('出店予定');
  let result;
  try {
    if (!sheet) throw new Error('出店予定シートが見つかりません');
    const values = sheet.getDataRange().getDisplayValues();
    const events = values.slice(1).map(row => {
      let date = String(row[0] || '').trim().replace(/\//g, '-');
      if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) return null;
      const [y, m, d] = date.split('-');
      date = y + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0');
      return {
        date,
        status: String(row[1] || '出店予定').trim(),
        startTime: String(row[2] || '').trim(),
        endTime: String(row[3] || '').trim(),
        lastOrder: String(row[4] || '').trim(),
        place: String(row[5] || '高円寺氷川神社').trim(),
        notice: String(row[6] || '').trim()
      };
    }).filter(Boolean);
    events.sort((a, b) => a.date.localeCompare(b.date));
    result = { ok: true, events };
  } catch (error) {
    result = { ok: false, error: String(error), events: [] };
  }
  const callback = e && e.parameter ? e.parameter.callback : '';
  const json = JSON.stringify(result);
  if (callback && /^cb_[A-Za-z0-9_]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
