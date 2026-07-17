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
CUSTOM_DOMAIN = "mmendelson.com"

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
#   layout "custom" — the fragment provides its own full <main> structure
#                     (home, teaching, publications: bespoke pages).
#   layout "prose"  — content is wrapped in a "← Home" breadcrumb + page
#                     title + generic prose container.
#   maxw            — <main> max-width in px (1020 = home, 840 = content pages).
# --------------------------------------------------------------------------
PAGES = [
    # slug            url                                   title                                          h1                                desc                                                                             layout    maxw
    ("home",          "/",                                  "Mateus Mendelson — Data Scientist",           "",                               "Mateus Mendelson — Data Scientist. Two production systems built and run solo, teaching materials, research and publications.", "custom", 1020),
    ("teaching",      "/teaching/",                         "Teaching Materials — Mateus Mendelson",       "Teaching Materials",             "Course notes, slide decks and notebooks authored by Mateus Mendelson, organized by discipline.",                              "custom", 840),
    ("publications",  "/publications/",                     "Research & Publications — Mateus Mendelson",  "Research & Publications",        "Conference proceedings, theses, workshops, seminars and posters by Mateus Mendelson.",                                        "custom", 840),
    ("fga",           "/teaching/fga/",                     "UnB Gama — Mateus Mendelson",                 "University of Brasília - Gama",  "Courses taught at the University of Brasília - Gama (UnB/FGA).",                                                               "prose",  840),
    ("iesb",          "/teaching/university-center-iesb/",  "IESB — Mateus Mendelson",                     "University Center IESB",         "Courses taught at the University Center IESB.",                                                                               "prose",  840),
    ("projecao",      "/teaching/projecao/",                "Projeção — Mateus Mendelson",                 "University Center Projeção",     "Courses taught at the University Center Projeção.",                                                                           "prose",  840),
    ("off",           "/off/",                              "Side projects — Mateus Mendelson",            "Side projects",                  "Personal interests and side projects.",                                                                                       "prose",  840),
    ("music-sheets",  "/off/music-sheets/",                 "Music Sheets — Mateus Mendelson",             "Music Sheets",                   "Music sheets transcribed by Mateus Mendelson.",                                                                               "prose",  840),
    ("cv",            "/cv/",                               "CV — Mateus Mendelson",                       "CV",                             "Curriculum Vitae of Mateus Mendelson.",                                                                                       "prose",  840),
    ("a-coxinha",     "/off/a-coxinha/",                    "A Coxinha — Mateus Mendelson",                "A Coxinha",                      "An example page built during an HTML 101 class.",                                                                             "prose",  840),
    # /tracker/ moved to apps.mmendelson.com/tracker (now a redirect, see REDIRECTS).
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
    # Extra resources merged into Teaching.
    "/extra-resources/": "/teaching/",
    # Other old slugs.
    "/findme/": "https://taggo.one/mmendelson",
    "/contato/": "https://taggo.one/mmendelson",
    "/garmin-pricing/": "https://kiezelpay.com/code/?s=6B55524C-B713-A5B0-5C41-2D9341952181&dsu=2277156&p=69899-65105-76769-67043-67044-67046-65066-63790-66655-76730-69886&platform=garmin",
    "/pair/": "https://api.mmendelson.com/pair",
    # The Garmin Tracker Data Field companion moved to apps.mmendelson.com/tracker.
    # These carry the ?trackId=… query to the destination (see
    # PRESERVE_QUERY_REDIRECTS below).
    "/tracker/": "https://apps.mmendelson.com/tracker/",
    "/tracker-data-field/": "https://apps.mmendelson.com/tracker/",
    "/tracker-data/": "https://apps.mmendelson.com/tracker/",
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
    "/track/": "https://apps.mmendelson.com/tracker/",
    "/pub/": "/publications/",
    "/publication/": "/publications/",
    "/extra/": "/extra-resources/",
    "/uni/": "/teaching/university-center-iesb/",
    "/university/": "/teaching/university-center-iesb/",
}

# Redirect sources whose stub carries the incoming query string + hash to the
# destination. The Garmin tracker moved to apps.mmendelson.com/tracker and its
# links carry ?trackId=…, which must survive the redirect.
PRESERVE_QUERY_REDIRECTS = {
    "/tracker/", "/track/", "/tracker-data/", "/tracker-data-field/",
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


def out_path_for(url):
    if url == "/":
        return os.path.join(OUT, "index.html")
    return os.path.join(OUT, url.strip("/"), "index.html")


def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def redirect_html(target, preserve_query=False):
    external = target.startswith(("http://", "https://"))
    link = target if external else BASE + target
    canonical = target if external else SITE_URL + target
    # & is legal in a JS string / location.replace, but must be escaped in
    # HTML attribute contexts (href, meta content, canonical).
    link_attr = link.replace("&", "&amp;")
    canonical_attr = canonical.replace("&", "&amp;")
    # When preserve_query is set, carry the incoming query string and hash to
    # the destination — used by the migrated /tracker/ redirect so ?trackId=…
    # survives the hop to apps.mmendelson.com. The no-JS meta-refresh fallback
    # keeps the bare target.
    if preserve_query:
        js = 'location.replace("{link}"+location.search+location.hash);'.format(link=link)
    else:
        js = 'location.replace("{link}");'.format(link=link)
    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<title>Redirecting…</title>'
        '<link rel="canonical" href="{c}">'
        '<meta http-equiv="refresh" content="0; url={la}">'
        '<meta name="robots" content="noindex">'
        '</head><body>'
        '<p>This page has moved. <a href="{la}">Click here</a> if you are not '
        'redirected automatically.</p>'
        '<script>{js}</script>'
        '</body></html>'.format(c=canonical_attr, la=link_attr, js=js))


def render_page(template, slug, url, title, h1, desc, layout, maxw):
    body = add_base(rewrite_internal_links(read(os.path.join(CONTENT, slug + ".html"))))
    if layout == "prose":
        main_html = (
            '<div class="page-head">'
            '<a class="breadcrumb" href="{base}/">'
            '<span class="t"><span lang="en">← Home</span><span lang="de">← Startseite</span>'
            '<span lang="es">← Inicio</span><span lang="fr">← Accueil</span>'
            '<span lang="pt">← Início</span></span>'
            '</a>'
            '<h1 class="page-title">{h1}</h1>'
            '</div>\n<div class="prose">\n{body}\n</div>'
        ).format(base=BASE, h1=h1, body=body)
    else:
        main_html = body
    page = (template
            .replace("{{TITLE}}", title)
            .replace("{{DESC}}", desc)
            .replace("{{SITE}}", SITE_URL)
            .replace("{{BASE}}", BASE)
            .replace("{{URL}}", url)
            .replace("{{MAXW}}", str(maxw))
            .replace("{{MAIN}}", main_html)
            .replace("{{YEAR}}", str(YEAR)))
    return page


def build():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)

    template = read(os.path.join(TEMPLATES, "base.html"))

    # Pages
    for slug, url, title, h1, desc, layout, maxw in PAGES:
        html = render_page(template, slug, url, title, h1, desc, layout, maxw)
        write_file(out_path_for(url), html)
        print("page   ", url)

    # Redirects
    for src, target in REDIRECTS.items():
        write_file(out_path_for(src), redirect_html(target, src in PRESERVE_QUERY_REDIRECTS))
        print("redirect", src, "->", target)

    # 404
    notfound_path = os.path.join(CONTENT, "404.html")
    if os.path.exists(notfound_path):
        notfound = render_page(
            template, "404", "/404.html",
            "Page not found — Mateus Mendelson", "Page not found",
            "The page you are looking for does not exist.", "prose", 840)
    else:
        notfound = (
            template
            .replace("{{TITLE}}", "Page not found — Mateus Mendelson")
            .replace("{{DESC}}", "The page you are looking for does not exist.")
            .replace("{{SITE}}", SITE_URL)
            .replace("{{BASE}}", BASE)
            .replace("{{URL}}", "/404.html")
            .replace("{{MAXW}}", "840")
            .replace("{{MAIN}}",
                     '<div class="page-head">'
                     '<a class="breadcrumb" href="{b}/">← Home</a>'
                     '<h1 class="page-title">Page not found</h1></div>'
                     '<div class="prose"><p>Sorry, the page you are looking for '
                     'does not exist. Try the <a href="{b}/">home page</a>.</p>'
                     '</div>'.format(b=BASE))
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
    build()
