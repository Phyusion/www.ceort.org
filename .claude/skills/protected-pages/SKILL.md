---
name: protected-pages
description: How the password-protected Member Portal and The Signal Report work on www.ceort.org (client-side AES-GCM encryption on GitHub Pages), and the exact workflows to update protected content, deploy a new Signal Report issue, replace the downloadable PDF, change the password, or add another protected page. Use whenever a task touches members-only.html, signal-report-*.html, files/*.enc, js/protected-page.js, or tools/protect-page.js, tools/build-report.py, tools/build-pdf.js.
---

# Protected pages on www.ceort.org

## Why it works this way

The site is static HTML served by GitHub Pages from the `Main` branch. Every
committed file is public, and GitHub Pages cannot check a password. So a
"protected" page ships only an **encrypted payload**; the visitor's browser
derives a key from the password and decrypts the content locally. Nothing
readable is ever committed. Anyone can download the ciphertext and try
passwords offline, so the password must be a long passphrase.

Cryptography: PBKDF2-SHA256, 600,000 iterations, 16-byte salt, then
AES-256-GCM with a 12-byte IV. Wrong password = GCM authentication failure.

## Pieces

| Path | Role |
| --- | --- |
| `members-only.html` | The Member Portal. Gate form + empty `<script type="application/json" id="protected-payload">` that holds the encrypted content. Linked from the nav as "Member Portal". |
| `signal-report-q3-2026.html` | One issue of The Signal Report. Same template as the portal, with a "Download PDF" button beside "Lock this page". |
| `js/protected-page.js` | Unlock logic (WebCrypto), per-tab memory of the key in `sessionStorage`, the lock button, execution of `<script>` tags inside decrypted content, and `data-protected-file` download buttons. |
| `files/*.pdf.enc` | Encrypted downloads. Binary layout: `CEORTENC` + version byte + 16-byte salt + 12-byte IV + ciphertext with tag. |
| `tools/protect-page.js` | Node, zero dependencies: `encrypt`, `decrypt`, `encrypt-file`. Password from `PAGE_PASSWORD` or an interactive prompt. |
| `tools/build-report.py` | Turns a standalone Signal Report HTML file into the fragment a protected page injects (scoped CSS, brand bar and masthead removed, download button added). |
| `tools/build-pdf.js` | Renders an unlocked report page to a PDF with Playwright, for when no PDF is supplied. |
| `tools/private/` | **Git-ignored.** Readable sources: `*.content.html`, the standalone report HTML, the unencrypted PDF. Never commit anything here. |
| `tools/README.md` | Operator-facing summary of the same workflows. |

Site styling for the gate, the portal cards, the lock bar and the report
tools row lives in `css/style.css` (tokens from `css/tokens.css`).

## One key for the portal, the report, and the PDF

All three are encrypted with the **same salt**, so the same password yields
the same key and one unlock in a browser tab opens everything:

- pages: `--key-from members-only.html` when encrypting the report page
- files: `encrypt-file ... --key-from signal-report-q3-2026.html`
- re-encrypting the portal itself: `--key-from members-only.html` (keeps its current salt)

The browser stores the raw key in `sessionStorage` under
`protected-page:<salt>`; a download button refuses a file whose salt does
not match the page. If you ever encrypt something without `--key-from`, it
gets a fresh salt and will not open from the portal's unlock. Check with:

    grep -o '"salt":"[^"]*"' members-only.html signal-report-q3-2026.html

## Workflows

Set the password once per shell: `export PAGE_PASSWORD='...'` (ask the user
for it; it is never stored in the repo).

### Edit the Member Portal text or issue list

    node tools/protect-page.js decrypt members-only.html tools/private/members-only.content.html   # if the source is missing
    # edit tools/private/members-only.content.html (an HTML fragment using site classes:
    #   .portal-intro, .portal-lead, .issue-list, .issue-card, .issue-meta, .issue-no, .issue-tags, .card-link, .portal-note)
    node tools/protect-page.js encrypt tools/private/members-only.content.html members-only.html --key-from members-only.html
    # --key-from the page itself keeps its salt, so the report pages and .enc files stay in step.
    # Without it the portal gets a NEW salt and every report page and every .enc must be re-encrypted.

### Deploy a new or revised Signal Report issue

1. Save the supplied standalone HTML to `tools/private/<issue>.source.html`.
2. Build the fragment (drops the brand bar and masthead, scopes the CSS under
   `.signal-report`, adds the download button when `--pdf` is given):

       python3 tools/build-report.py tools/private/<issue>.source.html tools/private/<issue>.content.html \
         --pdf files/<issue>.pdf.enc --filename The-Signal-Report-<Issue>.pdf

3. Encrypt into the page: `node tools/protect-page.js encrypt tools/private/<issue>.content.html <issue>.html --key-from members-only.html`
4. Update the hero text in `<issue>.html` and the issue card in the portal
   content if the tagline or focus changed; re-encrypt the portal.
5. Verify in a browser (see below), commit only `<issue>.html`,
   `members-only.html`, `files/*.enc`.

For a new issue, copy `signal-report-q3-2026.html` to the new file name,
keep the empty payload element and the two script tags, add the card to the
portal content, and encrypt with `--key-from members-only.html`.

### Replace or create the downloadable PDF

Supplied PDF: copy it to `tools/private/`, then

    node tools/protect-page.js encrypt-file tools/private/<issue>.pdf files/<issue>.pdf.enc --key-from <issue>.html

No PDF supplied: render one from the unlocked page first

    PAGE_PASSWORD='...' node tools/build-pdf.js <issue>.html tools/private/<issue>.pdf

`build-pdf.js` needs `playwright` with Chromium and the site's fonts
(Cinzel, Cormorant Garamond, Jost, IBM Plex Mono) installed locally, because
Google Fonts is not reachable from the sandbox. Static TTFs from
github.com/google/fonts dropped in `~/.fonts` + `fc-cache -f` work.

### Change the password

Re-encrypt in this order with the new `PAGE_PASSWORD`: the portal first,
then every report page with `--key-from members-only.html`, then every file
with `encrypt-file ... --key-from <its page>`. Everyone must receive the new
password; there is no per-person revocation.

### Add another protected page

Copy `signal-report-q3-2026.html`, keep `#protected-payload` empty and the
`js/main.js` + `js/protected-page.js` script tags, write its content
fragment in `tools/private/`, encrypt with `--key-from members-only.html`,
add `<meta name="robots" content="noindex, nofollow">`, keep it out of
`sitemap.xml`.

## Verification (headless Chromium via Playwright at /opt/node22/lib/node_modules/playwright)

Serve the repo (`python3 -m http.server`), then check: gate shows before
unlock and download buttons are hidden; wrong password shows the error and
reveals nothing; correct password reveals content; navigating from the
portal to the report needs no second unlock; every `svg.chart` has children;
no `<text>` inside a `.fig` extends past the card; no horizontal overflow at
390px; the download event yields a file byte-identical to
`tools/private/<issue>.pdf`; the committed `.enc` has no `%PDF` marker; and
`git ls-files | grep tools/private` prints nothing.

## Gotchas learned the hard way

- `innerHTML` does not run scripts: `protected-page.js` re-creates each
  `<script>` after the content is visible so charts can measure widths.
  Keep that order.
- The report's CSS must be scoped. The build tool prefixes every selector
  with `.signal-report`; `body` rules become `.signal-report`, `html` rules
  are dropped, `:root` token blocks are kept (they only define variables).
- Chart code reads CSS variables (`--teal`, `--gold`, `--navy`, `--paper`,
  `--rule`...) from `document.documentElement`, so those must be defined at
  `:root`, which the report's own stylesheet does.
- The site header is fixed (78px, `--header-h`); the build tool's overrides
  push the sticky section rail and `scroll-margin-top` below it.
- The site was redesigned onto `css/tokens.css` (Cormorant Garamond, Cinzel,
  Jost, IBM Plex Mono; navy and gold). Old `--font-body`/`--color-*`
  variables no longer exist; anything relying on them silently falls back.
- Do not put the plaintext PDF or sources anywhere outside `tools/private/`.
  `git status --short --ignored | grep private` should show `!!`.
- The default branch is `Main` (capital M). `main` and `master` are stale.
- Google Fonts and other external hosts are blocked in the cloud sandbox;
  the site itself loads them fine in production.
