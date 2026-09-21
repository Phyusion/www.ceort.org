#!/usr/bin/env python3
"""
build-report.py — turn a standalone Signal Report HTML file into the fragment
that the protected report page decrypts and injects.

Usage:
    python3 tools/build-report.py <standalone-report.html> <content.html> [--pdf files/x.pdf.enc] [--filename Name.pdf]

What it does
  * takes the report's own <style> and scopes every rule under `.signal-report`
    so it cannot restyle the site header, hero or footer (`body` becomes
    `.signal-report`, `html` is dropped, `:root` token blocks are kept)
  * drops the report's brand bar and masthead (the site header and page hero
    take their place) and moves the issue line and focus badge to the top of
    the article, alongside the "Download PDF" button
  * keeps the article body and the chart script verbatim
  * appends a few layout overrides so the sticky section rail clears the fixed
    site header

The output goes in tools/private/ (git-ignored) and is then encrypted:
    node tools/protect-page.js encrypt <content.html> signal-report-q3-2026.html --key-from members-only.html
"""

import re
import sys

SCOPE = '.signal-report'
DROP = ('.brandbar', '.lockup', '.masthead', 'h1.title', '.tagline', '.brand-logo')

DOWNLOAD_ICON = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" '
                 'stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'
                 '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>')

OVERRIDES = """
/* Layout inside the site: clear the fixed header, use the site gutters. */
.signal-report .shell{max-width:var(--container-max,1200px);padding:0 var(--gutter-lg,40px) var(--section-y,96px)}
.signal-report nav.rail{top:calc(var(--header-h,78px) + 16px);height:auto;max-height:calc(100vh - var(--header-h,78px) - 32px);padding-top:0}
.signal-report main{padding-top:0}
.signal-report section,.signal-report ol.refs li{scroll-margin-top:calc(var(--header-h,78px) + 24px)}
.signal-report .issueline{margin-top:0}
.signal-report .report-tools .focusband{margin:0}
@media (max-width:880px){
  .signal-report .shell{padding:0 var(--gutter,24px) 64px}
  .signal-report nav.rail{top:var(--header-h,78px);max-height:none;margin:0 calc(-1 * var(--gutter,24px));padding-left:var(--gutter,24px);padding-right:var(--gutter,24px)}
  .signal-report section{scroll-margin-top:calc(var(--header-h,78px) + 64px)}
}
"""


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def parse(css):
    """Return a list of ('rule', selector, body) / ('at', prelude, children) / ('atflat', prelude, body)."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j == -1:
            break
        prelude = css[i:j].strip().lstrip(';').strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        if prelude.startswith('@'):
            if prelude.startswith(('@media', '@supports', '@container')):
                out.append(('at', prelude, parse(body)))
            else:
                out.append(('atflat', prelude, body))
        else:
            out.append(('rule', prelude, body))
        i = k
    return out


def scope_selector(sel):
    s = ' '.join(sel.split())
    if not s:
        return None
    if any(d in s for d in DROP):
        return None
    if s.startswith(':root'):
        return s
    if s == 'html':
        return None
    if s == 'body':
        return SCOPE
    if s.startswith('body'):
        return SCOPE + s[4:]
    if s == '*':
        return SCOPE + ' *'
    if s.startswith('::') or s.startswith(':'):
        return SCOPE + ' ' + s
    return SCOPE + ' ' + s


def emit(nodes):
    parts = []
    for kind, prelude, body in nodes:
        if kind == 'rule':
            sels = [scope_selector(x) for x in prelude.split(',')]
            sels = [x for x in sels if x]
            if not sels:
                continue
            parts.append(','.join(sels) + '{' + ' '.join(body.split()) + '}')
        elif kind == 'at':
            inner = emit(body)
            if inner:
                parts.append(prelude + '{' + inner + '}')
        else:
            parts.append(prelude + '{' + ' '.join(body.split()) + '}')
    return '\n'.join(parts)


def main():
    args = sys.argv[1:]
    pdf, filename = None, 'The-Signal-Report.pdf'
    if '--pdf' in args:
        i = args.index('--pdf'); pdf = args[i + 1]; del args[i:i + 2]
    if '--filename' in args:
        i = args.index('--filename'); filename = args[i + 1]; del args[i:i + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    src, dst = args
    html = open(src, encoding='utf-8').read()

    css = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
    body = re.search(r'<body[^>]*>(.*)</body>', html, re.S).group(1)
    script = re.search(r'<script>(.*?)</script>\s*$', body.strip(), re.S)
    js = script.group(1) if script else ''
    body = body[:script.start()] if script else body

    masthead = re.search(r'<header class="masthead">(.*?)</header>', body, re.S)
    issue = re.search(r'<div class="issueline">.*?</div>', masthead.group(1), re.S).group(0) if masthead else ''
    focus = re.search(r'<span class="focusband">.*?</span>', masthead.group(1), re.S)
    focus = focus.group(0) if focus else ''
    shell = re.search(r'<div class="shell">.*</main>\s*</div>', body, re.S).group(0)

    tools = ''
    if pdf:
        tools = ('<div class="report-tools">' + focus +
                 '<button type="button" class="btn btn-primary btn-sm" data-protected-file="' + pdf +
                 '" data-filename="' + filename + '">' + DOWNLOAD_ICON + 'Download PDF</button></div>')
    elif focus:
        tools = '<div class="report-tools">' + focus + '</div>'
    shell = shell.replace('<main>', '<main>\n' + issue + '\n' + tools + '\n', 1)

    scoped = emit(parse(strip_comments(css))) + '\n' + OVERRIDES
    out = ('<!--\n  Built by tools/build-report.py from ' + src.split('/')[-1] + '. Git-ignored; never commit.\n-->\n'
           '<style>\n' + scoped + '</style>\n'
           '<div class="signal-report">\n' + shell + '\n</div>\n'
           '<script>\n' + js.strip() + '\n</script>\n')
    open(dst, 'w', encoding='utf-8').write(out)
    print('wrote', dst, len(out), 'chars; css rules', scoped.count('{'), '; issue line:', bool(issue), '; focus:', bool(focus), '; script:', len(js))


if __name__ == '__main__':
    main()
