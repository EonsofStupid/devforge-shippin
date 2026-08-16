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

import { MessageService } from '@theia/core';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { WorkspaceService } from '@theia/workspace/lib/browser';

/**
 * Seeds a WebForge AGENTS.md into workspaces that lack one — the open convention
 * (agents.md) that frontier AIs (Claude Code, Codex, Gemini, …) read natively, so
 * every seat working in this workspace follows the same house rules as Clyffy.
 * Created once, owned by the operator thereafter (never overwritten).
 */
@injectable()
export class WebForgeAgentsMdSeeder implements FrontendApplicationContribution {

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
            if (await this.fileService.exists(target)) {
                return;
            }
            await this.fileService.createFile(target, BinaryBuffer.fromString(AGENTS_MD_TEMPLATE));
            this.messageService.info(
                'Added AGENTS.md — the house rules every AI working in this workspace follows. Yours to edit.',
                { timeout: 8000 }
            ).then(undefined, () => { /* dismissed */ });
        } catch {
            // Seeding is a courtesy, never a failure mode.
        }
    }
}

export const AGENTS_MD_TEMPLATE = `# AGENTS.md — how AIs work in this WebForge workspace

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

## WebForge channels (for agents that can reach the instance)

This WebForge instance exposes a local Act plane at \`POST /webforge/channel\`
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
  inputs, settings, commands, views, editors and terminals
- \`{"op":"surface.read","surface":"setting:editor.fontSize"}\` — read a value (sensing,
  never counted as an act)
- \`{"op":"surface.set","surface":"setting:editor.fontSize","value":"16"}\` — set one
- \`{"op":"surface.focus","surface":"view:explorer-view-container"}\` — bring it forward
- \`{"op":"surface.invoke","surface":"command:workbench.action.files.save"}\` — trigger it
- \`{"op":"type.real","surface":"input:ask-a-question","text":"…","submit":true}\` —
  **type it for real**, character by character at a human cadence, with the field marked
  so the operator can see you at the keyboard. Prefer this over setting a value outright
  whenever the operator is watching: the pace is the lesson.

\`GET /webforge/catalog\` returns the declared runtime-event catalog — every event this
instance can emit, its plane and what its fields mean. Read it rather than inferring.

Use the channels instead of screenshots or blind guesses: the state is typed, the
actions are visible, and everything is recorded to the instance's event tape with
provenance — who acted, and what caused it.
`;
