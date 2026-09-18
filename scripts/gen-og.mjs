import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

const HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:1200px;height:630px;overflow:hidden}</style>
</head><body>
<canvas id="c" width="1200" height="630" style="position:absolute;inset:0"></canvas>
<div style="position:absolute;inset:0;display:flex">
  <div style="width:900px;padding:64px 60px;display:flex;flex-direction:column;justify-content:space-between;position:relative;z-index:2">
    <div style="display:flex;align-items:center;gap:9px">
      <svg width="22" height="22" viewBox="0 0 22 22"><path d="M11 1L13.2 8.8 21 11 13.2 13.2 11 21 8.8 13.2 1 11 8.8 8.8Z" fill="#F97316"/></svg>
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:20px;font-weight:600;color:#fff;letter-spacing:-0.01em">Constella</span>
    </div>
    <div>
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:82px;font-weight:800;line-height:1.06;color:#fff;letter-spacing:-0.038em;margin-bottom:24px">Turn structured data into an interactive hierarchy graph.</h1>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:21px;color:#aaaaaa;line-height:1.55">A spreadsheet, Markdown outline, or JSON manifest becomes a polished, embeddable graph.</p>
    </div>
    <div style="display:flex;align-items:center;gap:9px">
      <div style="width:8px;height:8px;border-radius:50%;background:#F97316;flex-shrink:0"></div>
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;color:#F97316">constella.anirudhux.com</span>
    </div>
  </div>
</div>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#090909';
ctx.fillRect(0, 0, 1200, 630);

// Subtle warm glow behind graph
const bgGlow = ctx.createRadialGradient(900, 310, 0, 900, 310, 360);
bgGlow.addColorStop(0, 'rgba(40,22,8,0.9)');
bgGlow.addColorStop(1, 'rgba(9,9,9,0)');
ctx.fillStyle = bgGlow;
ctx.fillRect(0, 0, 1200, 630);

const cx = 875, cy = 312;

// [x, y, radius, color]
const nodes = [
  [cx,      cy,      19, '#FFFFFF'],
  [cx+158,  cy-88,   13, '#60A5FA'],
  [cx+200,  cy+18,   11, '#2DD4BF'],
  [cx+138,  cy+132,  12, '#86EFAC'],
  [cx+52,   cy-162,  11, '#C084FC'],
  [cx-78,   cy-138,  10, '#F472B6'],
  [cx-132,  cy+48,    9, '#A3E635'],
  [cx+38,   cy+188,   9, '#FB923C'],
  [cx+268,  cy-128,   7, '#93C5FD'],
  [cx+298,  cy+65,    7, '#5EEAD4'],
  [cx+222,  cy+208,   6, '#6EE7B7'],
  [cx+88,   cy-238,   7, '#D8B4FE'],
  [cx-28,   cy-228,   6, '#FBCFE8'],
  [cx-192,  cy-78,    6, '#BEF264'],
  [cx-162,  cy+162,   7, '#FCD34D'],
  [cx+338,  cy-28,    5, '#BFDBFE'],
  [cx+162,  cy+288,   5, '#FCA5A5'],
  [cx-98,   cy+248,   5, '#FDE68A'],
  [cx+62,   cy-298,   5, '#C084FC'],
  [cx-232,  cy+18,    5, '#BBF7D0'],
  [cx+358,  cy+140,   4, '#7DD3FC'],
  [cx-58,   cy+298,   4, '#FED7AA'],
  [cx+118,  cy-308,   4, '#E9D5FF'],
];

const edges = [
  [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],
  [1,8],[2,9],[3,10],[4,11],[5,12],[6,13],[6,14],[2,15],[3,20],[7,16],[7,21],[4,18],[6,19],[11,22],
];

// Draw edges
edges.forEach(([a, b]) => {
  const [x1,y1,,c1] = nodes[a];
  const [x2,y2,,c2] = nodes[b];
  const g = ctx.createLinearGradient(x1,y1,x2,y2);
  g.addColorStop(0, c1 + (a===0?'70':'55'));
  g.addColorStop(1, c2 + '28');
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.strokeStyle = g;
  ctx.lineWidth = a===0 ? 1.5 : 0.8;
  ctx.stroke();
});

// Draw nodes
nodes.forEach(([x,y,r,color], i) => {
  const glowR = r * (i===0 ? 5 : 3.5);
  const glow = ctx.createRadialGradient(x,y,0,x,y,glowR);
  glow.addColorStop(0, (i===0 ? '#F97316' : color) + (i===0 ? '55' : '35'));
  glow.addColorStop(1, color+'00');
  ctx.beginPath();
  ctx.arc(x,y,glowR,0,Math.PI*2);
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle = color;
  ctx.fill();
});
<\/script>
</body></html>`;

const browser = await chromium.launch();
const context = await browser.newContext({ deviceScaleFactor: 2 });
const page = await context.newPage();
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(HTML, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
const out = join(__dir, '../public/og.png');
await page.screenshot({ path: out });
await browser.close();
console.log('og.png written to', out);
