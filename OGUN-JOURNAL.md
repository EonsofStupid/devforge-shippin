# Ogun — build journal

Ogun is the Shippin web instance of DevForge (this Theia fork): the custom split
that lowers the barrier of entry to the IDE — full VS Code extension support, Clyffy
native in the AI chat framework, an SME-tailored arrangement, and (coming) in-app
browsing with a bundled headless engine. Internal name **Ogun**; DevForge remains
the local, platform-tied build.

Plan + mocks: https://claude.ai/code/artifact/0ec1b353-deb3-427a-9b8d-fdb02158c869
Architecture canon: `shippin-forge/docs/ARCHITECTURE.md`

---

## 2026-08-16

### W1 — Branded baseline · `356c5c28d`
New app package `examples/ogun` (name `ogun`, `applicationName: Ogun`),
carrying the full Theia AI suite, `@ogun/mini-browser`, the Open VSX router wiring,
and first tailored preferences. Root scripts `build:ogun` / `start:ogun`.
`examples/browser` deliberately untouched at upstream parity — the brand lives only in
our package so Theia merges never fight identity.
**Receipt:** built, served, `<title>Ogun</title>`, "Ogun Welcome".

### W2 — Clyffy speaks · (config, no code)
AI features enabled and the **Claude Code** provider wired against a locally-installed
`@anthropic-ai/claude-agent-sdk` (`ai-features.claudeCode.executablePath` → the SDK's
`sdk.mjs`; the global npm dir is write-protected on this host, so a local prefix is
used). Subscription seat, **zero API keys** — Theia's own interstitial confirms the
philosophy: "Some agents (e.g. Claude Code) work without a provider."
**Receipt:** the ClaudeCode agent answered live in-chat — *"yes, I'm running inside
Ogun, integrated into its chat interface with access to your editor context and
workspace."* Built-in agent roster observed (Coder / Architect / Universal / AppTester
/ ClaudeCode) — where Clyffy's personas will slot in.

### W3 — Full extension support · (no code)
**Receipt:** Prettier v12.4.0 (esbenp, 8.6M installs) searched on Open VSX from inside
Ogun, installed in-UI, deployed by the backend in 1.9s, button flipped to
Uninstall.

### W4 — Clyffy's direct channels (the Act plane) · `3ddf73d44`, `58768f6d4`
New Theia extension **`@ogun/channels`**:
- `POST /ogun/channel` — bearer-guarded by `OGUN_CHANNEL_TOKEN`; **dark (503)
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
  **CloudEvents 1.0** row to `$OGUN_DATA_DIR/events.jsonl` with the platform-scoped
  `source` (`$OGUN_EVENT_SOURCE`, e.g. `io.shippin.ogun/jesse`). `GET
  /ogun/events` reads the tail. This is the canonical foldable transcript — the
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

### W8 (first brick) — Ogun as a managed instance · (shippin-forge)
`ogun@.service` systemd template (per-instance env at
`/etc/devforge/ogun/<id>.env`: port, root, channel token, event source, data dir;
CPUWeight/MemoryMax under the instances slice). `ogun@jesse` enabled on :8102 with
`/workspace/warden-storage/projects` as its workspace. The nginx gateway now proxies
forge.shippin.ai to it; the Code-OSS-era `?folder=` redirect was removed (Theia opens
its workspace from the instance's `--root-dir`).
**Receipt:** unit active, `<title>Ogun</title>` on :8102, edge chain healthy
(unauthenticated → login 200, authenticated → Ogun).

### W9a — The Guided perspective (simplify by arrangement, not amputation)
Theia's `PerspectiveService` (`packages/core/src/browser/perspective-service.ts`) turns
out to be exactly the lever the barrier problem needs: view placements, primary views,
collapsed areas, per-perspective saved layouts — and an `activePerspectiveId` **context
key**, so menus/commands/views can be gated with `when` clauses instead of forking the
workbench. Nothing is deleted; the command palette still reaches everything.

New `ogun.guided` perspective
(`packages/channels/src/browser/ogun-guided-perspective.ts`): the work in the
centre, Clyffy on the right, explorer left but collapsed, bottom panel collapsed. The
terminal and the tree appear when a lesson opens them through the channels rather than as
a wall of chrome on boot. Reachable from **View → Switch Perspective (Experimental)**.

Also fixed here: a channel op against a tab that had gone away **hung forever** (the RPC
proxy outlives the tab and never rejects, so the whole channel wedged). Every op is now
bounded — a lapsed frontend answers **504** in 8s instead of hanging the caller. Found by
curling `state.get` with no tab open; it timed out at the client instead of answering.

The naming + guided-surface canon (Clyffy's address scheme, the competence ladder, the
art direction) lives in `shippin-forge/docs/CLYFFY-ORCHESTRATION.md`.

### W9b — The Clyffy walkthrough, in Phosphor Flat
The mock made real. New in `@ogun/channels`:

- **`ogun-walkthrough-scenes.ts`** — five scenes drawn as inline SVG in the house
  art language. Every fill is a palette token (`--og-a1`…`--og-a6`), so switching
  lineage re-themes all the art with **no re-export and no animation runtime** (Lottie's
  player alone is ~250KB, and baked art can never be theme-aware). Three rules hold the
  style: vibrancy from `screen` overlap rather than a bigger palette; exactly **one
  focal plane** per scene with a hard-offset shadow and a 1px light edge; motion on the
  existing tokens — planes arrive staggered on the 120ms beat, the focal plane settles
  last, and `prefers-reduced-motion` gets the final frame.
- **`ogun-walkthrough.ts`** — the overlay. It is deliberately *not* a wizard in a
  box: when a scene performs its act the scrim drops and the card retreats to the
  corner, so the learner watches the **real** editor open the **real** file and the
  **real** terminal take the command. Acts: open the workspace's house rules
  (`AGENTS.md`, falling back to a README, then any file), guided-type `ls`, reveal
  Clyffy. Escape steps out without burning the tour; only the explicit exit marks it
  done and drops the operator into the full workbench.
- **First-run front door (D6 default-on)** — a new operator lands in `ogun.guided`
  with the walkthrough offered over it. Shown once, always re-openable from
  **Help → Guided Walkthrough**; `ogun.walkthrough.reset` offers it again.
- **Preferences** — `ogun.walkthrough.autoStart`, `ogun.walkthrough.lineage`
  (amber / green / chroma, live-swaps the open overlay), and
  `ogun.guidedTyping.threshold`, which the `guide.type` op now honours when the
  caller doesn't specify one. How much help feels like help is a personal setting.
- **Tape** — `walkthrough.started` / `.scene` / `.completed` / `.skipped` join the guide
  rows, so the competence ladder is measured rather than assumed.

### W10 — The engine: Theia becomes Ogun
Bolting features onto upstream was the wrong shape. New package
**`@ogun/runtime`** — the layer underneath the IDE that everything else stands
on. Nothing upstream had to be patched to get here; the hooks were already there.

- **Two layers, one application.** `ogun.layer` context key + `data-ogun-layer`
  on the document: **simplified** (larger type, lower density, machinery folded away) and
  **full** (nothing withheld). A presentation state, not two builds and not a feature
  gate — every command, view and setting is reachable in both, and any contribution can
  adapt with a `when` clause instead of forking. `ogun.layer.simplified` /
  `ogun.layer.full`; the move is recorded, because outgrowing the simplified layer is
  the signal the ladder is about.
- **Surfaces — everything addressable.** A surface is anything an operator can touch,
  with an address (`<kind>:<name>`) and declared capabilities (`read`/`set`/`type`/
  `focus`/`invoke`). Providers ship for settings (every preference in the app), commands,
  views, editors, terminals, and **live DOM inputs found by scanning what is actually on
  screen**. Clyffy finds the thing and uses it, as a person would — no bespoke op per
  feature. New ops: `surface.list` / `.read` / `.set` / `.focus` / `.invoke`.
- **Real typing** (`type.real`). Character by character at a human cadence, uneven on
  purpose, pausing longer after a space; the target wears a green marker so authorship of
  every keystroke is visible. Monaco-backed inputs (the chat prompt, every code editor)
  go through Monaco's own type command — writing into DOM another component owns is
  discarded at best and destructive at worst. In plain fields, if the operator takes the
  keyboard mid-phrase, Clyffy stops.
- **Provenance.** Every event carries who (`operator` / `clyffy/<scope>/<role>` /
  `channel/<caller>`) and what caused it (a chain id). Attribution is *scoped*, not
  threaded: work inside `bus.as(actor, …)` is attributed to that actor including acts
  raised deep inside Theia by it.
- **A declared event catalog.** 21 events across four planes (`act` / `sense` / `teach` /
  `state`), each with its meaning and fields, served at `GET /ogun/catalog`. Events
  are declared, not invented; an undeclared name is a warning we can see.
- **The workbench reports itself.** Opening a file by clicking and opening it through
  Clyffy produce the same event, differing only in provenance.
- **Vibe-coder defaults**: editor 15px/24px line height, terminal 14px, dark theme by
  default (the art and the workbench finally belong to the same world).

**Receipts (CI instance):** `surface.list` found settings with live values and the chat
prompt; `surface.set setting:editor.fontSize` applied and read back; `type.real` put
"what does this file do?" **visibly into the Monaco chat prompt**, character by character;
invoking one command recorded three rows under one chain and one actor. Tape discipline:
a boot that produced **696 rows dropped to 8** once derived settings and output plumbing
stopped being counted as acts — a session now reads as
`workbench.ready → layer → perspective → walkthrough → guide.shown(clyffy) →
guide.completed(operator, typedRatio 1) → surface.set(channel/http)`.

### W11 — Preview: the running thing, beside the code
Positioning made explicit: **Ogun is the tier-2 Lovable concept** — Lovable's barrier
of entry, with the real IDE underneath and an AI that can drive all of it. Under that
reading the preview is not a feature, it is half the product, so it landed next.

- **Preview proxy** (`ogun-preview-proxy.ts`). A dev server started in the operator's
  terminal listens on the *instance's* loopback; the operator's browser is on another
  machine, so `localhost:5173` in an iframe is the wrong computer. Ports are proxied
  through the session the gateway already authorized —
  `/ogun/preview/<port>/…` → `127.0.0.1:<port>` — including **WebSocket upgrades**,
  so hot reload survives. Without upgrades the preview is a screenshot; the point is that
  it is the running thing. Only plausible user-space loopback ports are reachable.
- **Dev-server detection** (`ogun-preview.ts`). Terminal output is watched for a
  served URL; the first one opens the preview automatically, split beside the code. A
  newcomer never learns what a dev server is or which port it chose — they run the project
  and the app appears.
- **Preview is a surface** (`preview:app`, capabilities read/set/focus/invoke), so Clyffy
  navigates and reloads it through the generic surface plane. **No new channel ops were
  needed for any of this** — which is the engine paying for itself.
- Catalog grew by declaration: `act.preview.opened`, `act.preview.navigated`,
  `state.devserver.detected`.

**Receipt (CI):** `terminal.type "cd site && python3 -m http.server 5199"` → tape shows
`act.terminal.typed(channel/http)` → `state.devserver.detected {port:5199}` →
`act.preview.opened` → the Preview tab renders the page through the proxy. Two bugs found
and fixed by that receipt: a greedy path capture swallowed python's closing paren
(`…:5199/)`), and an already-proxied URL was proxied a second time, nesting the instance's
own port inside the path.

---

## Where it stands

Running at **forge.shippin.ai** (log in as usual). Working today: Ogun branding,
the AI chat with a Claude Code seat, Open VSX extensions, the channels (open files,
type in the Clyffy terminal, notify, read state), AGENTS.md house rules, the
CloudEvents tape, and guided typing.

## Next

- **W5** — chat overlay shell (hosts Jesse's chat webapp; `ExtractableWidget` +
  `SecondaryWindowHandler` pop-out/re-dock, route beacon).
- **W7** — browser-in-app: mini-browser + bundled Playwright engine, **skeleton+text as
  a first-class render mode** (decision D1 = Reading A).
- **W8 rest** — forgemaster mints Ogun instances per operator; session→instance
  routing at the gateway.
- **W9** — SME tailoring pass: the Clyffy walkthrough (Phosphor Flat art over the live
  workbench, each scene ending in a real act through the channels), the competence ladder
  (Watch / Guided / Assisted / Full), theme port, front door — needs D3 (public label),
  D4 (the arrangement), D5 (palette lineage), D6 (is Guided the default front door).
- Polish: name the default agent persona Clyffy; guided-typing threshold as a
  preference.
