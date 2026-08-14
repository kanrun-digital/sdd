#!/usr/bin/env bash
# SDD installer for Codex CLI and Cursor (Claude Code installs natively via /plugin).
#
# SKILL.md is the open Agent Skills format, so both tools run the repo's skills unchanged.
# The script copies the skills/ + agents/ subtree VERBATIM under <skills-root>/sdd/ (the
# relative cross-links between skills, _shared/ and agents/ keep resolving by construction),
# prefixes every skill name with `sdd-` (the bare review/design/api would collide with
# generic names), and generates the host tool's functional agents from agents/*.md.
# How each Claude-specific mechanism maps: skills/_shared/tool-adapters.md.
#
# Usage:
#   install.sh <codex|cursor|claude> [--global] [--prefix DIR] [--ref REF] [--src DIR] [--uninstall]
#
#   codex | cursor   target tool (claude just prints the native /plugin commands)
#   --global         install under $HOME instead of the current directory
#   --prefix DIR     install under DIR (overrides --global and $PWD; mainly for testing)
#   --ref REF        git ref of kanrun-digital/sdd to download (default: main)
#   --src DIR        install from a local checkout instead of downloading
#   --uninstall      remove a previous install from the chosen prefix and exit
#
# Dependencies: curl + tar (download mode); python3 only for Codex custom agents (optional —
# without it the skills still install and agent dispatch degrades to inline).

set -euo pipefail

REPO="kanrun-digital/sdd"

log()  { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
SDD installer for Codex CLI and Cursor (Claude Code installs natively via /plugin).

Usage:
  install.sh <codex|cursor|claude> [--global] [--prefix DIR] [--ref REF] [--src DIR] [--uninstall]

  codex | cursor   target tool (claude just prints the native /plugin commands)
  --global         install under $HOME instead of the current directory
  --prefix DIR     install under DIR (overrides --global and $PWD; mainly for testing)
  --ref REF        git ref of kanrun-digital/sdd to download (default: main)
  --src DIR        install from a local checkout instead of downloading
  --uninstall      remove a previous install from the chosen prefix and exit

Dependencies: curl + tar in download mode. Python 3 is optional; without it Codex skills
still install, but the generated custom agents are skipped and dispatch degrades to inline.
EOF
}

TOOL=""
PREFIX=""
GLOBAL=0
PREFIX_EXPLICIT=0
REF="main"
SRC=""
UNINSTALL=0

while [ $# -gt 0 ]; do
  case "$1" in
    codex|cursor|claude) TOOL="$1" ;;
    --global)    GLOBAL=1 ;;
    --prefix)
      [ "$#" -ge 2 ] || die "--prefix needs a directory"
      case "$2" in -*) die "--prefix needs a directory (use ./<name> for a path beginning with '-')" ;; esac
      shift; PREFIX="$1"; PREFIX_EXPLICIT=1
      ;;
    --ref)
      [ "$#" -ge 2 ] || die "--ref needs a git ref"
      case "$2" in -*) die "--ref needs a git ref (not another option)" ;; esac
      shift; REF="$1"
      ;;
    --src)
      [ "$#" -ge 2 ] || die "--src needs a directory"
      case "$2" in -*) die "--src needs a directory (use ./<name> for a path beginning with '-')" ;; esac
      shift; SRC="$1"
      ;;
    --uninstall) UNINSTALL=1 ;;
    -h|--help)   usage; exit 0 ;;
    *) usage; die "unknown argument: $1" ;;
  esac
  shift
done

[ -n "$TOOL" ] || { usage; die "missing target tool: codex | cursor | claude"; }

if [ "$TOOL" = "claude" ]; then
  cat <<'EOF'
SDD installs natively in Claude Code — run inside a Claude Code session:

  /plugin marketplace add kanrun-digital/sdd
  /plugin install sdd@sdd
EOF
  exit 0
fi

if [ -z "$PREFIX" ]; then
  if [ "$GLOBAL" = 1 ]; then PREFIX="$HOME"; else PREFIX="$PWD"; fi
fi

case "$TOOL" in
  codex)
    SKILLS_ROOT="$PREFIX/.agents/skills"
    if [ "$GLOBAL" = 1 ] && [ "$PREFIX_EXPLICIT" = 0 ] && [ -n "${CODEX_HOME:-}" ]; then
      AGENTS_DIR="$CODEX_HOME/agents"
    else
      AGENTS_DIR="$PREFIX/.codex/agents"
    fi
    ;;
  cursor) SKILLS_ROOT="$PREFIX/.cursor/skills"; AGENTS_DIR="$PREFIX/.cursor/agents" ;;
esac

# --- legacy flat layout (pre-v1.9.0 installs, or a hand-copied skills/ tree) ---------------
# Before the nested <skills-root>/sdd/skills/<name>/ layout there was a FLAT one: one
# <skills-root>/sdd-<name>/SKILL.md per skill, plus a <skills-root>/sdd-shared/ carrying
# skills/_shared. Those directories survive `rm -rf $SKILLS_ROOT/sdd` untouched, and because
# they declare the same frontmatter names as the fresh install the host tool discovers every
# skill TWICE — half the copies stale. So remove them too, but ONLY the ones we can prove are
# ours; a user skill that happens to start with `sdd-` must never be collateral.
#   proof of ownership, either:
#     sdd-<name>/SKILL.md whose FRONTMATTER `name:` starts with `sdd-`   → an installed skill
#     sdd-shared/ holding a file from skills/_shared                     → the shared bundle
# Anything else under sdd-* is left in place and reported (warn, never fail): we cannot
# attribute it, and deleting a directory on a guess is worse than a duplicate skill entry.
LEGACY_SHARED_MARKERS=(tool-adapters.md agent-roster.md skill-context.md self-check.md handoff.md)

legacy_is_ours() { # $1 = candidate directory; exit 0 only when provably an sdd artifact
  local dir="$1" marker
  if [ -f "$dir/SKILL.md" ]; then
    # `name:` must live in the frontmatter block — stop at the closing `---` so a `name: sdd-…`
    # quoted somewhere in the body cannot pass as ownership
    if awk 'NR==1 { if ($0 != "---") exit; next }
            $0 == "---" { exit }
            /^name:[[:space:]]*sdd-/ { ok = 1; exit }
            END { exit ok ? 0 : 1 }' "$dir/SKILL.md"; then
      return 0
    fi
    return 1
  fi
  if [ "$(basename "$dir")" = "sdd-shared" ]; then
    for marker in "${LEGACY_SHARED_MARKERS[@]}"; do
      if [ -f "$dir/$marker" ]; then return 0; fi
    done
  fi
  return 1
}

clean_legacy_flat_layout() {
  local dir removed=0 unknown=""
  for dir in "$SKILLS_ROOT"/sdd-*; do
    [ -d "$dir" ] || continue   # no match → the glob stays literal; a stray file → not ours
    if legacy_is_ours "$dir"; then
      rm -rf "${dir:?}"
      removed=$((removed + 1))
    else
      unknown="$unknown $(basename "$dir")"
    fi
  done
  if [ "$removed" -gt 0 ]; then
    log "removed ${removed} legacy flat sdd-* skill dir(s) from $SKILLS_ROOT (pre-v1.9.0 layout — they would have doubled every skill)"
  fi
  if [ -n "$unknown" ]; then
    warn "left untouched under $SKILLS_ROOT (sdd-* but not recognisable as an sdd install):$unknown — if these are stale sdd copies, remove them by hand"
  fi
}

if [ "$UNINSTALL" = 1 ]; then
  rm -rf "${SKILLS_ROOT:?}/sdd"
  if [ -d "$SKILLS_ROOT" ]; then clean_legacy_flat_layout; fi
  rm -f "$AGENTS_DIR"/sdd-*.toml "$AGENTS_DIR"/sdd-*.md
  log "uninstalled sdd from $PREFIX ($TOOL)"
  exit 0
fi

# --- resolve the source tree -------------------------------------------------------------
DOWNLOAD_DIR=""
STAGE_DIR=""
SWAP_STARTED=0
INSTALL_DONE=0
cleanup() {
  local status=$? old_agent
  trap - EXIT
  set +e
  if [ "$INSTALL_DONE" != 1 ] && [ "$SWAP_STARTED" = 1 ]; then
    warn "install failed after replacement started — restoring the previous SDD install"
    rm -rf "${SKILLS_ROOT:?}/sdd"
    rm -f "$AGENTS_DIR"/sdd-*.toml "$AGENTS_DIR"/sdd-*.md
    if [ -d "$STAGE_DIR/backup/sdd" ]; then
      mkdir -p "$SKILLS_ROOT"
      cp -R "$STAGE_DIR/backup/sdd" "$SKILLS_ROOT/sdd"
    fi
    if [ -d "$STAGE_DIR/backup/agents" ]; then
      mkdir -p "$AGENTS_DIR"
      for old_agent in "$STAGE_DIR"/backup/agents/sdd-*; do
        [ -f "$old_agent" ] || continue
        cp -p "$old_agent" "$AGENTS_DIR/"
      done
    fi
  fi
  if [ -n "$STAGE_DIR" ]; then rm -rf "$STAGE_DIR"; fi
  if [ -n "$DOWNLOAD_DIR" ]; then rm -rf "$DOWNLOAD_DIR"; fi
  exit "$status"
}
trap cleanup EXIT

if [ -z "$SRC" ]; then
  command -v curl >/dev/null 2>&1 || die "curl is required to download $REPO"
  command -v tar  >/dev/null 2>&1 || die "tar is required to unpack $REPO"
  DOWNLOAD_DIR="$(mktemp -d)"
  log "downloading ${REPO}@${REF} …"
  curl -fsSL "https://codeload.github.com/${REPO}/tar.gz/${REF}" \
    | tar -xz --strip-components=1 -C "$DOWNLOAD_DIR" \
    || die "download/unpack of ${REPO}@${REF} failed — check the ref exists (e.g. --ref main, a branch, or a commit SHA) and your network"
  SRC="$DOWNLOAD_DIR"
fi

[ -f "$SRC/skills/specify/SKILL.md" ] \
  || die "source $SRC does not look like the sdd repo (skills/specify/SKILL.md missing)"

# --- collision check: a marketplace install would list every skill twice ------------------
# `codex plugin marketplace add` registers the ORIGINAL names ($specify); this script installs
# the sdd- prefixed copies. Both at once → a doubled skill list. Warn, don't block (README:
# "pick one of the two paths").
CODEX_CONFIG="${CODEX_HOME:-$HOME/.codex}/config.toml"
if [ "$TOOL" = "codex" ] && [ -f "$CODEX_CONFIG" ] \
   && grep -q 'plugins."sdd@' "$CODEX_CONFIG" 2>/dev/null; then
  warn "a marketplace install of sdd is already registered in $CODEX_CONFIG — adding the script install too will list each skill twice (\$specify AND \$sdd-specify); pick one path (see README), or remove the marketplace plugin"
fi

# Build and validate the replacement away from the live install. Only after the complete
# skills tree + generated agents exist do we swap them in. A bad ref, missing source, failed
# rename, or malformed agent therefore leaves the previously working install untouched.
mkdir -p "$PREFIX"
STAGE_DIR="$(mktemp -d "$PREFIX/.sdd-install.XXXXXX")"
STAGED_SDD="$STAGE_DIR/new-sdd"
STAGED_AGENTS="$STAGE_DIR/new-agents"
mkdir -p "$STAGED_SDD" "$STAGED_AGENTS"
cp -R "$SRC/skills" "$STAGED_SDD/skills"
cp -R "$SRC/agents" "$STAGED_SDD/agents"

# --- dashboard payload --------------------------------------------------------------------
# The read half of the dashboard never needed Claude: the server reads docs/ off disk. Only
# the DRIVE half was host-specific, and that now lives behind server/driver.ts (Claude
# channel · codex exec · codex app-server · copy-to-clipboard). So ship it here too and let
# the driver decide what a click can do. It rides the same staged swap + rollback as skills/,
# and costs nothing until the user opts in with dashboard_enabled + registers the MCP server.
DASHBOARD_SHIPPED=0
if [ -d "$SRC/server" ] && [ -d "$SRC/dashboard" ]; then
  cp -R "$SRC/server" "$STAGED_SDD/server"
  cp -R "$SRC/dashboard" "$STAGED_SDD/dashboard"
  # node_modules from a dev checkout must never travel — `bun run start` installs on boot.
  rm -rf "$STAGED_SDD/server/node_modules"
  DASHBOARD_SHIPPED=1
fi

# --- rename pass: frontmatter `name: <base>` → `name: sdd-<base>` ------------------------
# The repo validator guarantees the exact line `name: <dirname>` AND that every skill dir name
# matches [a-z0-9-]+ (no BRE metacharacters), so interpolating $base into the sed pattern is
# safe on both GNU and BSD sed. A new skill with ./_+ etc. in its dir name would break this —
# the validator rejects it first.
n_skills=0
for skill_md in "$STAGED_SDD"/skills/*/SKILL.md; do
  base="$(basename "$(dirname "$skill_md")")"
  tmp="${skill_md}.tmp"
  sed "s/^name: ${base}\$/name: sdd-${base}/" "$skill_md" > "$tmp"
  grep -q "^name: sdd-${base}\$" "$tmp" \
    || die "rename failed for $skill_md (expected the exact line 'name: ${base}')"
  mv "$tmp" "$skill_md"
  n_skills=$((n_skills + 1))
done

# --- functional agents per tool -----------------------------------------------------------
# (the verbatim copies under sdd/agents/ stay as documentation the skills cross-link)
n_agents=0

if [ "$TOOL" = "cursor" ]; then
  for agent_md in "$SRC"/agents/*.md; do
    n="$(basename "$agent_md" .md)"
    out="$STAGED_AGENTS/sdd-${n}.md"
    # rewrite two frontmatter lines only: the name (prefix) and the model (host-agnostic)
    sed -e "1,/^---\$/ s/^name: ${n}\$/name: sdd-${n}/" \
        -e "1,/^---\$/ s/^model: .*/model: inherit/" \
        "$agent_md" > "$out"
    grep -q "^name: sdd-${n}\$" "$out" \
      || die "agent rewrite failed for $agent_md (expected the exact line 'name: ${n}')"
    n_agents=$((n_agents + 1))
  done
else # codex: generate .codex/agents/sdd-<name>.toml (needs python3 — folded YAML description)
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$SRC/agents" "$STAGED_AGENTS" <<'PYEOF'
import functools
import json
import sys
from pathlib import Path

dumps = functools.partial(json.dumps, ensure_ascii=False)
codex_efforts = {"low", "medium", "high", "xhigh", "max", "ultra"}
src, dst = Path(sys.argv[1]), Path(sys.argv[2])
for md in sorted(src.glob("*.md")):
    text = md.read_text(encoding="utf-8")
    if not text.startswith("---"):
        sys.exit(f"{md}: no frontmatter")
    end = text.find("\n---", 3)
    block = text[3:end].strip("\n")
    body = text[end + 4 :].lstrip("\n")

    # parse the scalar keys + the folded `description: >` block (no yaml module in stdlib)
    fm, desc_lines, in_desc = {}, [], False
    for line in block.splitlines():
        if in_desc:
            if line.startswith((" ", "\t")):
                desc_lines.append(line.strip())
                continue
            in_desc = False
        if ":" in line and not line.startswith((" ", "\t")):
            key, _, val = line.partition(":")
            key, val = key.strip(), val.strip()
            if key == "description" and val in (">", "|", ">-", "|-"):
                in_desc = True
            else:
                fm[key] = val

    desc = fm.get("description") or " ".join(desc_lines)
    name = "sdd-" + fm["name"]
    tools = fm.get("tools", "")
    writes = any(t.strip() in ("Write", "Edit") for t in tools.split(","))
    sandbox = "workspace-write" if writes else "read-only"
    effort = fm.get("effort")
    if effort not in codex_efforts:
        sys.exit(f"{md}: effort {effort!r} is not a Codex model_reasoning_effort")

    if not body.endswith("\n"):
        body += "\n"
    if "'''" in body:  # can't hold a TOML literal multi-line string — escape via JSON form
        instructions = "developer_instructions = " + dumps(body)
    else:
        instructions = "developer_instructions = '''\n" + body + "'''"

    toml = (
        f"name = {dumps(name)}\n"
        f"description = {dumps(desc)}\n"
        f"model_reasoning_effort = {dumps(effort)}\n"
        f"sandbox_mode = {dumps(sandbox)}\n"
        f"{instructions}\n"
    )
    (dst / f"{name}.toml").write_text(toml, encoding="utf-8")
    print(f"  agent {name}.toml")
PYEOF
    n_agents="$(find "$STAGED_AGENTS" -name 'sdd-*.toml' | wc -l | tr -dc '0-9')"
  else
    warn "python3 not found — skipping Codex custom agents; skills install anyway and agent dispatch degrades to inline (see sdd/skills/_shared/agent-roster.md)"
  fi
fi

# --- transactional replacement -------------------------------------------------------------
# Copy the previous live files into the staging area first. If any later command fails, the EXIT
# trap restores these copies. This makes an update converge to either the old complete install or
# the new complete install — never an empty/half-written one.
mkdir -p "$STAGE_DIR/backup/agents"
if [ -d "$SKILLS_ROOT/sdd" ]; then
  cp -R "$SKILLS_ROOT/sdd" "$STAGE_DIR/backup/sdd"
fi
for old_agent in "$AGENTS_DIR"/sdd-*.toml "$AGENTS_DIR"/sdd-*.md; do
  [ -f "$old_agent" ] || continue
  cp -p "$old_agent" "$STAGE_DIR/backup/agents/"
done

mkdir -p "$SKILLS_ROOT" "$AGENTS_DIR"
SWAP_STARTED=1
rm -rf "${SKILLS_ROOT:?}/sdd"
rm -f "$AGENTS_DIR"/sdd-*.toml "$AGENTS_DIR"/sdd-*.md
mv "$STAGED_SDD" "$SKILLS_ROOT/sdd"
for new_agent in "$STAGED_AGENTS"/sdd-*; do
  [ -f "$new_agent" ] || continue
  mv "$new_agent" "$AGENTS_DIR/"
done
if [ -d "$SKILLS_ROOT" ]; then clean_legacy_flat_layout; fi

# --- summary -------------------------------------------------------------------------------
INSTALL_DONE=1
log ""
log "installed sdd ($TOOL):"
log "  skills  → $SKILLS_ROOT/sdd  (${n_skills} skills)"
if [ "$n_agents" -gt 0 ]; then
  log "  agents  → $AGENTS_DIR  (${n_agents} agents, sdd-* prefixed)"
fi
case "$TOOL" in
  codex)  log "  invoke  → type \$sdd-… in codex, e.g. \$sdd-specify <slug>" ;;
  cursor) log "  invoke  → type / in the chat and pick sdd-…, e.g. sdd-specify" ;;
esac
if [ "$DASHBOARD_SHIPPED" = 1 ]; then
  log "  dashboard → $SKILLS_ROOT/sdd/server  (opt-in; needs Bun)"
  log "              1. dashboard_enabled: true in <project>/.claude/sdd.local.md"
  # Registering an MCP server rewrites host config — the installer prints it, never does it.
  case "$TOOL" in
    codex)
      log "              2. codex mcp add sdd-dashboard -- bun run --cwd $SKILLS_ROOT/sdd/server --silent start"
      log "              3. drive: \`codex\` on PATH → each click runs a headless \`codex exec\`."
      log "                 Set dashboard_drive: copy for a read-only panel that copies the command instead."
      ;;
    cursor)
      log "              2. add to .cursor/mcp.json:"
      log "                 \"sdd-dashboard\": { \"command\": \"bun\", \"args\": [\"run\",\"--cwd\",\"$SKILLS_ROOT/sdd/server\",\"--silent\",\"start\"] }"
      log "              3. drive: Cursor exposes no control surface — the panel is read-only and"
      log "                 Run buttons copy the \$sdd-… command to your clipboard."
      ;;
  esac
fi
log "  mapping → $SKILLS_ROOT/sdd/skills/_shared/tool-adapters.md"
log "  update  → re-run with the same scope; replacement is staged and rolled back on failure"
log "  remove  → re-run with --uninstall and the same --global / --prefix scope (and CODEX_HOME)"
