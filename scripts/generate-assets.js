import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import opentype from "opentype.js";

// Define paths
const __dirname = path.resolve();
const PUBLIC_DIR = path.join(__dirname, "public");

// Colors from Bestiary Design Spec
const colors = {
  paper: "#B4B4B4",
  panel: "#C3C3C3",
  panelSunken: "#ADADAD",
  void: "#0C0C0C",
  ink: "#141414",
  chalk: "#D8D8D8",
  edge: "#4B4B4B",
};

// Robust Font Loading Helper (since opentype.loadSync doesn't work correctly in Node.js ES Modules)
function loadFont(filePath) {
  console.log(`Loading font from: ${filePath}...`);
  const buf = fs.readFileSync(filePath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return opentype.parse(ab);
}

// Load all required fonts
const fontUnifraktur = loadFont(
  "node_modules/@typopro/web-unifraktur/TypoPRO-UnifrakturMaguntia-Regular.ttf",
);
const fontGaramondReg = loadFont(
  "node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff",
);
const fontGaramondItalic = loadFont(
  "node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff",
);
const fontMonoReg = loadFont(
  "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff",
);
const fontMonoBold = loadFont(
  "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff",
);

// Text to path helper using opentype.js
function getTextPath(font, text, x, y, fontSize, options = {}) {
  const { align = "left" } = options;
  let startX = x;
  if (align === "center") {
    const width = font.getAdvanceWidth(text, fontSize);
    startX = x - width / 2;
  } else if (align === "right") {
    const width = font.getAdvanceWidth(text, fontSize);
    startX = x - width;
  }
  const pathObj = font.getPath(text, startX, y, fontSize, options);
  return pathObj.toPathData(0);
}

// Text word wrap helper
function getWrappedLines(font, text, fontSize, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.getAdvanceWidth(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// Panel render helper (shadow + border + bevel inset)
function renderPanel(x, y, w, h, bgFill = colors.panel) {
  return `
  <!-- Panel Shadow (hard, 4px offset) -->
  <rect x="${x + 4}" y="${y + 4}" width="${w}" height="${h}" fill="${colors.ink}" />
  <!-- Panel Background and Edge Border (2px solid edge) -->
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bgFill}" stroke="${colors.edge}" stroke-width="2" />
  <!-- Inset Bevel: Top-Left Light (1px white) -->
  <path d="M ${x + 2} ${y + h - 2.5} V ${y + 2} H ${x + w - 2.5}" fill="none" stroke="#FFFFFF" stroke-width="1" />
  <!-- Inset Bevel: Bottom-Right Dark (1px black) -->
  <path d="M ${x + w - 2} ${y + 2.5} V ${y + h - 2} H ${x + 2.5}" fill="none" stroke="#000000" stroke-width="1" />
  `;
}

// Generate shared SVG elements
function getDefs() {
  return `
  <defs>
    <!-- Fine halftone dot screen pattern (circles on 3px grid) -->
    <pattern id="halftone" width="3" height="3" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="0.8" fill="#000000" />
    </pattern>
    <!-- Paper grain fractal noise filter (high frequency) -->
    <filter id="paper-grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="3" result="noise" />
      <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0
                                           0.33 0.33 0.33 0 0
                                           0.33 0.33 0.33 0 0
                                           0 0 0 0.28 0" />
    </filter>
  </defs>
  `;
}

function getOverlays(width, height) {
  return `
  <!-- Halftone dot screen: 40% black, multiply blend -->
  <rect width="${width}" height="${height}" fill="url(#halftone)" opacity="0.40" style="mix-blend-mode: multiply; pointer-events: none;" />
  <!-- Paper grain: overlay blend, 28% opacity -->
  <rect width="${width}" height="${height}" filter="url(#paper-grain)" style="mix-blend-mode: overlay; pointer-events: none;" />
  `;
}

// Build Banner SVG (1280x400)
function buildBanner() {
  const width = 1280;
  const height = 400;

  // Title: "Telegram Resolver" in UnifrakturMaguntia (Blackletter)
  const titlePath = getTextPath(
    fontUnifraktur,
    "Telegram Resolver",
    640,
    75,
    48,
    { align: "center" },
  );

  // Tagline: "RESOLVE GROUP AND TOPIC IDS FROM A BOT TOKEN." in JetBrains Mono (Mono)
  const taglineText = "RESOLVE GROUP AND TOPIC IDS FROM A BOT TOKEN.";
  const taglinePath = getTextPath(fontMonoReg, taglineText, 640, 365, 12, {
    align: "center",
  });

  // Left Panel setup (satisfying 48px canvas margin)
  const leftX = 64;
  const leftY = 110;
  const leftW = 540;
  const leftH = 220;

  // Right Panel setup (satisfying 48px canvas margin)
  const rightX = 676;
  const rightY = 110;
  const rightW = 540;
  const rightH = 220;

  // Left panel elements
  const labelPath = getTextPath(
    fontGaramondItalic,
    "The Bot Token:",
    leftX + 24,
    leftY + 36,
    17,
  );

  // Token box (inset void plate)
  const tokenBoxX = leftX + 24;
  const tokenBoxY = leftY + 48;
  const tokenBoxW = leftW - 48;
  const tokenBoxH = 40;
  const tokenBoxBg = renderPanel(
    tokenBoxX,
    tokenBoxY,
    tokenBoxW,
    tokenBoxH,
    colors.void,
  );

  const tokenText = "8123456789:AAH";
  const tokenTextPath = getTextPath(
    fontMonoBold,
    tokenText,
    tokenBoxX + 16,
    tokenBoxY + 25,
    15,
  );
  const bullets = "•••••••••";
  const tokenBulletsPath = getTextPath(
    fontMonoReg,
    bullets,
    tokenBoxX + 16 + fontMonoBold.getAdvanceWidth(tokenText, 15),
    tokenBoxY + 25,
    15,
  );

  // Prose in EB Garamond (Serif)
  const proseText =
    "The token is an opaque thing. Handed over, it yields the names and numbers of every room the bot has entered.";
  const proseLines = getWrappedLines(
    fontGaramondReg,
    proseText,
    18,
    leftW - 48,
  );
  let prosePaths = "";
  let currentY = leftY + 125;
  for (const line of proseLines) {
    prosePaths += `<path d="${getTextPath(fontGaramondReg, line, leftX + 24, currentY, 18)}" fill="${colors.ink}" />\n`;
    currentY += 26;
  }

  // Right panel elements (void plate data in Monospace)
  const monoSize = 16;
  const charWidth = fontMonoReg.getAdvanceWidth(" ", monoSize);
  const chatX = rightX + 24;
  const dataYStart = rightY + 55;
  const lineSpacing = 38;

  // Custom vector branch lines for perfect crispness on dark background
  const branchX = chatX + charWidth * 2.5;
  const y1_mid = dataYStart - monoSize * 0.3;
  const y2_mid = dataYStart + lineSpacing - monoSize * 0.3;
  const y3_mid = dataYStart + lineSpacing * 2 - monoSize * 0.3;
  const branchPathD = `M ${branchX} ${y1_mid + 8} V ${y3_mid} M ${branchX} ${y2_mid} H ${branchX + charWidth * 1.5} M ${branchX} ${y3_mid} H ${branchX + charWidth * 1.5}`;

  // Triangle indicator
  const triX = chatX + charWidth * 0.5;
  const triPathD = `M ${triX - 3.5} ${y1_mid - 4.5} L ${triX + 3.5} ${y1_mid} L ${triX - 3.5} ${y1_mid + 4.5} Z`;

  // Resolved list parts
  const l1_part1 = getTextPath(
    fontMonoBold,
    "Team Chat",
    chatX + charWidth * 2,
    dataYStart,
    monoSize,
  );
  const l1_part2 = getTextPath(
    fontMonoReg,
    "-1001234567890",
    chatX + charWidth * 28,
    dataYStart,
    monoSize,
  );

  const l2_part1 = getTextPath(
    fontMonoReg,
    "General",
    chatX + charWidth * 4,
    dataYStart + lineSpacing,
    monoSize,
  );
  const l2_part2 = getTextPath(
    fontMonoReg,
    "no thread id",
    chatX + charWidth * 28,
    dataYStart + lineSpacing,
    monoSize,
  );

  const l3_part1 = getTextPath(
    fontMonoReg,
    "Deploys",
    chatX + charWidth * 4,
    dataYStart + lineSpacing * 2,
    monoSize,
  );
  const l3_part2 = getTextPath(
    fontMonoReg,
    "thread 42",
    chatX + charWidth * 28,
    dataYStart + lineSpacing * 2,
    monoSize,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 400" width="1280" height="400">
  <title>Telegram Resolver - Bestiary Banner</title>
  <desc>Gothic bestiary-themed banner representing the Telegram Resolver tool.</desc>
  ${getDefs()}
  <!-- Main Paper Background -->
  <rect width="1280" height="400" fill="${colors.paper}" />

  <!-- Title & Horizontal Rule -->
  <path d="${titlePath}" fill="${colors.ink}" />
  <line x1="64" y1="90" x2="1216" y2="90" stroke="${colors.edge}" stroke-width="2" />

  <!-- Left Panel -->
  ${renderPanel(leftX, leftY, leftW, leftH, colors.panel)}
  <!-- Left Panel Content -->
  <path d="${labelPath}" fill="${colors.ink}" />
  ${tokenBoxBg}
  <path d="${tokenTextPath}" fill="${colors.chalk}" />
  <path d="${tokenBulletsPath}" fill="${colors.panelSunken}" />
  ${prosePaths}

  <!-- Right Panel (Void plate) -->
  ${renderPanel(rightX, rightY, rightW, rightH, colors.void)}
  <!-- Right Panel Content -->
  <path d="${triPathD}" fill="${colors.chalk}" />
  <path d="${branchPathD}" stroke="${colors.edge}" stroke-width="2" fill="none" />
  
  <path d="${l1_part1}" fill="${colors.chalk}" />
  <path d="${l1_part2}" fill="${colors.chalk}" />
  
  <path d="${l2_part1}" fill="${colors.chalk}" />
  <path d="${l2_part2}" fill="${colors.panelSunken}" />
  
  <path d="${l3_part1}" fill="${colors.chalk}" />
  <path d="${l3_part2}" fill="${colors.chalk}" />

  <!-- Tagline -->
  <path d="${taglinePath}" fill="${colors.ink}" />

  ${getOverlays(width, height)}
</svg>`;
}

// Build Social Preview SVG (1280x640)
// Centered 1120x480 safe area (bounds x: 80 to 1200, y: 80 to 560)
function buildSocialPreview() {
  const width = 1280;
  const height = 640;

  // Title: "Telegram Resolver" at top (inside safe area y=135)
  const titlePath = getTextPath(
    fontUnifraktur,
    "Telegram Resolver",
    640,
    135,
    52,
    { align: "center" },
  );

  // Tagline (inside safe area y=535)
  const taglineText = "RESOLVE GROUP AND TOPIC IDS FROM A BOT TOKEN.";
  const taglinePath = getTextPath(fontMonoReg, taglineText, 640, 535, 13, {
    align: "center",
  });

  // Panels layout inside safe area (y: 190 to 480)
  const leftX = 110;
  const leftY = 190;
  const leftW = 510;
  const leftH = 290;

  const rightX = 660;
  const rightY = 190;
  const rightW = 510;
  const rightH = 290;

  // Left panel elements
  const labelPath = getTextPath(
    fontGaramondItalic,
    "The Bot Token:",
    leftX + 24,
    leftY + 45,
    18,
  );

  // Token box
  const tokenBoxX = leftX + 24;
  const tokenBoxY = leftY + 60;
  const tokenBoxW = leftW - 48;
  const tokenBoxH = 45;
  const tokenBoxBg = renderPanel(
    tokenBoxX,
    tokenBoxY,
    tokenBoxW,
    tokenBoxH,
    colors.void,
  );

  const tokenText = "8123456789:AAH";
  const tokenTextPath = getTextPath(
    fontMonoBold,
    tokenText,
    tokenBoxX + 16,
    tokenBoxY + 28,
    16,
  );
  const bullets = "•••••••••";
  const tokenBulletsPath = getTextPath(
    fontMonoReg,
    bullets,
    tokenBoxX + 16 + fontMonoBold.getAdvanceWidth(tokenText, 16),
    tokenBoxY + 28,
    16,
  );

  // Prose
  const proseText =
    "The token is an opaque thing. Handed over, it yields the names and numbers of every room the bot has entered.";
  const proseLines = getWrappedLines(
    fontGaramondReg,
    proseText,
    20,
    leftW - 48,
  );
  let prosePaths = "";
  let currentY = leftY + 155;
  for (const line of proseLines) {
    prosePaths += `<path d="${getTextPath(fontGaramondReg, line, leftX + 24, currentY, 20)}" fill="${colors.ink}" />\n`;
    currentY += 28;
  }

  // Right panel elements
  const monoSize = 17;
  const charWidth = fontMonoReg.getAdvanceWidth(" ", monoSize);
  const chatX = rightX + 24;
  const dataYStart = rightY + 70;
  const lineSpacing = 42;

  // Branch lines
  const branchX = chatX + charWidth * 2.5;
  const y1_mid = dataYStart - monoSize * 0.3;
  const y2_mid = dataYStart + lineSpacing - monoSize * 0.3;
  const y3_mid = dataYStart + lineSpacing * 2 - monoSize * 0.3;
  const branchPathD = `M ${branchX} ${y1_mid + 8} V ${y3_mid} M ${branchX} ${y2_mid} H ${branchX + charWidth * 1.5} M ${branchX} ${y3_mid} H ${branchX + charWidth * 1.5}`;

  // Triangle
  const triX = chatX + charWidth * 0.5;
  const triPathD = `M ${triX - 3.5} ${y1_mid - 4.5} L ${triX + 3.5} ${y1_mid} L ${triX - 3.5} ${y1_mid + 4.5} Z`;

  const l1_part1 = getTextPath(
    fontMonoBold,
    "Team Chat",
    chatX + charWidth * 2,
    dataYStart,
    monoSize,
  );
  const l1_part2 = getTextPath(
    fontMonoReg,
    "-1001234567890",
    chatX + charWidth * 28,
    dataYStart,
    monoSize,
  );

  const l2_part1 = getTextPath(
    fontMonoReg,
    "General",
    chatX + charWidth * 4,
    dataYStart + lineSpacing,
    monoSize,
  );
  const l2_part2 = getTextPath(
    fontMonoReg,
    "no thread id",
    chatX + charWidth * 28,
    dataYStart + lineSpacing,
    monoSize,
  );

  const l3_part1 = getTextPath(
    fontMonoReg,
    "Deploys",
    chatX + charWidth * 4,
    dataYStart + lineSpacing * 2,
    monoSize,
  );
  const l3_part2 = getTextPath(
    fontMonoReg,
    "thread 42",
    chatX + charWidth * 28,
    dataYStart + lineSpacing * 2,
    monoSize,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640">
  <title>Telegram Resolver - Bestiary Social Preview</title>
  <desc>Gothic-themed social preview card for Telegram Resolver.</desc>
  ${getDefs()}
  <rect width="1280" height="640" fill="${colors.paper}" />

  <!-- Title & Horizontal Rule -->
  <path d="${titlePath}" fill="${colors.ink}" />
  <line x1="110" y1="155" x2="1170" y2="155" stroke="${colors.edge}" stroke-width="2" />

  <!-- Left Panel -->
  ${renderPanel(leftX, leftY, leftW, leftH, colors.panel)}
  <!-- Left Panel Content -->
  <path d="${labelPath}" fill="${colors.ink}" />
  ${tokenBoxBg}
  <path d="${tokenTextPath}" fill="${colors.chalk}" />
  <path d="${tokenBulletsPath}" fill="${colors.panelSunken}" />
  ${prosePaths}

  <!-- Right Panel -->
  ${renderPanel(rightX, rightY, rightW, rightH, colors.void)}
  <!-- Right Panel Content -->
  <path d="${triPathD}" fill="${colors.chalk}" />
  <path d="${branchPathD}" stroke="${colors.edge}" stroke-width="2" fill="none" />
  
  <path d="${l1_part1}" fill="${colors.chalk}" />
  <path d="${l1_part2}" fill="${colors.chalk}" />
  
  <path d="${l2_part1}" fill="${colors.chalk}" />
  <path d="${l2_part2}" fill="${colors.panelSunken}" />
  
  <path d="${l3_part1}" fill="${colors.chalk}" />
  <path d="${l3_part2}" fill="${colors.chalk}" />

  <!-- Tagline -->
  <path d="${taglinePath}" fill="${colors.ink}" />

  ${getOverlays(width, height)}
</svg>`;
}

// Build OG Image SVG (1200x630)
function buildOGImage() {
  const width = 1200;
  const height = 630;

  // Title: "Telegram Resolver"
  const titlePath = getTextPath(
    fontUnifraktur,
    "Telegram Resolver",
    600,
    130,
    52,
    { align: "center" },
  );

  // Tagline
  const taglineText = "RESOLVE GROUP AND TOPIC IDS FROM A BOT TOKEN.";
  const taglinePath = getTextPath(fontMonoReg, taglineText, 600, 525, 13, {
    align: "center",
  });

  // Panels layout (satisfying 48px canvas margin)
  const leftX = 80;
  const leftY = 185;
  const leftW = 490;
  const leftH = 285;

  const rightX = 630;
  const rightY = 185;
  const rightW = 490;
  const rightH = 285;

  // Left panel elements
  const labelPath = getTextPath(
    fontGaramondItalic,
    "The Bot Token:",
    leftX + 24,
    leftY + 45,
    18,
  );

  // Token box
  const tokenBoxX = leftX + 24;
  const tokenBoxY = leftY + 60;
  const tokenBoxW = leftW - 48;
  const tokenBoxH = 45;
  const tokenBoxBg = renderPanel(
    tokenBoxX,
    tokenBoxY,
    tokenBoxW,
    tokenBoxH,
    colors.void,
  );

  const tokenText = "8123456789:AAH";
  const tokenTextPath = getTextPath(
    fontMonoBold,
    tokenText,
    tokenBoxX + 16,
    tokenBoxY + 28,
    16,
  );
  const bullets = "•••••••••";
  const tokenBulletsPath = getTextPath(
    fontMonoReg,
    bullets,
    tokenBoxX + 16 + fontMonoBold.getAdvanceWidth(tokenText, 16),
    tokenBoxY + 28,
    16,
  );

  // Prose
  const proseText =
    "The token is an opaque thing. Handed over, it yields the names and numbers of every room the bot has entered.";
  const proseLines = getWrappedLines(
    fontGaramondReg,
    proseText,
    20,
    leftW - 48,
  );
  let prosePaths = "";
  let currentY = leftY + 155;
  for (const line of proseLines) {
    prosePaths += `<path d="${getTextPath(fontGaramondReg, line, leftX + 24, currentY, 20)}" fill="${colors.ink}" />\n`;
    currentY += 28;
  }

  // Right panel elements
  const monoSize = 17;
  const charWidth = fontMonoReg.getAdvanceWidth(" ", monoSize);
  const chatX = rightX + 24;
  const dataYStart = rightY + 68;
  const lineSpacing = 42;

  // Branch lines
  const branchX = chatX + charWidth * 2.5;
  const y1_mid = dataYStart - monoSize * 0.3;
  const y2_mid = dataYStart + lineSpacing - monoSize * 0.3;
  const y3_mid = dataYStart + lineSpacing * 2 - monoSize * 0.3;
  const branchPathD = `M ${branchX} ${y1_mid + 8} V ${y3_mid} M ${branchX} ${y2_mid} H ${branchX + charWidth * 1.5} M ${branchX} ${y3_mid} H ${branchX + charWidth * 1.5}`;

  // Triangle
  const triX = chatX + charWidth * 0.5;
  const triPathD = `M ${triX - 3.5} ${y1_mid - 4.5} L ${triX + 3.5} ${y1_mid} L ${triX - 3.5} ${y1_mid + 4.5} Z`;

  const l1_part1 = getTextPath(
    fontMonoBold,
    "Team Chat",
    chatX + charWidth * 2,
    dataYStart,
    monoSize,
  );
  const l1_part2 = getTextPath(
    fontMonoReg,
    "-1001234567890",
    chatX + charWidth * 28,
    dataYStart,
    monoSize,
  );

  const l2_part1 = getTextPath(
    fontMonoReg,
    "General",
    chatX + charWidth * 4,
    dataYStart + lineSpacing,
    monoSize,
  );
  const l2_part2 = getTextPath(
    fontMonoReg,
    "no thread id",
    chatX + charWidth * 28,
    dataYStart + lineSpacing,
    monoSize,
  );

  const l3_part1 = getTextPath(
    fontMonoReg,
    "Deploys",
    chatX + charWidth * 4,
    dataYStart + lineSpacing * 2,
    monoSize,
  );
  const l3_part2 = getTextPath(
    fontMonoReg,
    "thread 42",
    chatX + charWidth * 28,
    dataYStart + lineSpacing * 2,
    monoSize,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <title>Telegram Resolver - Bestiary OG Image</title>
  <desc>Gothic bestiary Open Graph image for Telegram Resolver.</desc>
  ${getDefs()}
  <rect width="1200" height="630" fill="${colors.paper}" />

  <!-- Title & Horizontal Rule -->
  <path d="${titlePath}" fill="${colors.ink}" />
  <line x1="80" y1="150" x2="1120" y2="150" stroke="${colors.edge}" stroke-width="2" />

  <!-- Left Panel -->
  ${renderPanel(leftX, leftY, leftW, leftH, colors.panel)}
  <!-- Left Panel Content -->
  <path d="${labelPath}" fill="${colors.ink}" />
  ${tokenBoxBg}
  <path d="${tokenTextPath}" fill="${colors.chalk}" />
  <path d="${tokenBulletsPath}" fill="${colors.panelSunken}" />
  ${prosePaths}

  <!-- Right Panel -->
  ${renderPanel(rightX, rightY, rightW, rightH, colors.void)}
  <!-- Right Panel Content -->
  <path d="${triPathD}" fill="${colors.chalk}" />
  <path d="${branchPathD}" stroke="${colors.edge}" stroke-width="2" fill="none" />
  
  <path d="${l1_part1}" fill="${colors.chalk}" />
  <path d="${l1_part2}" fill="${colors.chalk}" />
  
  <path d="${l2_part1}" fill="${colors.chalk}" />
  <path d="${l2_part2}" fill="${colors.panelSunken}" />
  
  <path d="${l3_part1}" fill="${colors.chalk}" />
  <path d="${l3_part2}" fill="${colors.chalk}" />

  <!-- Tagline -->
  <path d="${taglinePath}" fill="${colors.ink}" />

  ${getOverlays(width, height)}
</svg>`;
}

// Generate the files
console.log("Building SVGs...");
const bannerSvg = buildBanner();
const socialPreviewSvg = buildSocialPreview();
const ogImageSvg = buildOGImage();

fs.writeFileSync(path.join(PUBLIC_DIR, "banner.svg"), bannerSvg);
fs.writeFileSync(path.join(PUBLIC_DIR, "social-preview.svg"), socialPreviewSvg);
fs.writeFileSync(path.join(PUBLIC_DIR, "og-image.svg"), ogImageSvg);

console.log("Saved SVGs to public/.");

// Optimize SVGs in place using SVGO
console.log("Optimizing SVGs using SVGO...");
execSync(
  `npx svgo "${path.join(PUBLIC_DIR, "banner.svg")}" -o "${path.join(PUBLIC_DIR, "banner.svg")}"`,
);
execSync(
  `npx svgo "${path.join(PUBLIC_DIR, "social-preview.svg")}" -o "${path.join(PUBLIC_DIR, "social-preview.svg")}"`,
);
execSync(
  `npx svgo "${path.join(PUBLIC_DIR, "og-image.svg")}" -o "${path.join(PUBLIC_DIR, "og-image.svg")}"`,
);
console.log("SVGs optimized.");

// Helper to convert SVG to PNG using Headless Chrome
function convertSvgToPng(svgFileName, pngFileName, width, height) {
  const svgPath = path.join(PUBLIC_DIR, svgFileName);
  const pngPath = path.join(PUBLIC_DIR, pngFileName);
  const htmlPath = path.join(PUBLIC_DIR, `temp-${svgFileName}.html`);

  const svgContent = fs.readFileSync(svgPath, "utf8");

  // Wrap inside a clean margin-less HTML page
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: transparent;
    }
    svg {
      width: ${width}px;
      height: ${height}px;
      display: block;
    }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

  fs.writeFileSync(htmlPath, htmlContent);

  console.log(`Rendering ${pngFileName} at 2x (${width * 2}x${height * 2})...`);

  // Command to run headless chrome screenshot
  const cmd = `google-chrome --headless --disable-gpu --screenshot="${pngPath}" --window-size=${width},${height} --force-device-scale-factor=2 "file://${htmlPath}"`;

  execSync(cmd);

  // Cleanup temp file
  fs.unlinkSync(htmlPath);
}

// Convert all
try {
  convertSvgToPng("banner.svg", "banner.png", 1280, 400);
  convertSvgToPng("social-preview.svg", "social-preview.png", 1280, 640);
  convertSvgToPng("og-image.svg", "og-image.png", 1200, 630);
  console.log("Success! All PNGs exported at 2x.");
} catch (error) {
  console.error("Error rendering PNGs:", error.message);
  process.exit(1);
}
