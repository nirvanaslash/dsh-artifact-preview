# dsh-artifact-preview

[English](README.md) · [中文](README.zh-CN.md)

Codex-style artifact preview for **DeepSeek Harness (DSH)**.

`dsh-artifact-preview` is a client plugin (`dsh.client.platform: "web"`) that makes produced files visible and inspectable right in the chat:

- **Produced-files row in chat** — after the agent writes files, the closing message shows a "产物" row with file chips **and inline image thumbnails**; clicking any of them opens the side preview.
- **Split-screen side preview panel** — a resizable right-hand panel (real split, conversation stays visible and unobstructed) rendering:
  - **Markdown** → rich text (headings, tables, lists, code fences, links, images; relative local images resolve automatically)
  - **Source code** (`.py .js .ts .sh .css …`) → dark syntax highlighting
  - **CSV** → HTML table
  - **JSON** → collapsible tree
  - **Images** (`.png .jpg .gif .webp .svg …`) → checkerboard-backed centered view
  - **HTML / localhost ports** → iframe (with port chips for dev servers, URL bar, back/forward/reload, open-external)
- Global hooks (`window.__dshOpenFilePreview` / `__dshCanPreviewPath`) so other plugins can route "open file" intents into the preview panel.

## Install

From the DSH web **Settings → Plugins → Marketplace** (search `dsh-artifact-preview`), or via CLI:

```sh
dsh plugin --profile web add dsh-artifact-preview
```

Restart the `dsh web` service (or DSH Desktop) and refresh the page.

## Prerequisites

- DSH Desktop (or a `dsh web` profile that has the `dsh-file-changes` companion installed) — the preview fetches file content through its `/dsh-files/static/<absolute-path>` route. On DSH Desktop this route is built in; on a bare `dsh web` install add the `dsh-file-changes` companion first.
- A model that produces files via `write`/`edit`-style tools (that is how a turn's "produced files" are tracked).

## Compatibility

- Built for DSH `0.1.0-rc.6` client plugin ABI (`window.__ModuleLoader__` module, `dsh.client` metadata, `conversation.chat.turnTail` chain slot). Chain-slot election relies on low `priority` (`-100`) to win the produced-files row; verify behavior after DSH upgrades.

## Known boundaries

- The chat row and preview panel are fully self-contained in this package.
- Two optional behaviors are **not** bundled because they require patching DSH core files (intentionally left out of a public package): multi-type preview buttons in the file view, and "open → preview" for file-name mentions inside message prose. Without them, file-view preview keeps DSH's original HTML-only behavior and prose mentions open with the system app.

## License

MIT
