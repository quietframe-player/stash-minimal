#!/usr/bin/env python3
"""Install and exercise the theme in an owned Stash container with public fixtures."""
import argparse
import functools
import hashlib
import http.server
import json
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
from build import build
from install import graphql, install

ROOT = Path(__file__).resolve().parents[1]
VIDEO = "https://media.w3.org/2010/05/sintel/trailer.mp4"
SHA256 = "b670602fa00934ca27c4351bb0efe7ea7a07fae57284e44226025eeed7c51254"
IMAGE = "stashapp/stash:v0.31.1@sha256:df744af5a0c976e2ec671052ecc1f8a9aa757fa12b8f9930b59910b7295f0da6"
CLI = ["npx", "--yes", "--package", "@playwright/cli@0.1.21", "playwright-cli"]


def command(args, **options):
    return subprocess.run(args, cwd=ROOT, check=True, text=True, **options)


def run(args):
    browsers = args.browser or ["chrome", "webkit"]
    if not args.apply:
        print(json.dumps({"mode": "preview", "scope": "owned isolated Docker only", "browsers": browsers, "fixture": VIDEO}))
        return
    token = uuid.uuid4().hex[:10]
    report = ROOT / ".tmp" / token
    config, media = report / "config", report / "media"
    media.mkdir(parents=True)
    for directory in ["generated/tmp", "cache", "metadata", "blobs", "plugins"]:
        (config / directory).mkdir(parents=True)
    cached = ROOT / ".cache" / "sintel.mp4"
    cached.parent.mkdir(exist_ok=True)
    if not cached.exists():
        with urllib.request.urlopen(VIDEO, timeout=60) as response:
            cached.write_bytes(response.read())
    if hashlib.sha256(cached.read_bytes()).hexdigest() != SHA256:
        raise RuntimeError("Public fixture checksum mismatch")
    shutil.copyfile(cached, media / "source.mp4")
    (config / "config.yml").write_text("""host: 0.0.0.0
port: 9999
database: /config/stash.sqlite
generated: /config/generated
cache: /config/cache
metadata: /config/metadata
blobs_path: /config/blobs
blobs_storage: FILESYSTEM
calculate_md5: false
video_file_naming_algorithm: OSHASH
parallel_tasks: 1
nobrowser: true
stash:
  - path: /media
plugins_path: /config/plugins
""")
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    container = "stash-minimal-test-" + token
    first = build()
    if build() != first:
        raise RuntimeError("Package build is not reproducible")
    server = http.server.ThreadingHTTPServer(("0.0.0.0", 0),
        functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / "dist")))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    source = f"http://host.docker.internal:{server.server_port}/index.yml"
    receipts, started = [], False
    try:
        host = ["--add-host", "host.docker.internal:host-gateway"] if sys.platform == "linux" else []
        command(["docker", "run", *host, "--detach", "--name", container,
                 "--label", "stash-minimal.test=true", "--publish", f"127.0.0.1:{port}:9999",
                 "--mount", f"type=bind,source={config},target=/config",
                 "--mount", f"type=bind,source={media},target=/media", IMAGE,
                 "stash", "--config", "/config/config.yml"], capture_output=True)
        started = True
        for _ in range(60):
            try:
                if graphql(base, "{systemStatus{status}}")['systemStatus']['status'] == 'OK':
                    break
            except (OSError, RuntimeError):
                pass
            time.sleep(1)
        else:
            raise RuntimeError("Owned Stash did not become ready")
        preview = install(base, source)
        if preview['mode'] != 'preview' or graphql(base, "{plugins{id}}")['plugins']:
            raise RuntimeError("Preview changed the plugin state")
        print(json.dumps(install(base, source, apply=True)), flush=True)
        print(json.dumps(install(base, source, apply=True)), flush=True)
        for index, start in enumerate([14, 26, 30, 32, 34, 36, 38, 40]):
            command(["docker", "exec", container, "ffmpeg", "-hide_banner", "-loglevel", "error",
                     "-ss", str(start), "-i", "/media/source.mp4", "-t", "8", "-c", "copy",
                     f"/media/sintel-{index}.mp4"])
        (media / "source.mp4").unlink()
        graphql(base, "mutation($input:ScanMetadataInput!){metadataScan(input:$input)}", {
            "input": {"paths": ["/media"], "scanGenerateCovers": True, "scanGenerateSprites": True,
                      "scanGeneratePreviews": False, "scanGeneratePhashes": False}})
        for _ in range(90):
            state = graphql(base, "{findScenes{count scenes{id files{path}}} jobQueue{id}}")
            if state['findScenes']['count'] == 8 and not state['jobQueue']:
                break
            time.sleep(1)
        else:
            raise RuntimeError("Fixture scan did not finish")
        tag = graphql(base, 'mutation{tagCreate(input:{name:"Short film"}){id}}')['tagCreate']['id']
        studio = graphql(base, 'mutation{studioCreate(input:{name:"Blender Foundation"}){id}}')['studioCreate']['id']
        names = ["The journey", "A moment of quiet", "Across the rooftops", "An unexpected friend",
                 "The village", "Through the mountains", "A new beginning", "Into the unknown"]
        for scene in state['findScenes']['scenes']:
            index = int(Path(scene['files'][0]['path']).stem.split('-')[-1])
            graphql(base, 'mutation($input:SceneUpdateInput!){sceneUpdate(input:$input){id}}', {
                'input': {'id': scene['id'], 'title': 'Sintel · ' + names[index], 'date': '2010-09-27',
                          'studio_id': studio, 'tag_ids': [tag]}})
        script = (ROOT / "tests" / "browser.js").read_text().replace("export default ", "", 1)
        for browser in browsers:
            session = 'stash-minimal-' + token + '-' + browser
            cli = CLI + ['-s=' + session]
            try:
                command(cli + ['open', 'about:blank', '--browser', browser], capture_output=True)
                options = {'baseURL': base, 'browser': browser, 'reportDir': str(report),
                           'sceneId': state['findScenes']['scenes'][0]['id']}
                run_browser = subprocess.run(cli + ['run-code', 'async page => (' + script + ')(page,' + json.dumps(options) + ')'],
                                             cwd=ROOT, text=True, capture_output=True)
                (report / (browser + '.log')).write_text(run_browser.stdout + run_browser.stderr)
                if run_browser.returncode or '### Result\n' not in run_browser.stdout:
                    raise RuntimeError('Browser runner failed: ' + str(report / (browser + '.log')))
                receipt = json.loads(run_browser.stdout.split('### Result\n', 1)[1].split('\n###', 1)[0])
                receipts.append(receipt)
                print(json.dumps(receipt), flush=True)
            finally:
                subprocess.run(cli + ['close'], cwd=ROOT, capture_output=True)
        (report / 'results.json').write_text(json.dumps(receipts, indent=2))
        if not all(receipt['passed'] for receipt in receipts):
            raise RuntimeError('Theme integration failed: ' + str(report))
        if args.update_screenshots:
            for name in ['library', 'mobile', 'detail', 'settings']:
                shutil.copyfile(report / (browsers[0] + '-' + name + '.png'), ROOT / 'site' / 'assets' / (name + '.png'))
        print('PASS: ' + str(report), flush=True)
    finally:
        server.shutdown()
        server.server_close()
        if started:
            logs = subprocess.run(['docker', 'logs', container], text=True, capture_output=True)
            (report / 'stash.log').write_text(logs.stdout + logs.stderr)
            command(['docker', 'rm', '--force', container], capture_output=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--update-screenshots', action='store_true')
    parser.add_argument('--browser', choices=['chrome', 'webkit'], action='append')
    run(parser.parse_args())
