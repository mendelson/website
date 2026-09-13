#!/usr/bin/env python3
"""
Query the printed-card scan log.

Run from the repo root. Needs `npx wrangler` and a Cloudflare login
(`npx wrangler login`) — same tool the deploy uses, no extra credentials.

    python3 tools/scans.py summary        # scans per batch, best first
    python3 tools/scans.py daily          # scans per batch per day
    python3 tools/scans.py invalid        # ids scanned that are not configured
    python3 tools/scans.py csv            # every row, as CSV on stdout
    python3 tools/scans.py csv > scans.csv

The point of the summary is comparing batches, so it joins each id against
cards/batches.json and prints the headline and distribution point beside the
count — that comparison is the whole reason the log exists, and it is
unreadable as bare ids.

Add --local to read the local D1 copy instead of production.
"""
import argparse
import csv
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import batches  # noqa: E402

DATABASE = "card-scans"


def query(sql, local=False):
    """Run one SQL statement through wrangler and return the rows."""
    cmd = [
        "npx", "wrangler", "d1", "execute", DATABASE,
        "--local" if local else "--remote",
        "--json", "--command", sql,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError:
        sys.exit("npx not found — install Node, then `npx wrangler login`")

    if proc.returncode != 0:
        sys.stderr.write(proc.stderr or proc.stdout)
        sys.exit(
            "\nwrangler failed. Check that you are logged in "
            "(`npx wrangler login`) and that the database exists "
            "(`npx wrangler d1 list`)."
        )

    # wrangler prints a JSON array of statement results; older versions print a
    # bare object. Accept both rather than pinning a version.
    payload = json.loads(_json_part(proc.stdout))
    if isinstance(payload, list):
        payload = payload[0] if payload else {}
    return payload.get("results", [])


def _json_part(output):
    """wrangler may print human-readable preamble before the JSON.

    Take the OUTERMOST value: probing for "[" before "{" would pull the inner
    results array out of an object-shaped payload and silently drop the
    envelope around it.
    """
    stripped = output.strip()
    try:
        json.loads(stripped)
        return stripped
    except ValueError:
        pass

    starts = [(output.find(o), c) for o, c in (("[", "]"), ("{", "}"))
              if output.find(o) != -1]
    if starts:
        start, closer = min(starts)
        end = output.rfind(closer)
        if end > start:
            return output[start:end + 1]
    sys.exit("could not parse wrangler output:\n" + output)


def batch_metadata():
    """id -> the batch's own row in cards/batches.json."""
    config = batches.load()
    return {str(b["id"]).lower(): b for b in config.get("batches", [])}


def cmd_summary(args):
    rows = query(
        "SELECT batch_id, COUNT(*) AS scans, "
        "MIN(ts_utc) AS first_scan, MAX(ts_utc) AS last_scan, "
        "COUNT(DISTINCT ip_hash) AS uniques, "
        "MAX(invalid) AS invalid "
        "FROM scans GROUP BY batch_id ORDER BY scans DESC",
        args.local,
    )
    if not rows:
        print("No scans recorded yet.")
        return

    meta = batch_metadata()
    print("{:<6} {:>7} {:>8} {:<11} {:<11} {:<28} {}".format(
        "id", "scans", "uniques", "first", "last", "headline", "where"))
    print("-" * 100)
    for row in rows:
        info = meta.get(row["batch_id"], {})
        flag = "  (UNKNOWN ID)" if row["invalid"] else ""
        print("{:<6} {:>7} {:>8} {:<11} {:<11} {:<28} {}{}".format(
            row["batch_id"],
            row["scans"],
            row["uniques"],
            (row["first_scan"] or "")[:10],
            (row["last_scan"] or "")[:10],
            _clip(info.get("headline", "—"), 28),
            _clip(info.get("location", "—"), 30),
            flag,
        ))

    printed = sum(
        b.get("quantity", 0) for bid, b in meta.items()
        if any(r["batch_id"] == bid for r in rows)
    )
    scanned = sum(r["scans"] for r in rows if not r["invalid"])
    if printed:
        print("\n{} scans from {} cards printed — {:.1f}% scan rate".format(
            scanned, printed, 100.0 * scanned / printed))


def cmd_daily(args):
    rows = query(
        "SELECT substr(ts_utc, 1, 10) AS day, batch_id, COUNT(*) AS scans "
        "FROM scans WHERE invalid = 0 "
        "GROUP BY day, batch_id ORDER BY day, batch_id",
        args.local,
    )
    if not rows:
        print("No scans recorded yet.")
        return
    print("{:<12} {:<6} {:>7}".format("day", "id", "scans"))
    print("-" * 27)
    for row in rows:
        print("{:<12} {:<6} {:>7}".format(row["day"], row["batch_id"], row["scans"]))


def cmd_invalid(args):
    rows = query(
        "SELECT batch_id, COUNT(*) AS scans, MAX(ts_utc) AS last_scan "
        "FROM scans WHERE invalid = 1 "
        "GROUP BY batch_id ORDER BY scans DESC",
        args.local,
    )
    if not rows:
        print("No scans of unknown ids. Every card scanned matched a batch.")
        return
    print("Ids scanned that are not in cards/batches.json — a mis-printed card,")
    print("a batch someone forgot to add, or a crawler guessing paths.\n")
    print("{:<12} {:>7} {:<22}".format("id", "scans", "last seen"))
    print("-" * 42)
    for row in rows:
        print("{:<12} {:>7} {:<22}".format(
            row["batch_id"], row["scans"], row["last_scan"] or ""))


def cmd_csv(args):
    rows = query(
        "SELECT batch_id, ts_utc, invalid, country, referrer, user_agent, ip_hash "
        "FROM scans ORDER BY ts_utc",
        args.local,
    )
    if not rows:
        sys.stderr.write("No scans recorded yet.\n")
        return
    meta = batch_metadata()
    fields = ["batch_id", "ts_utc", "invalid", "country", "referrer",
              "user_agent", "ip_hash", "headline", "location", "printed"]
    writer = csv.DictWriter(sys.stdout, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        info = meta.get(row["batch_id"], {})
        row["headline"] = info.get("headline", "")
        row["location"] = info.get("location", "")
        row["printed"] = info.get("printed", "")
        writer.writerow(row)


def _clip(text, width):
    text = str(text)
    return text if len(text) <= width else text[:width - 1] + "…"


COMMANDS = {
    "summary": cmd_summary,
    "daily": cmd_daily,
    "invalid": cmd_invalid,
    "csv": cmd_csv,
}


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=sorted(COMMANDS))
    parser.add_argument("--local", action="store_true",
                        help="read the local D1 copy instead of production")
    args = parser.parse_args()
    COMMANDS[args.command](args)


if __name__ == "__main__":
    main()
