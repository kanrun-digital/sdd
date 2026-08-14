#!/usr/bin/env python3
"""Fail when skills/ or agents/ changed without a version bump.

`claude plugin update` gates on the version number in the manifest, not on the commit
sha. So a change that ships under an already-installed version is invisible: the CLI
reports «already at the latest version» and every installation keeps the old files.
That happened in this repo — the handoff-contract fix landed after 1.18.0 was already
installed and had to be re-released as 1.18.1.

The rule this enforces: a change to `skills/` or `agents/` carries its version bump in
the same push, not a later one.

    python3 scripts/check_version_bump.py [<base-ref>]

Base ref resolution, in order: the argument · `origin/main` when it differs from HEAD
(the pull-request case) · `HEAD~1` (the push-to-main case). The check skips itself —
loudly, never silently — when git is unavailable or no base can be resolved, so it is
safe to run in a shallow checkout or a tarball.

Escape hatch: a `No-Release:` trailer in any commit message in the range. Use it for a
change that genuinely cannot reach a user — a typo in a comment, a test fixture. It has
to name a reason, so the exemption is a decision on the record rather than a habit.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ".claude-plugin/plugin.json"
WATCHED = ("skills/", "agents/")


def git(*args: str) -> str | None:
    """Run a git command; None when git fails (missing ref, no repo, no git)."""
    try:
        out = subprocess.run(("git", "-C", str(ROOT)) + args,
                             capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return None
    return out.stdout.strip() if out.returncode == 0 else None


def skip(reason: str) -> int:
    print(f"  skip  version-bump check — {reason}")
    return 0


def resolve_base(argv: list[str]) -> str | None:
    if len(argv) > 1:
        return argv[1]
    head = git("rev-parse", "HEAD")
    origin = git("rev-parse", "origin/main")
    if origin and origin != head:
        return "origin/main"
    return "HEAD~1" if git("rev-parse", "HEAD~1") else None


def version_at(ref: str | None) -> str | None:
    """The manifest version at `ref`, or in the working tree when ref is None."""
    if ref is None:
        return json.loads((ROOT / MANIFEST).read_text()).get("version")
    blob = git("show", f"{ref}:{MANIFEST}")
    return json.loads(blob).get("version") if blob else None


def main(argv: list[str]) -> int:
    if git("rev-parse", "--git-dir") is None:
        return skip("not a git checkout (or git unavailable)")
    base = resolve_base(argv)
    if base is None:
        return skip("no base ref to compare against (shallow checkout or first commit)")
    if git("rev-parse", base) is None:
        print(f"  FAIL  base ref {base!r} does not resolve")
        return 1

    changed = git("diff", "--name-only", base, "--") or ""
    touched = sorted({p for p in changed.splitlines() if p.startswith(WATCHED)})
    if not touched:
        return skip(f"no skills/ or agents/ change since {base}")

    # An explicit, reasoned exemption anywhere in the range releases the requirement.
    log = git("log", f"{base}..HEAD", "--format=%B") or ""
    for line in log.splitlines():
        if line.strip().startswith("No-Release:") and line.split(":", 1)[1].strip():
            return skip(f"No-Release trailer present — {line.split(':', 1)[1].strip()}")

    old, new = version_at(base), version_at(None)
    if old is None:
        return skip(f"{MANIFEST} not readable at {base}")

    shown = ", ".join(touched[:5]) + (f" (+{len(touched) - 5} more)" if len(touched) > 5 else "")
    if old == new:
        print(f"  FAIL  {len(touched)} file(s) under skills/ or agents/ changed since {base}, "
              f"but the version is still {new}.")
        print(f"        changed: {shown}")
        print("        `claude plugin update` compares versions, not commits — shipping this "
              "under an already-installed")
        print("        version means every installation silently keeps the old files. Bump the "
              "version in all four")
        print("        manifests, or add a `No-Release: <reason>` trailer when the change cannot "
              "reach a user.")
        return 1

    print(f"  ok    skills/agents changed since {base} and the version moved {old} → {new} "
          f"({len(touched)} file(s): {shown})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
