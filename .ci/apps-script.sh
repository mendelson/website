#!/usr/bin/env bash
# Apps Script import/inspect helper (clasp).
#
# The point of this script: the DEVELOPER SHOULD NEVER COPY-PASTE .gs SOURCE.
# An agent with a clasp session pulls the live project straight into the repo.
# Everything here is read-only against Google except `push`, which is
# deliberately NOT implemented — deploying is deploy-appsscript.yml's job.
#
# Usage:
#   .ci/apps-script.sh login                 # interactive-ish OAuth, agent-safe
#   .ci/apps-script.sh info      <scriptId>  # title, owner, parentId (bound?)
#   .ci/apps-script.sh deployments <scriptId>
#   .ci/apps-script.sh pull      <scriptId> [destDir]   # default: apps-script/
#   .ci/apps-script.sh resolve   <srcFile>  # derive DEPLOYMENT_ID (+SCRIPT_ID)
#
# Requires node. Installs clasp at the pinned version if missing.
set -euo pipefail

CLASP_VERSION="${CLASP_VERSION:-3.3.0}"
CLASPRC="$HOME/.clasprc.json"

die() { echo "ERROR: $*" >&2; exit 1; }

ensure_clasp() {
    if ! command -v clasp >/dev/null 2>&1; then
        echo "installing @google/clasp@${CLASP_VERSION} ..." >&2
        npm i -g "@google/clasp@${CLASP_VERSION}" >/dev/null 2>&1 \
            || die "could not install clasp (need node + npm)"
    fi
}

require_auth() {
    [ -f "$CLASPRC" ] || die "not logged in — run: $0 login"
}

access_token() {
    require_auth
    node -e 'const j=require(process.env.CLASPRC);process.stdout.write(j.tokens.default.access_token)' \
        2>/dev/null || die "could not read an access token from $CLASPRC"
}

# ---------------------------------------------------------------- login ----
# `clasp login --no-localhost` prints a URL and then BLOCKS reading stdin.
#
# Two traps, both of which cost real time to work out:
#
#  1. If stdin is a pipe or FIFO with no writer yet, opening it blocks BEFORE
#     clasp runs — so nothing is printed and it looks hung. The writer here is
#     started as part of the same pipeline, so the write end is open from the
#     start and clasp prints its URL immediately.
#  2. Do NOT clean up with `pkill -f <pattern>` where the pattern also appears
#     in your own command line. It matches the calling shell and kills it.
#
# The operator opens the printed URL, authorizes, lands on a dead
# localhost:8888 page, and puts that WHOLE url into the code file.
cmd_login() {
    ensure_clasp
    local codefile="${TMPDIR:-/tmp}/clasp_cb_url"
    local outfile="${TMPDIR:-/tmp}/clasp_login_out"
    : > "$codefile"; : > "$outfile"

    ( while [ ! -s "$codefile" ]; do sleep 2; done; cat "$codefile" ) \
        | clasp login --no-localhost > "$outfile" 2>&1 &

    for _ in $(seq 1 20); do [ -s "$outfile" ] && break; sleep 2; done

    echo
    echo "1. Open the authorization URL printed below and approve it."
    echo "2. You will land on a DEAD http://localhost:8888/?...code=... page."
    echo "3. Put that WHOLE url into:  $codefile"
    echo "      printf '%s\\n' '<the url>' > $codefile"
    echo
    grep -o 'https://accounts.google.com[^ ]*' "$outfile" | head -1 || cat "$outfile"
    echo
    echo "Waiting for $codefile ..."
    for _ in $(seq 1 150); do
        [ -f "$CLASPRC" ] && { echo "logged in — credentials at $CLASPRC"; return 0; }
        sleep 2
    done
    die "timed out waiting for the callback url"
}

# ----------------------------------------------------------------- info ----
# parentId is the question that actually matters: a CONTAINER-BOUND script has
# the spreadsheet as its parent, so SpreadsheetApp.getActiveSpreadsheet()
# resolves. A standalone script has no parent and that call returns null —
# which is why maintenance code should always use openById(SHEET_ID) instead.
# Check this before believing either form works.
cmd_info() {
    local script_id="${1:?scriptId required}"
    curl -sS -H "Authorization: Bearer $(access_token)" \
        "https://script.googleapis.com/v1/projects/${script_id}"
    echo
}

# ---------------------------------------------------------- deployments ----
# Which deployment do the SHIPPED apps call? That is the one DEPLOYMENT_ID must
# name: `clasp deploy --deploymentId` updates a deployment IN PLACE and keeps
# its URL, so pointing the pipeline at a newer, unused deployment leaves the
# live endpoint frozen on old code forever. Installed watches cannot be
# migrated, so the URL already baked into shipped source wins.
#
# Cross-check the id against the /exec URL in the app's source. Do NOT curl the
# /exec URL to find out — an unrecognised request can land in the insert path.
cmd_deployments() {
    local script_id="${1:?scriptId required}"
    local work; work="$(mktemp -d)"
    printf '{"scriptId":"%s","rootDir":"."}\n' "$script_id" > "$work/.clasp.json"
    ( cd "$work" && clasp deployments )
    rm -rf "$work"
}

# ----------------------------------------------------------------- pull ----
# Pulls into a temp dir first, then copies in — so a failed pull cannot leave
# the repo half-updated. Filenames are preserved EXACTLY: clasp pushes whatever
# is in the folder, so renaming a file here creates a second file server-side
# and orphans the original.
cmd_pull() {
    local script_id="${1:?scriptId required}"
    local dest="${2:-apps-script}"
    require_auth; ensure_clasp
    mkdir -p "$dest"

    local work; work="$(mktemp -d)"
    printf '{"scriptId":"%s","rootDir":"."}\n' "$script_id" > "$work/.clasp.json"
    ( cd "$work" && clasp pull ) || { rm -rf "$work"; die "clasp pull failed"; }

    local n=0
    for f in "$work"/*; do
        case "$(basename "$f")" in
            .clasp.json) continue ;;   # generated by CI from SCRIPT_ID; never committed
        esac
        [ -f "$f" ] || continue
        cp "$f" "$dest/" && n=$((n+1))
    done
    rm -rf "$work"
    [ "$n" -gt 0 ] || die "pull produced no files"

    echo "pulled $n file(s) into $dest/"
    echo
    echo "COMMIT THIS VERBATIM, as its own commit, before changing anything."
    echo "The repo then mirrors production and every later edit is a reviewable"
    echo "diff instead of a rewrite tangled up with the import."
}

# ------------------------------------------------------------- resolve ----
# Work out SCRIPT_ID and DEPLOYMENT_ID instead of storing them.
#
# WHY DERIVE RATHER THAN CONFIGURE
# --------------------------------
# `clasp deploy --deploymentId` updates a deployment IN PLACE and keeps its
# URL. Name the wrong one and the live /exec endpoint is frozen on old code
# forever — installed watches cannot be migrated, and nothing fails: the deploy
# reports success against a deployment nobody calls. A stored id makes that
# mistake invisible and permanent.
#
# The app already knows the right answer. The Web App URL compiled into the
# shipped source IS "/macros/s/<DEPLOYMENT_ID>/exec", so deriving the id from
# that URL makes "the deployment the shipped apps call" true BY CONSTRUCTION
# rather than by discipline.
#
# SCRIPT_ID then follows from it: there is no "list my projects" call in the
# Apps Script API, but clasp has one, and the OAuth grant already covers it —
# `clasp login` requests drive.metadata.readonly and drive.readonly alongside
# script.projects / script.deployments (verified against @google/clasp@3.3.0).
# So: list the projects, ask each for its deployments, take the one that owns
# our deployment id. No name matching, nothing to keep in sync.
#
# Everything goes through clasp rather than raw curl for one practical reason:
# the access_token in ~/.clasprc.json expires in about an hour, and clasp
# refreshes it. Hand-rolled HTTP would have to re-implement the refresh.
#
#   resolve <file-or-url>   file: any source file containing the /exec URL
#
# Emits KEY=value lines, and appends to $GITHUB_OUTPUT when set.
cmd_resolve() {
    # A path, a URL, or nothing. Nothing means SEARCH THE REPO, which is the
    # right default: the file holding the URL is not named the same everywhere
    # (the free Route repo still calls it source/BraggerBackground.mc, from
    # before the rename), and a hardcoded path in the workflow silently fails
    # on exactly the repo that differs — which is how this was found.
    local src="${1:-}"
    local text
    if [ -n "$src" ] && [ -f "$src" ]; then
        text="$(cat "$src")"
    elif [ -n "$src" ] && [ ! -d "$src" ]; then
        text="$src"                               # a bare URL
    else
        # Default to source/ — the URL the APP CALLS is the authority. Docs and
        # sibling workflows may quote the twin's URL, and searching the whole
        # repo then finds two and (correctly) refuses. Found exactly that way:
        # the KiezelPay twin's dedupe cron had the GarminPay URL hardcoded.
        local root="${src:-source}"
        [ -d "$root" ] || root="."
        # Build outputs carry the URL too and are not the source of truth;
        # "Connect IQ details" mirrors store copy that may quote a URL.
        text="$(grep -rhoE 'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec' "$root"                   --exclude-dir=.git --exclude-dir=bin --exclude-dir=build                   --exclude-dir=export --exclude-dir='Connect IQ details'                   --binary-files=without-match 2>/dev/null || true)"
        [ -n "$text" ] || die "no /exec URL found anywhere under '$root' — is this repo wired to an Apps Script Web App?"
    fi

    # ---- DEPLOYMENT_ID: exact, offline, no API call, no ambiguity ----
    local urls n dep
    urls="$(printf '%s' "$text"             | grep -oE 'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec' | sort -u)"
    n="$(printf '%s
' "$urls" | grep -c . || true)"
    # Two different /exec URLs means the source disagrees with itself about
    # which endpoint it calls; picking the first would be a coin toss.
    [ "$n" -eq 1 ] || die "expected exactly one /exec URL in $src, found $n — resolve it in source first"
    dep="$(printf '%s' "$urls" | sed -E 's|.*/macros/s/([A-Za-z0-9_-]+)/exec|\1|')"

    # AN EMPTY $dep IS NOT A SEARCH FOR NOTHING, it is a search that matches
    # EVERYTHING: `grep -q -- ""` is true for any line, so _owns below would
    # accept the FIRST project the account can see and the deploy would push
    # this app's code into a project chosen at random. Not hypothetical — the
    # backreference in that sed was eaten into a 0x01 byte in this repo once
    # already (a7cbe7d) in another copy of this helper, and two copies
    # still carry the corrupted line today.
    [ -n "$dep" ] || die "could not extract a deployment id from '$urls' — the sed backreference is broken (see a7cbe7d)"

    require_auth; ensure_clasp

    # Does $1 own deployment $dep? Sets _OWNS_OUT to what clasp actually said,
    # stderr included, because that output IS the diagnosis when the answer is
    # no. It used to go to /dev/null, which made four distinct failures — an
    # expired token, a clasp subcommand that moved, a project the account cannot
    # see, and a genuinely wrong id — produce one identical message.
    _OWNS_OUT=""
    _owns() {
        local sid="$1" work rc=1
        work="$(mktemp -d)"
        printf '{"scriptId":"%s","rootDir":"."}
' "$sid" > "$work/.clasp.json"
        _OWNS_OUT="$( cd "$work" && clasp list-deployments 2>&1 )"
        printf '%s' "$_OWNS_OUT" | grep -q -- "$dep" && rc=0
        rm -rf "$work"
        return $rc
    }

    local sid=""
    if [ -n "${SCRIPT_ID:-}" ]; then
        # A pin is still CHECKED. A stale pin is exactly as dangerous as a wrong
        # deployment id, and silently pushing this app's code into another
        # project is worse than not deploying.
        if ! _owns "$SCRIPT_ID"; then
            echo "clasp list-deployments said:" >&2
            printf '%s\n' "$_OWNS_OUT" | sed 's/^/    /' >&2
            die "pinned SCRIPT_ID=$SCRIPT_ID does not own deployment $dep"
        fi
        sid="$SCRIPT_ID"
    else
        echo "no SCRIPT_ID pin — searching every project this account can see" >&2
        local ids listing
        listing="$(clasp list-scripts --json 2>&1)"
        ids="$(printf '%s' "$listing" | grep -oE '"id" *: *"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/')"
        if [ -z "$ids" ]; then
            echo "clasp list-scripts said:" >&2
            printf '%s\n' "$listing" | sed 's/^/    /' >&2
            die "clasp listed no script projects — is CLASP_CREDENTIALS a valid ~/.clasprc.json?"
        fi
        local candidate
        for candidate in $ids; do
            if _owns "$candidate"; then sid="$candidate"; break; fi
            # Say what each project DID have. "None of them own it" is only
            # believable once you can see that the listings were real.
            echo "  $candidate does not own $dep:" >&2
            printf '%s\n' "$_OWNS_OUT" | sed 's/^/      /' >&2
        done
        [ -n "$sid" ] || die "no script project owns deployment $dep.
  Either the /exec URL in $src belongs to a project this account cannot see, or
  clasp could not list deployments at all — the per-project output above says
  which. Pin it instead: set the SCRIPT_ID repo variable."
    fi

    # In the clear ON PURPOSE: these are the values a masked secret hid.
    echo "DEPLOYMENT_ID=$dep"
    echo "SCRIPT_ID=$sid"
    if [ -n "${GITHUB_OUTPUT:-}" ]; then
        {
          echo "deployment_id=$dep"
          echo "script_id=$sid"
        } >> "$GITHUB_OUTPUT"
    fi
}

case "${1:-}" in
    login)       shift; cmd_login "$@" ;;
    info)        shift; cmd_info "$@" ;;
    deployments) shift; cmd_deployments "$@" ;;
    pull)        shift; cmd_pull "$@" ;;
    resolve)     shift; cmd_resolve "$@" ;;
    *) sed -n '2,16p' "$0"; exit 1 ;;
esac
