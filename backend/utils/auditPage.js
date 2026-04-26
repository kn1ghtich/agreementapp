const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const FONT_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
let cachedFontBytes = null;
function loadFontBytes() {
  if (!cachedFontBytes) cachedFontBytes = fs.readFileSync(FONT_PATH);
  return cachedFontBytes;
}

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()} ` +
         `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

// Перенос строки по словам в пределах maxWidth
function wrapText(font, text, size, maxWidth) {
  const words = String(text == null ? '' : text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (!w) continue;
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      line = trial;
    } else {
      if (line) lines.push(line);
      // Длинное слово, не помещающееся целиком — режем по символам
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let chunk = '';
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            if (chunk) lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      } else {
        line = w;
      }
    }
  }
  if (line) lines.push(line);
  if (lines.length === 0) lines.push('');
  return lines;
}

/**
 * Дописывает в конец PDF лист согласования с информацией о документе,
 * историей статусов и комментариями. На fail возвращает исходный буфер.
 */
async function appendAuditPage(pdfBuffer, document) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(loadFontBytes());

    const PAGE_W = 595, PAGE_H = 842; // A4
    const MARGIN = 40;
    const usableW = PAGE_W - MARGIN * 2;

    const lineColor = rgb(0.85, 0.85, 0.85);
    const headColor = rgb(0.15, 0.15, 0.15);
    const textColor = rgb(0.1, 0.1, 0.1);
    const mutedColor = rgb(0.45, 0.45, 0.45);

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    function newPage() {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }

    function ensureSpace(needed) {
      if (y - needed < MARGIN) newPage();
    }

    function drawLine(x1, y1, x2, y2, color = lineColor) {
      page.drawLine({
        start: { x: x1, y: y1 }, end: { x: x2, y: y2 },
        thickness: 0.5, color
      });
    }

    function drawTextLine(text, x, size, color) {
      page.drawText(String(text == null ? '' : text), {
        x, y, size, font, color
      });
    }

    // ---------- Заголовок ----------
    const titleSize = 18;
    drawTextLine('Лист согласования', MARGIN, titleSize, headColor);
    y -= titleSize + 6;
    drawLine(MARGIN, y, PAGE_W - MARGIN, y, headColor);
    y -= 18;

    // ---------- Карточка документа ----------
    const labelSize = 10;
    const valueSize = 10;
    const labelW = 140;
    const valueX = MARGIN + labelW;
    const valueW = usableW - labelW - 6;

    const info = [
      ['Название', document.title || '—'],
      ['Тип', document.documentType || '—'],
      ['Отправитель', document.sender?.fullName || '—'],
      ['Отдел отправителя', document.senderDepartment || '—'],
      ['Дата создания', fmtDateTime(document.createdAt)],
      ['Срок рассмотрения', fmtDateTime(document.deadline)],
      ['Отделы-получатели', (document.departments || []).join(', ') || '—']
    ];

    for (const [label, value] of info) {
      const lines = wrapText(font, value, valueSize, valueW);
      const blockH = lines.length * (valueSize * 1.35) + 4;
      ensureSpace(blockH);
      drawTextLine(label, MARGIN, labelSize, mutedColor);
      let yy = y;
      for (const ln of lines) {
        page.drawText(ln, { x: valueX, y: yy, size: valueSize, font, color: textColor });
        yy -= valueSize * 1.35;
      }
      y -= blockH;
    }

    y -= 8;

    // ---------- История статусов ----------
    function sectionHeader(title) {
      ensureSpace(40);
      drawTextLine(title, MARGIN, 13, headColor);
      y -= 18;
      drawLine(MARGIN, y, PAGE_W - MARGIN, y);
      y -= 18;
    }

    sectionHeader('История статусов');

    const headerSize = 9;
    const rowSize = 9;
    const colTimeW = 95;
    const colDeptW = 150;
    const colTransW = 145;
    const colByW = usableW - colTimeW - colDeptW - colTransW;
    const colTimeX = MARGIN;
    const colDeptX = colTimeX + colTimeW;
    const colTransX = colDeptX + colDeptW;
    const colByX = colTransX + colTransW;

    function drawHistoryHeader() {
      drawTextLine('Время', colTimeX, headerSize, mutedColor);
      drawTextLine('Отдел', colDeptX, headerSize, mutedColor);
      drawTextLine('Изменение', colTransX, headerSize, mutedColor);
      drawTextLine('Кем', colByX, headerSize, mutedColor);
      y -= headerSize * 1.4 + 4;
      drawLine(MARGIN, y, PAGE_W - MARGIN, y);
      y -= 10;
    }
    drawHistoryHeader();

    const history = (document.statusHistory || []).slice().sort(
      (a, b) => new Date(a.changedAt) - new Date(b.changedAt)
    );

    if (history.length === 0) {
      drawTextLine('Нет записей', MARGIN, rowSize, mutedColor);
      y -= rowSize * 1.4;
    } else {
      for (const h of history) {
        const cells = [
          { text: fmtDateTime(h.changedAt), x: colTimeX, w: colTimeW },
          { text: h.department || '—', x: colDeptX, w: colDeptW },
          {
            text: `${h.fromStatus || '—'} → ${h.toStatus || '—'}`,
            x: colTransX, w: colTransW
          },
          { text: h.changedBy?.fullName || '—', x: colByX, w: colByW }
        ];
        const wrapped = cells.map(c => wrapText(font, c.text, rowSize, c.w - 6));
        const rowLines = Math.max(...wrapped.map(w => w.length));
        const rowH = rowLines * (rowSize * 1.35) + 4;
        ensureSpace(rowH + 6);
        if (y === PAGE_H - MARGIN) {
          // Только что создали новую страницу — продублируем заголовок таблицы.
          drawHistoryHeader();
        }
        const startY = y;
        for (let i = 0; i < cells.length; i++) {
          let yy = startY;
          for (const ln of wrapped[i]) {
            page.drawText(ln, { x: cells[i].x, y: yy, size: rowSize, font, color: textColor });
            yy -= rowSize * 1.35;
          }
        }
        y -= rowH;
      }
    }

    y -= 12;

    // ---------- Комментарии ----------
    sectionHeader('Комментарии согласующих лиц');

    const comments = (document.comments || []).slice().sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    if (comments.length === 0) {
      drawTextLine('Комментариев нет', MARGIN, rowSize, mutedColor);
      y -= rowSize * 1.4;
    } else {
      const authorSize = 10;
      const metaSize = 8;
      const textSize = 10;

      for (const c of comments) {
        const author = c.author?.fullName || 'Неизвестно';
        const authorDept = c.author?.department ? ` · ${c.author.department}` : '';
        const meta = `${fmtDateTime(c.createdAt)}${authorDept}`;
        let bodyText = (c.text || '').trim();
        const fileCount = (c.files && c.files.length) || (c.file?.fileId ? 1 : 0);
        if (!bodyText && fileCount > 0) {
          bodyText = `[Вложений: ${fileCount}]`;
        } else if (!bodyText) {
          bodyText = '[без текста]';
        } else if (fileCount > 0) {
          bodyText += `  [Вложений: ${fileCount}]`;
        }
        const lines = wrapText(font, bodyText, textSize, usableW);
        const blockH = authorSize * 1.35 + lines.length * (textSize * 1.4) + 10;
        ensureSpace(blockH);

        const authorWidth = font.widthOfTextAtSize(author, authorSize);
        page.drawText(author, { x: MARGIN, y, size: authorSize, font, color: headColor });
        page.drawText(meta, {
          x: MARGIN + authorWidth + 8, y, size: metaSize, font, color: mutedColor
        });
        y -= authorSize * 1.35;

        for (const ln of lines) {
          page.drawText(ln, { x: MARGIN, y, size: textSize, font, color: textColor });
          y -= textSize * 1.4;
        }
        y -= 10;
      }
    }

    const out = await pdfDoc.save();
    return Buffer.from(out);
  } catch (err) {
    console.error('Audit page failed:', err);
    return pdfBuffer;
  }
}

module.exports = { appendAuditPage };
