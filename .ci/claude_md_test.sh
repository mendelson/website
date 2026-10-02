#!/usr/bin/env bash
# rule 19 — this repo's CLAUDE.md must REFERENCE the AI-Instructions repo, never
# copy it. Install as `.ci/claude_md_test.sh` and call it from the repo's
# invariants gate (and from the equivalent CI step, so both paths agree).
#
# Why a script and not just the rule: a copied rule is not wrong when it is
# written, so nobody reviewing that PR sees a defect. It rots afterwards,
# silently, and the next agent to read it cannot tell. The only moment the drift
# is cheap to catch is mechanically, on every run.
#
# What it checks, in order of how badly it goes wrong:
#   1. CLAUDE.md exists at all.
#   2. It carries the reference marker (so the agent is sent to the real rules).
#   3. It does not carry the shapes a copy takes.
#
# Deliberately NOT a heuristic on length or on the word "rule": a repo SHOULD
# name rules and say how they land locally — that is the wanted state, and a
# check that punished it would push repos toward saying nothing.
set -uo pipefail

F="${1:-CLAUDE.md}"
fail=0
say() { printf '%s\n' "$*"; }
bad() { say "FAIL  $*"; fail=1; }

if [ ! -f "$F" ]; then
    bad "$F does not exist — every repo carries one (AI-Instructions/templates/CLAUDE.md)"
    say
    say "Fix: copy the header from AI-Instructions/templates/CLAUDE.md, then add"
    say "     this repo's own layout/gotchas below it."
    exit 1
fi

# 1. The marker. Its absence is what a pre-rule-M file looks like.
if ! grep -q 'ai-instructions:reference' "$F"; then
    bad "$F is missing the rule 19 reference header (<!-- ai-instructions:reference -->)"
fi

# 2. The pointer has to actually name the repo — a marker with no link is a
#    marker that satisfies a grep and helps nobody.
if ! grep -qi 'AI-Instructions' "$F"; then
    bad "$F never names the AI-Instructions repo — the header must send the reader there"
fi

# 3. The shapes a copy takes. Each pattern below was observed in a real file.
#    "mirrored from" is the giveaway phrase; the lettered rule heading is the
#    structure the mirrored sections used.
if grep -qiE 'mirrored from .*AI-?Instructions|## *Authoritative instructions \(mirrored' "$F"; then
    bad "$F contains a mirrored copy of the account-wide rules (rule 19)"
fi

if grep -qE '^#{2,4} +[A-Z]\. ' "$F"; then
    say "      offending headings:"
    grep -nE '^#{2,4} +[A-Z]\. ' "$F" | sed 's/^/        /'
    bad "$F restates rules as lettered sections — name a rule and say how it lands here, do not explain it"
fi

if [ "$fail" -ne 0 ]; then
    say
    say "rule 19: the account-wide rules live in mendelson/AI-Instructions and are"
    say "read from there. A copy is correct the day it is written and stale after."
    say "Repo-specific instructions are welcome — a restatement of a rule is not."
    say "Procedure: AI-Instructions/docs/INSTRUCTIONS-SOURCING.md"
    exit 1
fi

say "CLAUDE.md references AI-Instructions and restates no rules (rule 19) — OK"
