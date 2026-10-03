# Stash Minimal

A quiet, compact dark theme for Stash, inspired by [Vercel Geist](https://vercel.com/geist/introduction).

Neutral surfaces, restrained borders, compact navigation, and locally bundled Geist Sans. Thumbnails carry the scene grid; menus, inputs, and dialogs keep clear boundaries. Stash's existing controls and keyboard shortcuts stay in place.

CSS only. No JavaScript, external font requests, or separate server.

![Scene grid](site/assets/library.png)
![Mobile library](site/assets/mobile.png)

## Install

Tested with Stash v0.31.1.

1. Open **Settings → Plugins → Available Plugins → Add Source**.
2. Name it **Stash Minimal** and use this source URL:

   ```text
   https://quietframe-player.github.io/stash-minimal/index.yml
   ```

3. Install **Stash Minimal**.
4. Disable other theme plugins and reload Stash. Other plugins can remain enabled.

To restore the previous appearance, disable Stash Minimal and re-enable your previous theme. Native Interface custom CSS still takes precedence; remove conflicting overrides there if needed.

For a scripted installation, preview first:

```sh
python3 -B scripts/install.py --url https://your-stash.example
```

Add `--apply` to install and enable. Add `--disable-theme Theme-ModernDark` to disable that installed theme in the same operation. Authentication uses `STASH_API_KEY` from the environment when required.

## Develop

Edit `plugins/stash-minimal/minimal.css`. Build the deterministic package and install source:

```sh
python3 -B scripts/build.py
```

Run real-Stash checks in Chrome and WebKit, including the scene grid, detail page, menus, settings, keyboard focus, and mobile layout:

```sh
python3 -B scripts/integration.py --apply
```

This starts and removes its own isolated Docker container. It uses a checksum-pinned public Sintel trailer; it never connects to your library. Pass `--update-screenshots` to refresh the documentation images from this fixture.

The theme is MIT licensed. Geist Sans is bundled under the SIL Open Font License; see [font provenance](FONT_SOURCE.md). Screenshot footage is [Sintel](https://durian.blender.org/), © Blender Foundation, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). This is an independent theme, unaffiliated with Vercel.
