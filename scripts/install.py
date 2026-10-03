#!/usr/bin/env python3
"""Install Stash Minimal; preview by default, mutate only with --apply."""
import argparse
import json
import os
import time
import urllib.error
import urllib.request

SOURCE = "https://quietframe-player.github.io/stash-minimal/index.yml"
PLUGIN = "stash-minimal"


def graphql(url, query, variables=None):
    headers = {"Content-Type": "application/json"}
    if os.environ.get("STASH_API_KEY"):
        headers["ApiKey"] = os.environ["STASH_API_KEY"]
    request = urllib.request.Request(url.rstrip("/") + "/graphql",
        data=json.dumps({"query": query, "variables": variables or {}}).encode(), headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Stash returned HTTP {error.code}: {error.read().decode()}") from error
    if result.get("errors"):
        raise RuntimeError(json.dumps(result["errors"]))
    return result["data"]


def install(url, source=SOURCE, apply=False, disable_themes=(), timeout=180):
    def api(query, variables=None):
        return graphql(url, query, variables)

    before = api("{plugins{id name enabled version} configuration{general{pluginPackageSources{name url local_path}}}}")
    sources = before["configuration"]["general"]["pluginPackageSources"]
    plugins = {p["id"]: p for p in before["plugins"] or []}
    for theme in disable_themes:
        if theme == PLUGIN or theme not in plugins:
            raise RuntimeError(f"Invalid existing theme id: {theme}")
    if not any(s["url"] == source for s in sources) and any(s["local_path"] == PLUGIN for s in sources):
        raise RuntimeError("Another package source already uses local path stash-minimal")
    if not apply:
        return {"mode": "preview", "url": url, "source": source, "disableThemes": list(disable_themes),
                "before": list(plugins.values())}
    if not any(s["url"] == source for s in sources):
        sources.append({"name": "Stash Minimal", "url": source, "local_path": PLUGIN})
        api("mutation($input:ConfigGeneralInput!){configureGeneral(input:$input){pluginPackageSources{url}}}",
            {"input": {"pluginPackageSources": sources}})
    job = api("mutation($packages:[PackageSpecInput!]!){installPackages(type:Plugin,packages:$packages)}",
              {"packages": [{"id": PLUGIN, "sourceURL": source}]})["installPackages"]
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not any(p["id"] == job for p in api("{jobQueue{id}}")["jobQueue"] or []):
            break
        time.sleep(1)
    else:
        raise RuntimeError(f"Installation job {job} did not finish")
    api("mutation{reloadPlugins}")
    packages = api("{installedPackages(type:Plugin){package_id sourceURL version}}")['installedPackages']
    package = next((p for p in packages if p["package_id"] == PLUGIN and p["sourceURL"] == source), None)
    if not package:
        raise RuntimeError("Stash did not install the package; existing themes remain enabled")
    enabled = {PLUGIN: True, **{theme: False for theme in disable_themes}}
    api("mutation($enabled:BoolMap!){setPluginsEnabled(enabledMap:$enabled)}", {"enabled": enabled})
    after = api("{plugins{id name enabled version}}")['plugins']
    by_id = {p["id"]: p for p in after}
    if any(by_id.get(key, {}).get("enabled") != value for key, value in enabled.items()):
        raise RuntimeError("Theme activation did not persist")
    if any(p["enabled"] != by_id.get(key, {}).get("enabled") for key, p in plugins.items() if key not in enabled):
        raise RuntimeError("An unrelated plugin changed state")
    return {"installed": True, "package": package, "plugins": after, "previousThemes": [plugins[t] for t in disable_themes]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--source", default=SOURCE)
    parser.add_argument("--disable-theme", action="append", default=[], metavar="PLUGIN_ID")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    print(json.dumps(install(args.url, args.source, args.apply, args.disable_theme), indent=2))
