const fs = require('fs');
const path = require('path');
const { PDFDocument, degrees, rgb } = require('pdf-lib');
const pdfLibFontkit = require('@pdf-lib/fontkit');

const FONT_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
let cachedFontBytes = null;
let cachedFkFont = null;
function loadFontBytes() {
  if (!cachedFontBytes) {
    cachedFontBytes = fs.readFileSync(FONT_PATH);
  }
  return cachedFontBytes;
}
function loadFkFont() {
  if (!cachedFkFont) {
    // @pdf-lib/fontkit — это пре-собранный fontkit; .create(bytes) доступен.
    cachedFkFont = pdfLibFontkit.create(loadFontBytes());
  }
  return cachedFkFont;
}

const DIAG_TEXT = 'АО «Центр медицинских технологий и информационных систем» МЦ УДП РК';

function formatDate(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Строит SVG-path строку для заданного текста в виде векторных контуров
 * (глифы, склеенные в единый "d"). Текст получается невыделяемым в PDF.
 * Возвращает { d, width, height } где width/height — размеры в единицах PDF.
 */
function buildTextSvg(fkFont, text, fontSize) {
  const run = fkFont.layout(text);
  const scale = fontSize / fkFont.unitsPerEm;
  let penX = 0;
  const parts = [];
  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i];
    const pos = run.positions[i];
    const gx = penX + (pos.xOffset || 0) * scale;
    // У TrueType-глифов Y направлен вверх, а drawSvgPath трактует SVG
    // с Y-вниз, поэтому инвертируем вертикаль при масштабировании.
    const d = glyph.path.scale(scale, -scale).translate(gx, 0).toSVG();
    if (d) parts.push(d);
    penX += (pos.xAdvance || 0) * scale;
  }
  const ascent = (fkFont.ascent || fkFont.unitsPerEm) * scale;
  return { d: parts.join(' '), width: penX, height: ascent };
}

/**
 * Рисует строку векторными контурами в точке (x,y) с поворотом angleDeg
 * вокруг (x,y). Поворот реализован через опцию rotate у drawSvgPath.
 */
function drawVectorText(page, svg, {
  x, y, color, opacity, angleDeg, borderWidth = 0, borderColor = null, borderOpacity = null
}) {
  const opts = {
    x,
    y,
    color,
    opacity,
    rotate: degrees(angleDeg),
    borderWidth
  };
  if (borderWidth > 0 && borderColor) {
    opts.borderColor = borderColor;
    if (borderOpacity != null) opts.borderOpacity = borderOpacity;
  }
  page.drawSvgPath(svg, opts);
}

/**
 * Накладывает водяной знак на PDF (векторными контурами — невыделяемый текст):
 *   — одна жирная диагональная строка по центру страницы
 *   — вертикальная подпись справа с датой утверждения
 * Если что-то падает, возвращает исходный буфер без изменений.
 */
async function addWatermark(pdfBuffer, approvedAt) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    pdfDoc.registerFontkit(pdfLibFontkit);
    // embedFont нужен лишь для точного измерения ширины при подборе размера
    const font = await pdfDoc.embedFont(loadFontBytes());
    const fkFont = loadFkFont();
    const pages = pdfDoc.getPages();
    const diagColor = rgb(0.4, 0.4, 0.4);
    const sideColor = rgb(0.4, 0.4, 0.4);
    const dateStr = formatDate(approvedAt || new Date());
    const sideText =
      `Копия документа утверждена Президентом АО ЦМТИС, дата утверждения: ${dateStr}`;

    for (const page of pages) {
      const { width: W, height: H } = page.getSize();

      // --- Диагональный водяной знак (одна жирная строка) ---
      const diagonal = Math.sqrt(W * W + H * H);
      const target = diagonal * 0.88; // оставляем небольшие поля от углов
      const baseSize = 40;
      const textWidth40 = font.widthOfTextAtSize(DIAG_TEXT, baseSize);
      const fitSize = (baseSize * target) / textWidth40;
      // Уменьшено ~на 15% от fitSize, чтобы текст не упирался в углы.
      const size = Math.max(14, Math.min(60, fitSize * 0.855));
      const textHeight = size * 0.72;
      const theta = Math.PI / 4;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const cx = W / 2;
      const cy = H / 2;

      const svg = buildTextSvg(fkFont, DIAG_TEXT, size);
      const lineWidth = svg.width;

      // Центрируем прямоугольник строки по центру страницы с учётом поворота
      const offsetX = (lineWidth / 2) * cos - (textHeight / 2) * sin;
      const offsetY = (lineWidth / 2) * sin + (textHeight / 2) * cos;

      drawVectorText(page, svg.d, {
        x: cx - offsetX,
        y: cy - offsetY,
        color: diagColor,
        opacity: 0.22,
        angleDeg: 45,
        // Обводка тем же цветом утолщает штрихи — эффект "жирного" без
        // отдельного Bold-шрифта. ~5% от кегля даёт заметную, но не кричащую
        // прибавку толщины.
        borderWidth: size * 0.05,
        borderColor: diagColor,
        borderOpacity: 0.22
      });

      // --- Вертикальный боковой текст (справа, мелким шрифтом) ---
      const sideSize = 9;
      const sideWidth = font.widthOfTextAtSize(sideText, sideSize);
      const finalSideSize =
        sideWidth > H - 40 ? sideSize * ((H - 40) / sideWidth) : sideSize;
      const finalSideSvg = buildTextSvg(fkFont, sideText, finalSideSize);

      drawVectorText(page, finalSideSvg.d, {
        x: W - 18,
        y: (H - finalSideSvg.width) / 2,
        color: sideColor,
        opacity: 0.55,
        angleDeg: 90
      });
    }

    const out = await pdfDoc.save();
    return Buffer.from(out);
  } catch (err) {
    console.error('Watermark failed:', err);
    return pdfBuffer;
  }
}

module.exports = { addWatermark };
