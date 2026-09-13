#!/usr/bin/env python3
"""
Post-build checks for the generated site.  Standard library only.

    python3 tools/check_build.py

Rebuilds into public/ and then asserts things about the *output*, which is the
only place the failures below are visible:

  * an unsubstituted {{PLACEHOLDER}} shipping to production — the GA id became
    one of those, so a missed .replace() would silently disable analytics on
    whichever page forgot it;
  * a page, redirect or short link that the registry claims and the output
    does not have;
  * a tracked short link whose stub lost its measurement (the GA id, the
    short_link_click event, or the code itself) and so reports nothing while
    still redirecting perfectly — the failure nobody notices, because the link
    keeps working.

Every check reports a COUNT and a zero count fails: a checker that silently
checked nothing is the worst possible pass.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import build  # noqa: E402  (path has to be set first)

failures = []


def check(label, condition, detail=""):
    if not condition:
        failures.append("{}{}".format(label, (" — " + detail) if detail else ""))


def read_out(url):
    path = build.out_path_for(url)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return f.read()


def main():
    build.build()
    print("\n--- checks ---")

    # 1. No unsubstituted placeholders anywhere in the output.
    scanned = leftover = 0
    for root, _dirs, files in os.walk(build.OUT):
        for name in files:
            if not name.endswith((".html", ".xml", ".txt")):
                continue
            scanned += 1
            path = os.path.join(root, name)
            with open(path, encoding="utf-8") as f:
                found = re.findall(r"\{\{[A-Z_]+\}\}", f.read())
            if found:
                leftover += 1
                failures.append("unsubstituted {} in {}".format(
                    sorted(set(found)), os.path.relpath(path, build.OUT)))
    check("no file scanned for placeholders", scanned > 0)
    print("placeholders : {} files scanned, {} with leftovers".format(scanned, leftover))

    # 2. Every registered page rendered.
    for _slug, url, title, *_ in build.PAGES:
        html = read_out(url)
        check("page {} missing".format(url), html is not None)
        if html:
            check("page {} lost its GA tag".format(url),
                  build.GA_MEASUREMENT_ID in html)
            check("page {} lost its title".format(url), "<title>" in html)
    check("no pages registered", len(build.PAGES) > 0)
    print("pages        : {} rendered".format(len(build.PAGES)))

    # 3. Every redirect points where the registry says.
    for src, target in build.REDIRECTS.items():
        html = read_out(src)
        check("redirect {} missing".format(src), html is not None)
        if html:
            link = target if target.startswith(("http://", "https://")) else build.BASE + target
            check("redirect {} does not point at {}".format(src, target),
                  link.replace("&", "&amp;") in html)
    check("no redirects registered", len(build.REDIRECTS) > 0)
    print("redirects    : {} written".format(len(build.REDIRECTS)))

    # 4. Every tracked short link still measures what it claims to.
    for src, (target, to_site) in build.TRACKED_SHORT_LINKS.items():
        code = src.strip("/")
        html = read_out(src)
        check("short link {} missing".format(src), html is not None)
        if not html:
            continue
        for what, needle in (
                ("the GA measurement id", build.GA_MEASUREMENT_ID),
                ("the short_link_click event", "'short_link_click'"),
                ("its code", "code:'{}'".format(code)),
                ("its to_site", "to_site:'{}'".format(to_site)),
                ("its destination", 'href="{}"'.format(target.replace("&", "&amp;"))),
                ("the no-JS meta refresh", 'http-equiv="refresh"'),
                ("noindex", 'content="noindex"')):
            check("short link {} lost {}".format(src, what), needle in html)
        check("short link {} is indexable".format(src), "noindex" in html)
    check("no tracked short links registered", len(build.TRACKED_SHORT_LINKS) > 0)
    print("short links  : {} written".format(len(build.TRACKED_SHORT_LINKS)))

    # 5. The registries must not fight over the same output path.
    urls = [u for _, u, *_ in build.PAGES] + list(build.REDIRECTS) + list(build.TRACKED_SHORT_LINKS)
    dupes = sorted({u for u in urls if urls.count(u) > 1})
    check("two registries claim the same URL", not dupes, ", ".join(dupes))
    print("url conflicts: {}".format(len(dupes)))

    print()
    if failures:
        for f in failures:
            print("FAIL  " + f)
        print("\n{} check(s) failed.".format(len(failures)))
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
