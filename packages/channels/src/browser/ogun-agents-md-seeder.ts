// *****************************************************************************
// Copyright (C) 2026 Shippin.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { MessageService } from '@ogun/core';
import { FrontendApplicationContribution } from '@ogun/core/lib/browser';
import { inject, injectable } from '@ogun/core/shared/inversify';
import { FileService } from '@ogun/filesystem/lib/browser/file-service';
import { BinaryBuffer } from '@ogun/core/lib/common/buffer';
import { WorkspaceService } from '@ogun/workspace/lib/browser';

/**
 * Seeds a Ogun AGENTS.md into workspaces that lack one — the open convention
 * (agents.md) that frontier AIs (Claude Code, Codex, Gemini, …) read natively, so
 * every seat working in this workspace follows the same house rules as Clyffy.
 * Created once, owned by the operator thereafter (never overwritten).
 */
@injectable()
export class OgunAgentsMdSeeder implements FrontendApplicationContribution {

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    async onDidInitializeLayout(): Promise<void> {
        try {
            const roots = await this.workspaceService.roots;
            const root = roots[0];
            if (!root) {
                return;
            }
            const target = root.resource.resolve('AGENTS.md');
            const existing = await this.fileService.exists(target)
                ? (await this.fileService.read(target)).value
                : undefined;
            const verdict = this.judge(existing);
            if (verdict === 'leave') {
                return;
            }
            if (verdict === 'backup') {
                // Unstamped means we cannot prove we wrote it, so it is never overwritten
                // in place — it is set aside first, under a name the operator will find.
                await this.fileService.copy(target, root.resource.resolve('AGENTS.md.bak'), { overwrite: true });
            }
            await this.fileService.createFile(target, BinaryBuffer.fromString(AGENTS_MD_TEMPLATE), { overwrite: true });
            this.messageService.info(this.explain(verdict), { timeout: 9000 })
                .then(undefined, () => { /* dismissed */ });
        } catch {
            // Seeding is a courtesy, never a failure mode.
        }
    }

    /**
     * May we rewrite this file, and how carefully?
     *
     * AGENTS.md is what Clyffy reads as its house rules, so a copy describing routes that
     * have since moved does not merely look dated — it sends the assistant at endpoints
     * that answer 404. That makes refreshing it a correctness fix. It is still someone
     * else's file, though, so the answer depends on how sure we are that we wrote it:
     *
     * - a current stamp: nothing to do.
     * - an older stamp: ours, and out of date. Replace it.
     * - no stamp but it names a route we have retired: it predates stamping, so it is
     *   probably ours — but 'probably' does not earn an overwrite. Copy it aside first.
     * - anything else: the operator's. Leave it completely alone, even though that means
     *   a file they edited keeps stale routes. That is the right way round; we do not get
     *   to edit their writing to fix our own rename.
     */
    protected judge(content: string | undefined): SeedVerdict {
        if (content === undefined) {
            return 'create';
        }
        const stamp = AGENTS_MD_STAMP_PATTERN.exec(content);
        if (stamp) {
            return Number(stamp.groups?.version) < AGENTS_MD_VERSION ? 'refresh' : 'leave';
        }
        return RETIRED_ROUTE_PATTERN.test(content) ? 'backup' : 'leave';
    }

    protected explain(verdict: SeedVerdict): string {
        switch (verdict) {
            case 'backup':
                return 'Refreshed AGENTS.md — it pointed at endpoints that have since moved. Your previous copy is saved as AGENTS.md.bak.';
            case 'refresh':
                return 'Refreshed AGENTS.md — it pointed at endpoints that have since moved. Yours to edit.';
            default:
                return 'Added AGENTS.md — the house rules every AI working in this workspace follows. Yours to edit.';
        }
    }
}

type SeedVerdict = 'create' | 'refresh' | 'backup' | 'leave';

/** Routes this fork used to serve and no longer does; naming one dates a file exactly. */
const RETIRED_ROUTE_PATTERN = /\/webforge\/(channel|catalog|events|preview)/;

/** Bump whenever the template's factual claims change — routes, ops, event names. */
export const AGENTS_MD_VERSION = 2;

const AGENTS_MD_STAMP_PATTERN = /<!-- ogun:agents-md v(?<version>\d+) -->/;

export const AGENTS_MD_TEMPLATE = `<!-- ogun:agents-md v2 -->
# AGENTS.md — how AIs work in this Ogun workspace

These are the house rules for ANY AI agent working here (Clyffy, Claude Code, Codex,
Gemini, and friends). This file follows the open agents.md convention — edit it; it is
yours.

## Working style

- **Work visibly.** Prefer actions the operator can see: open the file you edit, run
  commands in the terminal pane, narrate what you are doing and why in one plain
  sentence before doing it.
- **Teach as you go.** When you use a technical term for the first time, gloss it in
  five to eight words. Name the things you create (endpoints, components, configs)
  clearly.
- **Boring, canonical names.** Predictable and consistent beats clever. Follow the
  existing naming in this workspace.
- **Ask before destructive.** Deleting, overwriting uncommitted work, force-pushing,
  or installing global tooling needs the operator's explicit yes.
- **Small verified steps.** Run or check what you changed before claiming it works.
  Never claim an action you did not take.

## Ogun channels (for agents that can reach the instance)

This Ogun instance exposes a local Act plane at \`POST /ogun/channel\`
(bearer token; ask the operator or the hosting environment for it):

- \`{"op":"app.open","path":"…"}\` — open a file in the visible editor
- \`{"op":"terminal.type","text":"…","submit":true}\` — type (visibly) in the
  teaching terminal
- \`{"op":"notify","text":"…"}\` — show the operator a short teaching note
- \`{"op":"state.get"}\` — what the operator currently sees (roots, editors, terminals)

### The surface plane — everything is addressable

You do not need a bespoke op per feature. Every part of the application is a
**surface** with an address (\`<kind>:<name>\`) and declared capabilities: find the
thing, then use it, the way a person would.

- \`{"op":"surface.list","match":"font","kind":"setting","withValues":true}\` — search
  inputs, settings, commands, **menus**, **buttons**, views, editors and terminals.
  Narrow with \`zone\` (\`menubar\`, \`sidebar\`, \`toolbar\`, \`panel\`, …) and with
  \`maxDanger\` (\`safe\` | \`caution\` | \`destructive\`) — every surface is classified,
  so you can ask for only what cannot bite before offering it to a newcomer.
- \`{"op":"surface.read","surface":"setting:editor.fontSize"}\` — read a value (sensing,
  never counted as an act)
- \`{"op":"surface.set","surface":"setting:editor.fontSize","value":"16"}\` — set one
- \`{"op":"surface.focus","surface":"view:explorer-view-container"}\` — bring it forward
- \`{"op":"surface.invoke","surface":"command:workbench.action.files.save"}\` — trigger it
- \`{"op":"surface.list","kind":"menu"}\` — **the whole menu tree as data.** This is the
  answer to "what can I do from here": every entry carries its breadcrumb label
  (\`File › Save All\`), whether it is currently enabled, and its danger. Walk it a level
  at a time with \`{"op":"surface.list","kind":"menu","parent":"menu:menubar/1_file"}\`,
  and run an entry with \`surface.invoke\`. Never screenshot a menu — read it.
- \`{"op":"surface.list","kind":"button"}\` — the icon buttons in every open view's title
  bar, with the tooltip their author wrote. \`surface.focus\` on one **points at it**:
  the button pulses amber in the operator's window, which is how you teach where a
  control lives instead of just using it for them.
- \`{"op":"type.real","surface":"input:ask-a-question","text":"…","submit":true}\` —
  **type it for real**, character by character at a human cadence, with the field marked
  so the operator can see you at the keyboard. Prefer this over setting a value outright
  whenever the operator is watching: the pace is the lesson.

\`GET /ogun/catalog\` returns this instance's vocabulary: the declared runtime-event
catalog (every event it can emit, its plane, what its fields mean) and the surface
vocabulary (the address kinds, the zones, the danger levels). Read it rather than
inferring — it is generated from the code, so it cannot drift.

Use the channels instead of screenshots or blind guesses: the state is typed, the
actions are visible, and everything is recorded to the instance's event tape with
provenance — who acted, and what caused it.
`;
