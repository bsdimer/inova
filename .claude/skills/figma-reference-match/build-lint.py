#!/Library/Developer/CommandLineTools/usr/bin/python3
"""Builds the frame-lint code for use_figma.

Usage:
  build-lint.py 2129:46730 2129:47116 ...   > lint.js

The Avoid words come from docs/glossary.md on origin/develop, the exceptions
from allow.json next to this file. Prints the finished code; pass it to
use_figma as is.
"""
import json
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).parent
REPO = HERE.parents[2]


def git_show(ref_path):
    r = subprocess.run(["git", "-C", str(REPO), "show", ref_path], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def glossary_text():
    subprocess.run(["git", "-C", str(REPO), "fetch", "-q", "origin"], capture_output=True)
    # TODO: drop the chore/glossary fallback once PR #36 is merged into develop.
    for ref in ("origin/develop:docs/glossary.md", "origin/chore/glossary:docs/glossary.md"):
        t = git_show(ref)
        if t:
            return t, ref
    return git_show("origin/develop:docs/design.md") or "", "origin/develop:docs/design.md"


def avoid_words(text):
    out = []
    entry = ""
    for block in re.split(r"\n(?=- \*\*)", text):
        m = re.match(r"- \*\*(.+?)\*\*", block)
        if m:
            entry = m.group(1)
        flat = " ".join(block.split())
        for av in re.findall(r"Avoid:(.*?)(?:Source:|$)", flat):
            # the list itself: no parenthesised exceptions, nothing after the first full stop
            av = re.sub(r"\([^)]*\)", "", av).split(". ")[0]
            for w in re.findall(r"«([^»]+)»", av):
                w = w.strip().rstrip("…").strip()
                if len(w) >= 3:
                    out.append({"word": re.escape(w), "entry": entry})
    seen, uniq = set(), []
    for a in out:
        if a["word"].lower() not in seen:
            seen.add(a["word"].lower())
            uniq.append(a)
    return uniq


def main():
    ids = sys.argv[1:]
    if not ids:
        sys.exit("frame ids are required")
    text, ref = glossary_text()
    allow = json.loads((HERE / "allow.json").read_text())
    code = (HERE / "lint-frame.js").read_text()
    code = code.replace("__FRAME_IDS__", json.dumps(ids))
    code = code.replace("__AVOID__", json.dumps(avoid_words(text), ensure_ascii=False))
    code = code.replace("__ALLOW__", json.dumps(allow, ensure_ascii=False))
    sys.stderr.write(f"Avoid from {ref}: {len(avoid_words(text))} words, {len(allow)} exceptions\n")
    print(code)


main()
