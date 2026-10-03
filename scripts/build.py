#!/usr/bin/env python3
"""Build the reproducible Stash package and its Pages install source."""
from datetime import date
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugins" / "stash-minimal"


def build():
    metadata = json.loads((ROOT / "package.json").read_text())
    version = metadata["version"]
    release_date = date.fromisoformat(metadata["releaseDate"])
    if f"version: {version}\n" not in (PLUGIN / "stash-minimal.yml").read_text():
        raise RuntimeError("Package and manifest versions differ")
    output = ROOT / "dist"
    output.mkdir(exist_ok=True)
    archive = output / "stash-minimal.zip"
    files = {p.relative_to(PLUGIN).as_posix(): p for p in PLUGIN.rglob("*") if p.is_file()}
    files.update({name: ROOT / name for name in ["LICENSE", "README.md", "FONT_SOURCE.md", "DESIGN.md"]})
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as package:
        for name, path in sorted(files.items()):
            entry = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            package.writestr(entry, path.read_bytes())
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output / "index.yml").write_text(
        f"- id: stash-minimal\n  name: Stash Minimal\n  metadata:\n"
        f"    description: A quiet, compact dark theme inspired by Vercel Geist.\n"
        f"  version: {version}\n  date: {release_date} 00:00:00\n"
        f"  path: stash-minimal.zip\n  sha256: {digest}\n")
    (output / ".nojekyll").touch()
    (output / "index.html").write_text((ROOT / "site" / "index.html").read_text().replace("{{VERSION}}", version))
    shutil.copytree(ROOT / "site" / "assets", output / "assets", dirs_exist_ok=True)
    return {"version": version, "sha256": digest, "bytes": archive.stat().st_size}


if __name__ == "__main__":
    print(json.dumps(build()))
