import subprocess, os
from datetime import date

REPO = subprocess.check_output(
    ["git", "rev-parse", "--show-toplevel"], cwd=os.path.dirname(os.path.abspath(__file__))
).decode().strip()
COLLAPSE_THRESHOLD = 20
ASSET_EXT_RATIO = 0.7
ASSET_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".bmp", ".tiff",
    ".wt", ".bson", ".turtle", ".lock",
    ".ttf", ".woff", ".woff2", ".eot", ".otf",
    ".mp3", ".wav", ".mp4", ".mov", ".avi",
    ".pdf", ".zip", ".gz", ".dat", ".xml",
}

files = subprocess.check_output(
    ["git", "-c", "core.quotePath=false", "ls-files", "--cached", "--others", "--exclude-standard"],
    cwd=REPO
).decode().splitlines()
files.sort()

tree = {}
for f in files:
    parts = f.split("/")
    node = tree
    for p in parts[:-1]:
        node = node.setdefault(p, {})
    node.setdefault(None, []).append(parts[-1])

lines = []

def count_files(n):
    c = len(n.get(None, []))
    for k, v in n.items():
        if k is not None:
            c += count_files(v)
    return c

def is_asset_heavy(leaf_files, dir_path):
    if "vendor" in dir_path.split("/"):
        return True
    if not leaf_files:
        return False
    asset_count = sum(1 for f in leaf_files if os.path.splitext(f)[1].lower() in ASSET_EXTS)
    return (asset_count / len(leaf_files)) >= ASSET_EXT_RATIO

def render(node, prefix, dir_path=""):
    dirs = sorted(k for k in node.keys() if k is not None)
    leaf_files = sorted(node.get(None, []))

    # collapse this directory's own leaf files when there are too many AND
    # they're predominantly generated/binary assets -- never collapse a
    # source-heavy directory (e.g. routes/api, views) just for file count.
    collapse_leaves = len(leaf_files) > COLLAPSE_THRESHOLD and is_asset_heavy(leaf_files, dir_path)

    entries = [("dir", d) for d in dirs]
    if leaf_files and not collapse_leaves:
        entries += [("file", f) for f in leaf_files]
    if collapse_leaves:
        entries += [("collapsed", leaf_files)]

    n = len(entries)
    for i, (kind, name) in enumerate(entries):
        is_last = (i == n - 1)
        connector = "└── " if is_last else "├── "
        child_prefix = prefix + ("    " if is_last else "│   ")
        if kind == "dir":
            sub = node[name]
            lines.append(f"{prefix}{connector}{name}/")
            render(sub, child_prefix, f"{dir_path}/{name}" if dir_path else name)
        elif kind == "file":
            lines.append(f"{prefix}{connector}{name}")
        else:
            exts = sorted(set(os.path.splitext(f)[1] for f in name if os.path.splitext(f)[1]))
            ext_str = ", ".join(exts[:6]) if exts else "no extension"
            lines.append(f"{prefix}{connector}[{len(name)} files - {ext_str}, listing omitted]")

render(tree, "")

header = f"""# RCJ Rescue CMS Project Tree

Generated: {date.today().isoformat()}

This tree is intended as context for future coding tasks (finding paths quickly).
It is derived from `git ls-files --cached --others --exclude-standard`, so anything
matched by `.gitignore` (node_modules, cabinet/, backup/, documents/, tmp/, logs/,
public/components, fonts/, etc.) is excluded automatically -- regenerate the same
way to keep this in sync with .gitignore.

A directory's file listing is collapsed to a `[N files - extensions]` summary line
when it has more than {COLLAPSE_THRESHOLD} files AND those files are predominantly
generated/binary assets (images, fonts, db files, vendor bundles) -- source-heavy
directories (routes, views, js, etc.) are always listed in full regardless of size.

```text
.
"""
footer = "```\n"

out = header + "\n".join(lines) + "\n" + footer

path = os.path.join(REPO, ".claude/skills/rcj-rescue-cms/PROJECT_TREE.md")
with open(path, "w") as fh:
    fh.write(out)

print("wrote", path)
print("total lines:", out.count("\n"))
