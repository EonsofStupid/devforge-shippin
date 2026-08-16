# WebForge — build journal

WebForge is the Shippin web instance of DevForge (this Theia fork): the custom split
that lowers the barrier of entry to the IDE — full VS Code extension support, Clyffy
native in the AI chat framework, an SME-tailored arrangement, and (coming) in-app
browsing with a bundled headless engine. Internal name **WebForge**; DevForge remains
the local, platform-tied build.

Plan + mocks: https://claude.ai/code/artifact/0ec1b353-deb3-427a-9b8d-fdb02158c869
Architecture canon: `shippin-forge/docs/ARCHITECTURE.md`

---

## 2026-08-16

### W1 — Branded baseline · `356c5c28d`
New app package `examples/webforge` (name `webforge`, `applicationName: WebForge`),
carrying the full Theia AI suite, `@theia/mini-browser`, the Open VSX router wiring,
and first tailored preferences. Root scripts `build:webforge` / `start:webforge`.
`examples/browser` deliberately untouched at upstream parity — the brand lives only in
our package so Theia merges never fight identity.
**Receipt:** built, served, `<title>WebForge</title>`, "WebForge Welcome".

### W2 — Clyffy speaks · (config, no code)
AI features enabled and the **Claude Code** provider wired against a locally-installed
`@anthropic-ai/claude-agent-sdk` (`ai-features.claudeCode.executablePath` → the SDK's
`sdk.mjs`; the global npm dir is write-protected on this host, so a local prefix is
used). Subscription seat, **zero API keys** — Theia's own interstitial confirms the
philosophy: "Some agents (e.g. Claude Code) work without a provider."
**Receipt:** the ClaudeCode agent answered live in-chat — *"yes, I'm running inside
WebForge, integrated into its chat interface with access to your editor context and
workspace."* Built-in agent roster observed (Coder / Architect / Universal / AppTester
/ ClaudeCode) — where Clyffy's personas will slot in.

### W3 — Full extension support · (no code)
**Receipt:** Prettier v12.4.0 (esbenp, 8.6M installs) searched on Open VSX from inside
WebForge, installed in-UI, deployed by the backend in 1.9s, button flipped to
Uninstall.

### W4 — Clyffy's direct channels (the Act plane) · `3ddf73d44`, `58768f6d4`
New Theia extension **`@theia/webforge-channels`**:
- `POST /webforge/channel` — bearer-guarded by `WEBFORGE_CHANNEL_TOKEN`; **dark (503)
  when unset**, never open by default. Ops: `app.open`, `terminal.type`, `notify`,
  `guide.type`, `state.get`.
- Ops execute **visibly** in the live workbench (RPC → frontend executor). Terminal
  typing goes to a dedicated pane titled **Clyffy** (`useServerTitle: false`).
- **AGENTS.md seeding**: workspaces without one get the house rules planted on first
  layout (visible work, teach-as-you-go, boring canonical naming, ask-before-
  destructive, small verified steps) **plus the channel API documented for agents** —
  frontier AIs (Claude Code, Codex, Gemini) read the open convention natively.
  Created once, operator-owned, never overwritten.
- **Event tape**: every channel *act* (sensing excluded — reads are not acts) appends a
  **CloudEvents 1.0** row to `$WEBFORGE_DATA_DIR/events.jsonl` with the platform-scoped
  `source` (`$WEBFORGE_EVENT_SOURCE`, e.g. `io.shippin.webforge/jesse`). `GET
  /webforge/events` reads the tail. This is the canonical foldable transcript — the
  same envelope NATS/Zuul carry later.
**Receipts:** 401 without bearer; `app.open` confirmed by `state.get` (activeEditor
flips); `terminal.type` executed a real command visibly; tape row read back.

### W6 — Guided typing (the teaching mechanic) · `7cfde1e93`
`guide.type {command, note?, threshold?}`: the target command floats in an amber
dashed chip **above** the terminal (never inline; `aria-live`), Clyffy's note above it.
A capture-phase listener **observes** keystrokes (the pty receives them untouched):
correct prefix renders green+bold with a live %; **wrong keys are not counted and the
chip never turns red** (no shaming); backspace walks progress back. At the threshold
(**default 0.7**, per-op overridable) the system **meets the learner** — the remainder
auto-fills into the real terminal, the chip flips to "✓ completed — press Enter".
Outcomes ride the tape: `guide.shown` / `guide.completed` / `guide.abandoned`, where
**`typedRatio` records what the learner typed with their own hands** — the auto-fill
never inflates the ledger (bug caught by the live receipt, fixed same commit).
**Receipt:** `npm r` green at 45% mid-flight → 72% crossed → `dev` auto-filled → Enter
→ `guide.completed {command:"npm run dev"}` on the tape.

### W8 (first brick) — WebForge as a managed instance · (shippin-forge)
`webforge@.service` systemd template (per-instance env at
`/etc/devforge/webforge/<id>.env`: port, root, channel token, event source, data dir;
CPUWeight/MemoryMax under the instances slice). `webforge@jesse` enabled on :8102 with
`/workspace/warden-storage/projects` as its workspace. The nginx gateway now proxies
forge.shippin.ai to it; the Code-OSS-era `?folder=` redirect was removed (Theia opens
its workspace from the instance's `--root-dir`).
**Receipt:** unit active, `<title>WebForge</title>` on :8102, edge chain healthy
(unauthenticated → login 200, authenticated → WebForge).

### W9a — The Guided perspective (simplify by arrangement, not amputation)
Theia's `PerspectiveService` (`packages/core/src/browser/perspective-service.ts`) turns
out to be exactly the lever the barrier problem needs: view placements, primary views,
collapsed areas, per-perspective saved layouts — and an `activePerspectiveId` **context
key**, so menus/commands/views can be gated with `when` clauses instead of forking the
workbench. Nothing is deleted; the command palette still reaches everything.

New `webforge.guided` perspective
(`packages/webforge-channels/src/browser/webforge-guided-perspective.ts`): the work in the
centre, Clyffy on the right, explorer left but collapsed, bottom panel collapsed. The
terminal and the tree appear when a lesson opens them through the channels rather than as
a wall of chrome on boot. Reachable from **View → Switch Perspective (Experimental)**.

Also fixed here: a channel op against a tab that had gone away **hung forever** (the RPC
proxy outlives the tab and never rejects, so the whole channel wedged). Every op is now
bounded — a lapsed frontend answers **504** in 8s instead of hanging the caller. Found by
curling `state.get` with no tab open; it timed out at the client instead of answering.

The naming + guided-surface canon (Clyffy's address scheme, the competence ladder, the
art direction) lives in `shippin-forge/docs/CLYFFY-ORCHESTRATION.md`.

---

## Where it stands

Running at **forge.shippin.ai** (log in as usual). Working today: WebForge branding,
the AI chat with a Claude Code seat, Open VSX extensions, the channels (open files,
type in the Clyffy terminal, notify, read state), AGENTS.md house rules, the
CloudEvents tape, and guided typing.

## Next

- **W5** — chat overlay shell (hosts Jesse's chat webapp; `ExtractableWidget` +
  `SecondaryWindowHandler` pop-out/re-dock, route beacon).
- **W7** — browser-in-app: mini-browser + bundled Playwright engine, **skeleton+text as
  a first-class render mode** (decision D1 = Reading A).
- **W8 rest** — forgemaster mints WebForge instances per operator; session→instance
  routing at the gateway.
- **W9** — SME tailoring pass: the Clyffy walkthrough (Phosphor Flat art over the live
  workbench, each scene ending in a real act through the channels), the competence ladder
  (Watch / Guided / Assisted / Full), theme port, front door — needs D3 (public label),
  D4 (the arrangement), D5 (palette lineage), D6 (is Guided the default front door).
- Polish: name the default agent persona Clyffy; guided-typing threshold as a
  preference.
