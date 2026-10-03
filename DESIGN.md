# Interface reference

Stash Minimal uses the dark Vercel dashboard and [Geist design system](https://vercel.com/geist/introduction) as its visual reference. Measurements below were checked against the rendered dashboard, settings, project filter menu, and deployment list on October 2, 2026.

| Element | Reference | Stash implementation |
| --- | --- | --- |
| Page background | Black | `--minimal-bg: #000` |
| Panel and menu surface | `#0a0a0a` | `--minimal-surface` |
| Selected navigation and hover | `#1f1f1f` | `--minimal-hover` |
| Borders | Subtle neutral gray | `--minimal-border: #292929` |
| Text | `#ededed`, secondary `#a1a1a1` | Shared text tokens |
| Body and controls | Geist Sans, 14px | Local font and native controls |
| Buttons and inputs | 36px normal; 32px compact | Control height token and compact variants |
| Control corners | 6px | Shared radius |
| Popover | 12px corners; 6px inner padding; 32px rows | Native Bootstrap/React Select menus |
| Section titles | 24px/32px; 600 weight | Settings and task headings |
| Group titles | 20px/26px; 600 weight | Native setting groups |
| Settings rows | 20px padding; neutral separators | Native setting cards and descriptions |
| Interaction | 150ms color/background transition; visible keyboard focus | Buttons, menus, and scene scrubber |

Vercel's downloadable browser bundles use React/Next.js, shared design tokens, fieldset components, and data-driven hover/focus states. Stash already supplies React, routing, menus, forms, and playback. The theme patches native navigation and scene focus through the documented Plugin API and styles native components directly. It does not embed Vercel's application bundles or create another app runtime.

The native thumbnail scrubber keeps its markers, heatmap, dragging, and previous/next handlers. Its arrows use secondary styling even though Stash declares them as primary buttons. The task queue grows with its contents up to a bounded scroll height; an empty queue does not reserve a large blank area. Troubleshooting remains the native diagnostic dialog, displayed as an inline secondary action.

## Verification

The integration fixture runs Stash v0.31.1, installs the package through Stash's package manager, scans the public Sintel trailer, and generates actual sprite/VTT data. Chrome and WebKit checks cover native playback, thumbnail scrubber surfaces and hover, task queue layout, diagnostic dialog, settings headings, navigation, menus, keyboard focus, portrait layout, and reduced motion. Fixture captures contain only public film footage.

Account HTML and downloaded reference bundles are private research artifacts, excluded from the plugin and repository. Public style references: [colors](https://vercel.com/geist/colors), [typography](https://vercel.com/geist/typography), [materials](https://vercel.com/geist/materials), and [buttons](https://vercel.com/geist/button).
