#!/usr/bin/env node
/*
 * build-pdf.js — render a protected report page to a PDF replica.
 *
 * Usage:
 *   PAGE_PASSWORD='...' node tools/build-pdf.js <page.html> <out.pdf>
 *
 * Serves the site from a local port, unlocks the page in headless Chromium
 * (Playwright), applies a print layout with a cover page, and prints to PDF.
 * The output must then be encrypted before it is committed:
 *   node tools/protect-page.js encrypt-file <out.pdf> files/<name>.pdf.enc --key-from <page.html>
 *
 * Requires Node 18+ and the playwright package with Chromium
 * (npm i -D playwright && npx playwright install chromium).
 * Set CHROMIUM_PATH to use a specific Chromium binary.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

function loadPlaywright() {
  const candidates = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* try next */ }
  }
  console.error('playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const [pageFile, outFile] = process.argv.slice(2);
if (!pageFile || !outFile) {
  console.error("Usage: PAGE_PASSWORD='...' node tools/build-pdf.js <page.html> <out.pdf>");
  process.exit(1);
}
if (!process.env.PAGE_PASSWORD) {
  console.error('Set PAGE_PASSWORD to the page password.');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.enc': 'application/octet-stream' };

function serve() {
  return new Promise(function(resolve) {
    const server = http.createServer(function(req, res) {
      const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, '127.0.0.1', function() { resolve(server); });
  });
}

const PDF_CSS = `
  .site-header, .site-footer, .page-hero, .lock-bar, #protectedGate, .report-tools, .tip,
  .signal-report nav.rail, .signal-report .issueline { display: none !important; }
  html { scroll-behavior: auto !important; }
  body { background: #fff !important; }
  #protectedContent { background: #fff !important; }
  .signal-report { font-size: 14.5px; }
  .signal-report .shell { display: block !important; max-width: none !important; padding: 0 !important; margin: 0 !important; }
  .signal-report main { padding: 0 !important; }
  .signal-report section { margin: 0 0 44px !important; }
  .signal-report section#china, .signal-report section#watchlist, .signal-report section#method { break-before: page; }
  .signal-report .sec-no, .signal-report h2, .signal-report h3, .signal-report .sub, .signal-report .fig-head, .signal-report .controls { break-after: avoid; }
  .signal-report .fig, .signal-report .stat, .signal-report .rt, .signal-report .callout,
  .signal-report .ent, .signal-report .deal, .signal-report .tl-item, .signal-report .srcs > div, .signal-report .prog > div,
  .signal-report .rt-row, .signal-report .funnel, .signal-report ol.refs li, .signal-report .stats { break-inside: avoid; }
  .signal-report .sig, .signal-report .fine, .signal-report .legend, .signal-report .controls { break-before: avoid; break-inside: avoid; }
  .signal-report .sec-no, .signal-report h2, .signal-report h3, .signal-report .sub { break-inside: avoid; }
  .signal-report #method > p.fine:last-child { display: none; }
  .signal-report .ceonote p { break-inside: avoid; }
  /* Grids with a rule-coloured background leave a blank block when split across pages: render them as separated lists. */
  .signal-report .ledger, .signal-report .deals, .signal-report .prog { background: transparent !important; border: none !important; gap: 0 !important; border-radius: 0 !important; }
  .signal-report .ent, .signal-report .deal, .signal-report .prog > div { border-bottom: 1px solid #ece8e1; padding-left: 4px !important; padding-right: 4px !important; }
  .signal-report .ent:first-child, .signal-report .deal:first-child, .signal-report .prog > div:first-child { border-top: 1px solid #ece8e1; }
  /* Timelines are long: let them flow across pages without a card around them. */
  .signal-report .fig:has(.tl) { break-inside: auto; border: none !important; padding: 0 !important; background: transparent !important; }
  .signal-report .fig, .signal-report .rt, .signal-report .callout, .signal-report .ceonote, .signal-report .stats,
  .signal-report .ledger, .signal-report .deals, .signal-report .prog, .signal-report .srcs > div, .signal-report .stat { box-shadow: none !important; }
  .signal-report .ceonote p { font-size: 1rem; }
  .signal-report .ceonote p:first-of-type { font-size: 1.08rem; }
  .signal-report .rt-row { align-items: stretch !important; }
  .signal-report button.chip { border-color: #d6d3cd; }
  a[href] { text-decoration: none; }

  .pdf-cover { break-after: page; height: 9.1in; box-sizing: border-box; display: flex; flex-direction: column;
    justify-content: flex-end; padding: 0 0 0.6in; border-bottom: 3px solid #c9a84c; font-family: Inter, system-ui, sans-serif; color: #1c1917; }
  .pdf-cover .brand { display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #78716c; margin-bottom: auto; padding-top: 0.2in; }
  .pdf-cover .brand img { height: 44px; width: auto; }
  .pdf-cover .over { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #b08a34; margin-bottom: 14px; }
  .pdf-cover h1 { font-size: 64px; line-height: 1; letter-spacing: -.03em; margin: 0 0 18px; font-weight: 800; color: #1c1917; }
  .pdf-cover .issue { font-size: 22px; font-weight: 600; margin: 0 0 22px; color: #292524; }
  .pdf-cover .tag { font-size: 16px; line-height: 1.5; color: #57534e; max-width: 34em; margin: 0 0 28px; }
  .pdf-cover .focus { display: inline-block; border: 1px solid #b08a34; color: #b08a34; border-radius: 50px; padding: 5px 14px; font-size: 12px; font-weight: 600; margin-bottom: 40px; }
  .pdf-cover .meta { font-size: 11px; color: #78716c; line-height: 1.7; }
  .pdf-cover .meta b { color: #1c1917; font-weight: 600; }
`;

const COVER_HTML = `
<div class="pdf-cover">
  <div class="brand"><img src="images/logo.png" alt=""><span>Members and partners only</span></div>
  <div class="over">The Signal Report &middot; Issue 01</div>
  <h1>The Signal<br>Report</h1>
  <p class="issue">Third quarter 2026</p>
  <p class="tag">A quarterly reading of the state of oncology: what moved, what it cost, and what it means. Prepared for the members and partners of the CEO Roundtable on Cancer and Project Data Sphere.</p>
  <span class="focus">This issue's extended focus: China</span>
  <p class="meta"><b>Published 18 September 2026</b><br>CEO Roundtable on Cancer and Project Data Sphere &middot; 1204 Village Market Place, Suite 288, Morrisville, NC 27560 &middot; info@ceort.org<br>Not for redistribution outside member and partner organizations.</p>
</div>`;

(async function main() {
  const { chromium } = loadPlaywright();
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const launch = { headless: true };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  else if (fs.existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(launch);
  try {
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, reducedMotion: 'reduce' });
    page.on('pageerror', function(e) { console.error('page error:', e.message); });
    await page.goto(base + pageFile, { waitUntil: 'load' });
    await page.fill('#unlockPassword', process.env.PAGE_PASSWORD);
    await page.click('#unlockButton');
    try {
      await page.waitForSelector('#protectedContent:not([hidden])', { timeout: 30000 });
    } catch (e) {
      console.error('The page did not unlock. Is PAGE_PASSWORD correct?');
      process.exit(1);
    }
    await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
    await page.addStyleTag({ content: PDF_CSS });
    await page.evaluate(function(cover) {
      var shell = document.querySelector('.signal-report .shell');
      shell.insertAdjacentHTML('beforebegin', cover);
      // A legend that follows a long timeline can end up alone on a page: show it above the timeline instead.
      document.querySelectorAll('.signal-report .fig').forEach(function(fig) {
        var next = fig.nextElementSibling;
        if (fig.querySelector('.tl') && next && next.classList.contains('legend')) {
          next.style.marginTop = '0';
          next.style.marginBottom = '14px';
          fig.parentNode.insertBefore(next, fig);
        }
      });
      // Redraw charts at the print width.
      window.dispatchEvent(new Event('resize'));
    }, COVER_HTML);
    await page.waitForTimeout(1200);
    await page.evaluate(function() { return document.fonts ? document.fonts.ready : null; });
    const footer = '<div style="font-family:Inter,system-ui,sans-serif;font-size:7.5px;color:#78716c;width:100%;padding:0 0.6in;display:flex;justify-content:space-between;">' +
      '<span>The Signal Report &middot; Issue 01 &middot; Third quarter 2026 &middot; CEO Roundtable on Cancer and Project Data Sphere</span>' +
      '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>';
    await page.pdf({
      path: outFile,
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer,
      margin: { top: '0.55in', right: '0.6in', bottom: '0.65in', left: '0.6in' }
    });
    const size = fs.statSync(outFile).size;
    console.log('Wrote ' + outFile + ' (' + Math.round(size / 1024) + ' KB). Encrypt it before committing:');
    console.log('  node tools/protect-page.js encrypt-file ' + outFile + ' files/' + path.basename(outFile) + '.enc --key-from ' + pageFile);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(function(err) { console.error(err); process.exit(1); });
