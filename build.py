#!/usr/bin/env python3
"""
Static site generator for mmendelson.com

No external dependencies. Reads page bodies from content/, wraps them in
templates/base.html, and writes a complete static site into public/.

Usage:  python3 build.py
"""
import os
import re
import shutil
import datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(ROOT, "content")
TEMPLATES = os.path.join(ROOT, "templates")
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "public")

# --------------------------------------------------------------------------
# Hosting configuration.
#   CUSTOM_DOMAIN — set to e.g. "mmendelson.com" once the domain's DNS points
#                   at GitHub Pages.  While empty, the site is built for the
#                   GitHub Pages project URL (mendelson.github.io/website),
#                   so all in-site links are prefixed with BASE.
# --------------------------------------------------------------------------
CUSTOM_DOMAIN = ""

if CUSTOM_DOMAIN:
    BASE = ""
    SITE_URL = "https://" + CUSTOM_DOMAIN
else:
    BASE = "/website"
    SITE_URL = "https://mendelson.github.io/website"

YEAR = datetime.date.today().year

# --------------------------------------------------------------------------
# Page registry.  `url` is the public path (kept identical to the old
# WordPress slugs so existing inbound links keep working).
# --------------------------------------------------------------------------
PAGES = [
    # slug-file        url                          title                              h1                                   description
    ("home",           "/",                         "Mateus Mendelson",                "",                                  "Personal website of Mateus Mendelson — Data Scientist, lecturer and developer."),
    ("teaching",       "/teaching/",                "Teaching — Mateus Mendelson",     "Teaching",                          "Information about the classes taught by Mateus Mendelson."),
    ("fga",            "/teaching/fga/",            "UnB Gama — Mateus Mendelson",     "University of Brasília - Gama",      "Courses taught at the University of Brasília - Gama (UnB/FGA)."),
    ("iesb",           "/teaching/university-center-iesb/", "IESB — Mateus Mendelson", "University Center IESB",            "Courses taught at the University Center IESB."),
    ("projecao",       "/teaching/projecao/",       "Projeção — Mateus Mendelson",     "University Center Projeção",        "Courses taught at the University Center Projeção."),
    ("publications",   "/publications/",            "Publications — Mateus Mendelson", "Publications",                      "Academic publications, theses and conference papers by Mateus Mendelson."),
    ("extra-resources","/extra-resources/",         "Extra resources — Mateus Mendelson","Extra resources",                "Slide presentations, class notes and other learning resources."),
    ("off",            "/off/",                     "Side projects — Mateus Mendelson","Side projects",                    "Personal interests and side projects."),
    ("music-sheets",   "/off/music-sheets/",        "Music Sheets — Mateus Mendelson", "Music Sheets",                     "Music sheets transcribed by Mateus Mendelson."),
    ("cv",             "/cv/",                      "CV — Mateus Mendelson",           "CV",                               "Curriculum Vitae of Mateus Mendelson."),
    ("a-coxinha",      "/off/a-coxinha/",           "A Coxinha — Mateus Mendelson",    "A Coxinha",                        "An example page built during an HTML 101 class."),
    ("tracker",        "/tracker/",                 "Garmin Tracker — Mateus Mendelson","Garmin Tracker Data Field",        "Live tracking companion for the Garmin Tracker Data Field."),
]

# --------------------------------------------------------------------------
# Navigation tree (label, url, [children])
# --------------------------------------------------------------------------
NAV = [
    ("Home", "/", []),
    ("Teaching", "/teaching/", [
        ("University of Brasília – Gama", "/teaching/fga/"),
        ("IESB", "/teaching/university-center-iesb/"),
        ("Projeção", "/teaching/projecao/"),
    ]),
    ("Publications", "/publications/", []),
    ("Extra resources", "/extra-resources/", []),
    ("Side projects", "/off/", [
        ("Garmin Apps", "/garmin-apps/"),
        ("Races in the World", "/off/run/"),
        ("Running Gallery", "/off/running-gallery/"),
        ("Byte Papo", "/off/byte-papo/"),
        ("Music Sheets", "/off/music-sheets/"),
    ]),
]

# --------------------------------------------------------------------------
# Footer social links (inline SVG so there are no external icon assets)
# --------------------------------------------------------------------------
SOCIAL = [
    ("LinkedIn", "https://www.linkedin.com/in/mateusmendelson/",
     '<path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/>'),
    ("GitHub", "https://github.com/mendelson",
     '<path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"/>'),
    ("YouTube", "https://www.youtube.com/mateusmendelson",
     '<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>'),
    ("Strava", "https://www.strava.com/athletes/9485255",
     '<path d="M15.39 0L8.6 13.34h4.02L15.39 7.9l2.77 5.44h4.02L15.39 0zm2.77 13.34l-1.97 3.86-1.97-3.86h-2.98L16.19 24l4.95-10.66h-2.98z"/>'),
    ("Instagram", "https://instagram.com/byte.papo",
     '<path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.12 1.38C1.36 2.67.95 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.8.72 1.47 1.38 2.13.66.66 1.33 1.07 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.8-.31 1.47-.72 2.13-1.38.66-.66 1.07-1.33 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.86 5.86 0 0 0-1.38-2.12A5.86 5.86 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm6.41-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z"/>'),
    ("Byte Papo podcast", "https://open.spotify.com/show/1zGax7Ftyup8WKN7BQGJ1g?si=MOsvj8wwRDOX4qpzHaSgog",
     '<path d="M12 1a9 9 0 0 0-9 9v7a3 3 0 0 0 3 3h1a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H5v-2a7 7 0 0 1 14 0v2h-2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2a3 3 0 0 0 3-3v-7a9 9 0 0 0-9-9z"/>'),
    ("Telegram", "https://t.me/mmendelson",
     '<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>'),
    ("Email", "mailto:mendelson.mateus@gmail.com",
     '<path d="M0 4a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2.4.5 9.6 6.4 9.6-6.4H2.4zM22 6.6l-9.43 6.29a1 1 0 0 1-1.14 0L2 6.6V20h20V6.6z"/>'),
]

# Slugs that redirect instead of rendering a page.  Values may be an internal
# path (kept on this site) or an absolute URL (off-site).  These mirror the
# behaviour of the original WordPress site: a few menu items keep their own
# URL but bounce to an external destination.
REDIRECTS = {
    # Menu items / pages that bounce off-site on the original.
    "/garmin-apps/": "http://apps.mmendelson.com/",
    "/off/run/": "http://run.mmendelson.com/",
    "/off/running-gallery/": "http://run.mmendelson.com/gallery",
    "/off/byte-papo/": "https://open.spotify.com/show/1zGax7Ftyup8WKN7BQGJ1g?si=MOsvj8wwRDOX4qpzHaSgog",
    "/contact/": "https://taggo.one/mmendelson",
    # Legacy flat slugs -> nested canonical paths (the original 301s these).
    "/fga/": "/teaching/fga/",
    "/university-center-iesb/": "/teaching/university-center-iesb/",
    "/projecao/": "/teaching/projecao/",
    "/music-sheets/": "/off/music-sheets/",
    "/a-coxinha/": "/off/a-coxinha/",
    "/run/": "/off/run/",
    "/byte-papo/": "/off/byte-papo/",
    # Other old slugs.
    "/findme/": "https://taggo.one/mmendelson",
    "/contato/": "https://taggo.one/mmendelson",
    "/garmin-pricing/": "https://kiezelpay.com/code/?s=6B55524C-B713-A5B0-5C41-2D9341952181&dsu=2277156&p=69899-65105-76769-67043-67044-67046-65066-63790-66655-76730-69886&platform=garmin",
    "/pair/": "https://api.mmendelson.com/pair",
    "/tracker-data-field/": "/tracker/",
    "/tracker-data/": "/tracker-data-field/",
    "/inicio/": "/",
    # Short aliases the original 301s to a page (single-letter and word
    # shortcuts; targets mirror the original exactly and may chain on from
    # there, e.g. /g/ -> /garmin-apps/ -> apps.mmendelson.com).
    "/a/": "/off/a-coxinha/",
    "/b/": "/off/byte-papo/",
    "/c/": "/contact/",
    "/e/": "/extra-resources/",
    "/f/": "/teaching/fga/",
    "/g/": "/garmin-apps/",
    "/i/": "/",
    "/m/": "/off/music-sheets/",
    "/o/": "/off/",
    "/r/": "/off/run/",
    "/t/": "/teaching/",
    "/u/": "/teaching/university-center-iesb/",
    "/garmin/": "/garmin-apps/",
    "/music/": "/off/music-sheets/",
    "/teach/": "/teaching/",
    "/track/": "/tracker/",
    "/pub/": "/publications/",
    "/publication/": "/publications/",
    "/extra/": "/extra-resources/",
    "/uni/": "/teaching/university-center-iesb/",
    "/university/": "/teaching/university-center-iesb/",
}


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def rewrite_internal_links(html):
    """Turn absolute mmendelson.com page links into root-relative ones."""
    return re.sub(r'https?://(?:www\.)?mmendelson\.com(/[^"\'\s)]*)?', r'\1', html)


def add_base(html):
    """Prefix root-relative href/src URLs with the site base path.

    Protocol-relative URLs (//host/...) are left untouched.
    """
    if not BASE:
        return html
    return re.sub(r'(href|src)="/(?!/)', r'\1="' + BASE + '/', html)


def build_nav(current_url):
    items = []
    for label, url, children in NAV:
        active = " active" if url == current_url or (
            children and any(c[1] == current_url for c in children)) else ""
        if children:
            sub = "".join(
                '<li><a href="{}"{}>{}</a></li>'.format(
                    BASE + cu, ' class="active"' if cu == current_url else "", cl)
                for cl, cu in children)
            # Parent items only reveal the submenu — they do not link to a page.
            items.append(
                '<li class="has-children">'
                '<a class="menu-parent{}" role="button" tabindex="0" '
                'aria-haspopup="true" aria-expanded="false">{}</a>'
                '<ul class="submenu">{}</ul></li>'.format(
                    " active" if active else "", label, sub))
        else:
            items.append('<li><a href="{}"{}>{}</a></li>'.format(
                BASE + url, ' class="active"' if active else "", label))
    return "<ul>" + "".join(items) + "</ul>"


def build_social():
    out = []
    for name, href, svg in SOCIAL:
        rel = "" if href.startswith("mailto:") else ' target="_blank" rel="noopener"'
        out.append(
            '<a href="{}" aria-label="{}" title="{}"{}>'
            '<svg viewBox="0 0 24 24" aria-hidden="true">{}</svg></a>'.format(
                href, name, name, rel, svg))
    return "\n        ".join(out)


def render_page(template, slug, url, title, h1, desc):
    body = add_base(rewrite_internal_links(read(os.path.join(CONTENT, slug + ".html"))))
    h1_html = '<h1 class="page-title">{}</h1>'.format(h1) if h1 else ""
    # The template ships a default page-title; replace the whole block.
    page = template.replace(
        '<h1 class="page-title">{{H1}}</h1>', h1_html)
    page = (page
            .replace("{{TITLE}}", title)
            .replace("{{DESC}}", desc)
            .replace("{{SITE}}", SITE_URL)
            .replace("{{BASE}}", BASE)
            .replace("{{URL}}", url)
            .replace("{{NAV}}", build_nav(url))
            .replace("{{CONTENT}}", body)
            .replace("{{SOCIAL}}", build_social())
            .replace("{{YEAR}}", str(YEAR)))
    return page


def out_path_for(url):
    if url == "/":
        return os.path.join(OUT, "index.html")
    return os.path.join(OUT, url.strip("/"), "index.html")


def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def redirect_html(target):
    external = target.startswith(("http://", "https://"))
    link = target if external else BASE + target
    canonical = target if external else SITE_URL + target
    # & is legal in a JS string / location.replace, but must be escaped in
    # HTML attribute contexts (href, meta content, canonical).
    link_attr = link.replace("&", "&amp;")
    canonical_attr = canonical.replace("&", "&amp;")
    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<title>Redirecting…</title>'
        '<link rel="canonical" href="{c}">'
        '<meta http-equiv="refresh" content="0; url={la}">'
        '<meta name="robots" content="noindex">'
        '</head><body>'
        '<p>This page has moved. <a href="{la}">Click here</a> if you are not '
        'redirected automatically.</p>'
        '<script>location.replace("{link}");</script>'
        '</body></html>'.format(c=canonical_attr, la=link_attr, link=link))


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)

    template = read(os.path.join(TEMPLATES, "base.html"))

    # Pages
    for slug, url, title, h1, desc in PAGES:
        html = render_page(template, slug, url, title, h1, desc)
        write_file(out_path_for(url), html)
        print("page   ", url)

    # Redirects
    for src, target in REDIRECTS.items():
        write_file(out_path_for(src), redirect_html(target))
        print("redirect", src, "->", target)

    # 404
    notfound = render_page(template, "404", "/404.html",
                           "Page not found — Mateus Mendelson",
                           "Page not found",
                           "The page you are looking for does not exist.") \
        if os.path.exists(os.path.join(CONTENT, "404.html")) else None
    if notfound is None:
        notfound = (template
                    .replace('<h1 class="page-title">{{H1}}</h1>',
                             '<h1 class="page-title">Page not found</h1>')
                    .replace("{{TITLE}}", "Page not found — Mateus Mendelson")
                    .replace("{{DESC}}", "The page you are looking for does not exist.")
                    .replace("{{SITE}}", SITE_URL)
                    .replace("{{BASE}}", BASE)
                    .replace("{{URL}}", "/404.html")
                    .replace("{{NAV}}", build_nav("/404.html"))
                    .replace("{{CONTENT}}",
                             '<p>Sorry, the page you are looking for does not exist. '
                             'Try the <a href="{}/">home page</a>.</p>'.format(BASE))
                    .replace("{{SOCIAL}}", build_social())
                    .replace("{{YEAR}}", str(YEAR)))
    write_file(os.path.join(OUT, "404.html"), notfound)
    print("page    /404.html")

    # Assets
    shutil.copytree(ASSETS, os.path.join(OUT, "assets"))
    print("copied  assets/")

    # CNAME (only when a custom domain is configured; otherwise a CNAME file
    # would make GitHub Pages redirect the project URL to the custom domain).
    if CUSTOM_DOMAIN:
        write_file(os.path.join(OUT, "CNAME"), CUSTOM_DOMAIN + "\n")

    # robots.txt + sitemap.xml
    write_file(os.path.join(OUT, "robots.txt"),
               "User-agent: *\nAllow: /\nSitemap: {}/sitemap.xml\n".format(SITE_URL))
    today = datetime.date.today().isoformat()
    urls = "".join(
        "  <url><loc>{}{}</loc><lastmod>{}</lastmod></url>\n".format(SITE_URL, u, today)
        for _, u, *_ in PAGES)
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
               + urls + "</urlset>\n")
    write_file(os.path.join(OUT, "sitemap.xml"), sitemap)
    print("wrote   sitemap.xml, robots.txt" + (", CNAME" if CUSTOM_DOMAIN else ""))

    print("\nDone. Output in", OUT)


if __name__ == "__main__":
    main()
