#!/usr/bin/env python3
"""
Gate for the printed-card redirect config.

Run from the repo root:  python3 tools/check_cards.py

Three things it proves, in order of what actually bites:

  1. `cards/batches.json` is valid — every id fits the QR budget, is unique
     case-insensitively, and does not collide with a page the site already
     serves. A bad id here becomes a dead printed card.
  2. `functions/batches.generated.js` is in sync with it. The generated module
     is committed so the edge bundle never depends on build ordering, which
     means it can drift; this is what stops it.
  3. The validator actually rejects bad input. A validator that accepts
     everything passes every positive test it is given, so the negative cases
     below are the ones carrying the weight.

Prints the number of assertions it ran: a green run that ran nothing is the
worst possible green.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import build  # noqa: E402  (path set up above)
import batches  # noqa: E402

DOMAIN = build.CUSTOM_DOMAIN or "mmendelson.com"
RESERVED = batches.reserved_paths(build.PAGES, build.REDIRECTS)

checks = 0
failures = []


def check(label, condition):
    global checks
    checks += 1
    if not condition:
        failures.append(label)
        print("  FAIL  {}".format(label))
    else:
        print("  ok    {}".format(label))


def rejects(label, config):
    """The validator must raise ConfigError for this config."""
    try:
        batches.validate(config, RESERVED, DOMAIN)
    except batches.ConfigError:
        check(label, True)
    else:
        check(label, False)


def batch(**overrides):
    base = {
        "id": "9",
        "printed": "2026-09-20",
        "quantity": 100,
        "headline": "h",
        "location": "l",
        "destination": None,
    }
    base.update(overrides)
    return base


def config_with(*items, **overrides):
    conf = {
        "default_destination": "https://apps.mmendelson.com/",
        "batches": list(items),
    }
    conf.update(overrides)
    return conf


print("== 1. the committed config is valid ==")
config = batches.load()
try:
    table = batches.validate(config, RESERVED, DOMAIN)
    check("cards/batches.json validates", True)
    check("at least one batch is defined", len(table) > 0)
    print("        {} batch(es): {}".format(len(table), ", ".join(sorted(table))))
except batches.ConfigError as err:
    check("cards/batches.json validates ({})".format(err), False)
    table = {}

print("\n== 2. the generated edge module is in sync ==")
expected = batches.render(table, config["default_destination"])
try:
    with open(batches.GENERATED, encoding="utf-8") as f:
        actual = f.read()
except FileNotFoundError:
    actual = None
check("functions/batches.generated.js exists", actual is not None)
check("functions/batches.generated.js matches cards/batches.json "
      "(run `python3 build.py`)", actual == expected)

print("\n== 3. the edge module carries no batch metadata ==")
# The developer's notes are not the visitor's business, and the bundle is
# fetchable in principle. Assert the leak cannot happen silently.
if actual:
    for field in ("headline", "location", "quantity", "printed", "notes"):
        values = [str(b.get(field, "")) for b in config["batches"] if b.get(field)]
        leaked = [v for v in values if v and v in actual]
        check("no {} value reaches the edge bundle".format(field), not leaked)

print("\n== 4. the validator rejects what it must ==")
rejects("id colliding with an existing page (/cv)", config_with(batch(id="cv")))
rejects("id colliding with an existing redirect (/r)", config_with(batch(id="r")))
rejects("duplicate ids differing only in case",
        config_with(batch(id="7"), batch(id="7")))
rejects("id too long for the QR budget", config_with(batch(id="a" * 11)))
rejects("id with punctuation", config_with(batch(id="a-1")))
rejects("empty id", config_with(batch(id="")))
rejects("http destination", config_with(batch(destination="http://example.com/")))
rejects("relative destination", config_with(batch(destination="/somewhere")))
rejects("http default_destination",
        config_with(batch(), default_destination="http://example.com/"))
rejects("missing headline", config_with(batch(headline="")))
rejects("missing location", config_with(batch(location="")))
rejects("bad printed date", config_with(batch(printed="20/09/2026")))
rejects("zero quantity", config_with(batch(quantity=0)))

print("\n== 5. case-insensitive matching and the QR budget ==")
accepted = batches.validate(config_with(batch(id="R")), RESERVED - {"r"}, DOMAIN)
check("an uppercase id is stored lowercase", "r" in accepted)
longest = max(table, key=len) if table else ""
printed_len = len(DOMAIN) + 1 + len(longest)
check("longest printed URL {}/{} is {} chars (< 26)"
      .format(DOMAIN, longest, printed_len), printed_len < 26)

print("\n== 6. the scan query tool parses what wrangler actually prints ==")
import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "scans", os.path.join(os.path.dirname(os.path.abspath(__file__)), "scans.py"))
scans = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(scans)

check("array-shaped output is read whole",
      scans._json_part('[{"results":[{"a":1}]}]') == '[{"results":[{"a":1}]}]')
# Regression: probing for "[" first pulled the inner results array out of an
# object payload and dropped the envelope, so every query read back empty.
check("object-shaped output keeps its envelope",
      scans._json_part('{"results":[{"a":1}]}') == '{"results":[{"a":1}]}')
check("a human-readable preamble is skipped",
      scans._json_part('Executing on remote database\n[{"results":[]}]')
      == '[{"results":[]}]')
check("batch metadata joins on the lowercased id",
      set(scans.batch_metadata()) == set(table))

print("\n" + "=" * 60)
if failures:
    print("FAILED — {} of {} checks".format(len(failures), checks))
    for f in failures:
        print("  - {}".format(f))
    sys.exit(1)
if checks == 0:
    print("FAILED — the gate ran zero checks")
    sys.exit(1)
print("PASSED — {} checks".format(checks))
