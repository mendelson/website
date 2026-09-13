#!/usr/bin/env python3
"""
Printed-card batches: load, validate, and generate the edge lookup table.

`cards/batches.json` is the single source of truth for every printed batch.
This module is the only thing that reads it: `build.py` calls `generate()` on
every build, and `tools/check_cards.py` calls `validate()` plus a
regenerate-and-diff gate in CI.

Two properties this file exists to enforce:

  * The edge only ever learns `id -> destination`. Batch metadata (headline,
    print run, distribution point) is for the developer's own queries and is
    never compiled into anything a visitor can fetch.
  * An id that would be shadowed by a real page is rejected at build time
    rather than discovered on a printed card. The reserved set is derived from
    `build.PAGES` / `build.REDIRECTS`, so adding a page automatically defends
    its own path.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(ROOT, "cards", "batches.json")
GENERATED = os.path.join(ROOT, "functions", "batches.generated.js")

# Ids are matched case-insensitively and stored lowercase, so the printed card
# may carry any case. Kept to unreserved URL characters only: a card is read by
# a human squinting at a QR failure, so no punctuation to mistype.
ID_RE = re.compile(r"^[a-z0-9]+$")

# Paths that can never be a batch id, on top of whatever build.py registers.
EXTRA_RESERVED = {
    "index.html", "404.html", "robots.txt", "sitemap.xml", "cname",
    "assets", "favicon.ico",
}


class ConfigError(Exception):
    """Raised for any batch config that must not reach a printed card."""


def reserved_paths(pages, redirects):
    """Single-segment paths the static site already answers on."""
    reserved = set(EXTRA_RESERVED)
    for url in [p[1] for p in pages] + list(redirects):
        segments = [s for s in url.strip("/").split("/") if s]
        if len(segments) == 1:
            reserved.add(segments[0].lower())
    return reserved


def load(path=CONFIG):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _check_destination(value, where):
    if not isinstance(value, str) or not value.startswith(("http://", "https://")):
        raise ConfigError(
            "{}: destination must be an absolute http(s) URL, got {!r}"
            .format(where, value))
    if value.startswith("http://"):
        raise ConfigError(
            "{}: destination must be https, got {!r}".format(where, value))


def validate(config, reserved, domain, max_url_len=26):
    """Return {id: destination}, or raise ConfigError.

    `max_url_len` is the QR density ceiling: the printed URL is
    `<domain>/<id>` and must come in *under* this many characters.
    """
    default = config.get("default_destination")
    _check_destination(default, "default_destination")

    batches = config.get("batches")
    if not isinstance(batches, list):
        raise ConfigError("batches: must be a list")

    prefix_len = len(domain) + 1  # "mmendelson.com" + "/"
    max_id_len = max_url_len - 1 - prefix_len  # strictly under the ceiling

    table = {}
    for i, batch in enumerate(batches):
        where = "batches[{}]".format(i)
        if not isinstance(batch, dict):
            raise ConfigError("{}: must be an object".format(where))

        raw_id = batch.get("id")
        if not isinstance(raw_id, (str, int)):
            raise ConfigError("{}: id is required".format(where))
        batch_id = str(raw_id).lower()
        where = "batch {!r}".format(batch_id)

        if not ID_RE.match(batch_id):
            raise ConfigError(
                "{}: id must be letters and digits only".format(where))
        if len(batch_id) > max_id_len:
            raise ConfigError(
                "{}: printed URL {}/{} is {} chars; must be under {}"
                .format(where, domain, batch_id,
                        prefix_len + len(batch_id), max_url_len))
        if batch_id in table:
            raise ConfigError(
                "{}: duplicate id (ids are matched case-insensitively)"
                .format(where))
        if batch_id in reserved:
            raise ConfigError(
                "{}: id collides with an existing path on the site — "
                "/{} already serves a page or redirect".format(where, batch_id))

        destination = batch.get("destination")
        if destination is None:
            destination = default
        else:
            _check_destination(destination, where)

        printed = batch.get("printed")
        if not isinstance(printed, str) or not re.match(r"^\d{4}-\d{2}-\d{2}$", printed):
            raise ConfigError(
                "{}: printed must be a YYYY-MM-DD date".format(where))

        quantity = batch.get("quantity")
        if not isinstance(quantity, int) or quantity <= 0:
            raise ConfigError("{}: quantity must be a positive integer".format(where))

        for field in ("headline", "location"):
            if not isinstance(batch.get(field), str) or not batch[field].strip():
                raise ConfigError("{}: {} is required".format(where, field))

        table[batch_id] = destination

    return table


def render(table, default_destination):
    """The edge module: ids and destinations only, never batch metadata."""
    rows = "".join(
        "  {}: {},\n".format(json.dumps(k), json.dumps(v))
        for k, v in sorted(table.items()))
    return (
        "// GENERATED by batches.py from cards/batches.json — do not edit.\n"
        "// Run `python3 build.py` to regenerate; tools/check_cards.py gates it.\n"
        "//\n"
        "// Only id -> destination lives here. Batch metadata (headline, print\n"
        "// run, distribution point) stays in cards/batches.json and is never\n"
        "// shipped to the edge or exposed on a public route.\n"
        "export const DEFAULT_DESTINATION = {};\n"
        "\n"
        "export const BATCHES = {{\n{}}};\n".format(
            json.dumps(default_destination), rows))


def generate(pages, redirects, domain, path=CONFIG, out=GENERATED):
    """Validate the config and write the edge module. Returns the table."""
    config = load(path)
    table = validate(config, reserved_paths(pages, redirects), domain)
    js = render(table, config["default_destination"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(js)
    return table
