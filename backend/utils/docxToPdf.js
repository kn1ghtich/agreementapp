const { promisify } = require('util');

// libreoffice-convert требует установленного LibreOffice (soffice) в системе.
// Если пакет не установлен или LibreOffice отсутствует, экспортируем заглушку.
let convert;
try {
  const libre = require('libreoffice-convert');
  convert = promisify(libre.convert);
} catch (err) {
  console.warn('[docxToPdf] libreoffice-convert не установлен. Конвертация .docx → .pdf отключена.');
  convert = null;
}

/**
 * Конвертирует .docx (Buffer) в .pdf (Buffer).
 * Возвращает null, если конвертация недоступна или завершилась ошибкой.
 */
async function docxBufferToPdf(buffer) {
  if (!convert) return null;
  try {
    const pdfBuf = await convert(buffer, '.pdf', undefined);
    return pdfBuf;
  } catch (err) {
    console.error('[docxToPdf] Ошибка конвертации:', err.message);
    return null;
  }
}

module.exports = { docxBufferToPdf };
