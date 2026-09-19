# Password-protected pages

`members-only.html` (the Member Portal) and `signal-report-q3-2026.html` (The
Signal Report, Issue 01) are password-protected pages. GitHub Pages cannot check a
password on the server, so the page's content is **encrypted** instead
(AES-256-GCM, key derived from the password with PBKDF2-SHA256). Only the
encrypted blob is committed; the browser decrypts it after the visitor enters
the password. Without the password the content cannot be read, even from the
page source or this repository.

The readable source lives in `tools/private/`, which is git-ignored. **Never
commit anything in that folder**: every committed file is published.

## Update the page content

1. Recover the current content (prompts for the password):

       node tools/protect-page.js decrypt members-only.html tools/private/members-only.content.html

2. Edit `tools/private/members-only.content.html`. It is an HTML fragment that
   is dropped into the page body between the hero and the footer, so use the
   site's existing classes (`section`, `container`, `card`, and so on).

3. Re-encrypt it into the page (prompts for the password twice):

       node tools/protect-page.js encrypt tools/private/members-only.content.html members-only.html

4. Commit and push `members-only.html`.

To change the password, run step 3 with the new password. Everyone who had the
old password will need the new one.

You can also pass the password through the `PAGE_PASSWORD` environment
variable instead of typing it, which is handy for scripted updates:

    PAGE_PASSWORD='...' node tools/protect-page.js encrypt tools/private/members-only.content.html members-only.html

## The Signal Report

The report's source is `tools/private/signal-report-q3-2026.content.html`: its
scoped stylesheet, the article markup, and the chart script, all in one
fragment. Re-encrypt it with the portal's key so one password unlocks both
pages in the same browser tab:

    node tools/protect-page.js encrypt tools/private/signal-report-q3-2026.content.html signal-report-q3-2026.html --key-from members-only.html

If you change the portal password, re-encrypt the portal first and then every
page that shares its key, in that order.

## The PDF download

The report page offers a "Download PDF" button. The PDF is generated from the
unlocked page and then encrypted with the page's key, so the committed file
(`files/signal-report-q3-2026.pdf.enc`) is unreadable without the password.
The browser decrypts it after unlock and hands it over as a normal download.

Rebuild it whenever the report content or password changes:

    PAGE_PASSWORD='...' node tools/build-pdf.js signal-report-q3-2026.html tools/private/signal-report-q3-2026.pdf
    PAGE_PASSWORD='...' node tools/protect-page.js encrypt-file tools/private/signal-report-q3-2026.pdf files/signal-report-q3-2026.pdf.enc --key-from signal-report-q3-2026.html

`build-pdf.js` needs the `playwright` package with Chromium
(`npm i -D playwright && npx playwright install chromium`) and the Inter
font installed locally so the PDF matches the site typography. Never commit
the unencrypted PDF: keep it in `tools/private/`.

## Adding another protected page

Copy `signal-report-q3-2026.html` to a new file, keep the empty
`<script type="application/json" id="protected-payload"></script>` element and
the two script tags at the bottom, write the page's content to a new file in
`tools/private/`, and run the `encrypt` command against the new pair with
`--key-from members-only.html`. Add the new issue to the list in
`tools/private/members-only.content.html` and re-encrypt the portal too.

## Limits to keep in mind

- The password is shared, not per person, and there is no way to revoke a
  single person's access short of changing it for everyone.
- Anyone can download the encrypted blob and try passwords offline. The key
  derivation is deliberately slow (600,000 PBKDF2 rounds), but a short or
  guessable password is still weak. Use a long passphrase.
- Once unlocked, the content is ordinary HTML in the visitor's browser. Files
  linked from the page (PDFs, images) are **not** protected unless they are
  hosted somewhere that requires its own login. Do not put sensitive documents
  in this repository.
