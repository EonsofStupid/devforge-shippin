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

import { MessageService, PreferenceService, URI } from '@ogun/core';
import { inject, injectable } from '@ogun/core/shared/inversify';
import { EditorManager } from '@ogun/editor/lib/browser';
import { TerminalService } from '@ogun/terminal/lib/browser/base/terminal-service';
import { TerminalWidget } from '@ogun/terminal/lib/browser/base/terminal-widget';
import { WorkspaceService } from '@ogun/workspace/lib/browser';
import { Actor } from '@ogun/runtime/lib/common/ogun-provenance';
import { SurfaceActionResult, SurfaceDescriptor, SurfaceQuery } from '@ogun/runtime/lib/common/ogun-surfaces';
import { OgunRealTyping } from '@ogun/runtime/lib/browser/ogun-real-typing';
import { OgunRuntimeBus } from '@ogun/runtime/lib/browser/ogun-runtime-bus';
import { OgunSurfaceRegistry } from '@ogun/runtime/lib/browser/ogun-surface-registry';
import { OgunChannelClient, OgunChannelService, OgunStateSnapshot } from '../common/ogun-channel-protocol';
import { OgunGuidedTyping } from './ogun-guided-typing';
import { OGUN_GUIDED_TYPING_THRESHOLD } from './ogun-preferences';

/**
 * Executes channel ops in the LIVE workbench — visibly, because the point is to show
 * and teach. The teaching terminal is a dedicated, clearly-named terminal so the
 * operator always knows which pane the AI types in.
 */
@injectable()
export class OgunChannelClientImpl implements OgunChannelClient {

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(OgunGuidedTyping)
    protected readonly guidedTyping: OgunGuidedTyping;

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(OgunRuntimeBus)
    protected readonly bus: OgunRuntimeBus;

    @inject(OgunSurfaceRegistry)
    protected readonly surfaces: OgunSurfaceRegistry;

    @inject(OgunRealTyping)
    protected readonly typing: OgunRealTyping;

    protected teachingTerminal: TerminalWidget | undefined;

    /** Set by the frontend module once the RPC proxy exists. */
    backendService: OgunChannelService | undefined;

    /**
     * Turn whatever the caller said into a URI that exists.
     *
     * `new URI('file://AGENTS.md')` does not mean the file AGENTS.md — it means the ROOT of
     * a host called `agents.md`, because everything after `//` is an authority. So a
     * relative path silently became nonsense and every open of one failed. That is the
     * most natural thing anyone would ask for ("open AGENTS.md"), which made it the worst
     * possible thing to get wrong: relative paths are resolved against the workspace root,
     * and only genuinely absolute ones are prefixed.
     */
    protected async resolve(path: string): Promise<URI> {
        if (path.startsWith('file://')) {
            return new URI(path);
        }
        if (path.startsWith('/')) {
            return new URI(`file://${path}`);
        }
        const root = (await this.workspaceService.roots)[0];
        if (!root) {
            throw new Error(`cannot resolve '${path}': no folder is open`);
        }
        return root.resource.resolve(path);
    }

    async openFile(path: string, line?: number): Promise<{ opened: string }> {
        if (!path) {
            throw new Error('path is required');
        }
        return this.asClyffy('open a file', async () => {
            const uri = await this.resolve(path);
            // The observer reports editors being CREATED. If the file is already open,
            // nothing is created and the act would vanish — so only that case is reported
            // here, or every open would land on the tape twice.
            const alreadyOpen = this.editorManager.all.some(widget => widget.editor.uri.toString() === uri.toString());
            const editor = await this.editorManager.open(uri, {
                mode: 'activate',
                ...(typeof line === 'number' ? { selection: { start: { line, character: 0 } } } : {}),
            });
            const opened = editor.editor.uri.path.toString();
            if (alreadyOpen) {
                this.bus.emit('act.file.opened', { path: opened, line });
            }
            return { opened };
        });
    }

    /**
     * Everything arriving over the channel is Clyffy's doing, and the tape must say so.
     * Acts raised deep inside Theia by this work inherit the same attribution and chain,
     * which is what keeps an AI's edits distinguishable from the operator's own.
     */
    protected asClyffy<T>(reason: string, work: () => Promise<T>): Promise<T> {
        return this.bus.as(Actor.channel('http'), reason, work);
    }

    async terminalType(text: string, submit = false): Promise<{ typed: number; submitted: boolean }> {
        return this.asClyffy('type in the terminal', async () => {
            const terminal = await this.getTeachingTerminal();
            this.terminalService.open(terminal, { mode: 'activate' });
            if (text) {
                // Character by character, at a human cadence: the operator watches the
                // same motion they would make themselves. Pasting teaches nothing.
                await this.typing.intoTerminal(terminal, text, { submit });
            } else if (submit) {
                terminal.sendText('\n');
            }
            this.bus.emit('act.terminal.typed', { terminal: terminal.title.label, chars: text.length, submitted: submit });
            return { typed: text.length, submitted: submit };
        });
    }

    // Sensing is not an act, but it still has an author. A catalog read Clyffy performed
    // must not appear on the tape as the operator having looked around: the whole value of
    // the record is being able to answer "who did this, and why" for every row.
    async listSurfaces(query: SurfaceQuery): Promise<SurfaceDescriptor[]> {
        return this.asClyffy('look for a surface', () => this.surfaces.list(query ?? {}));
    }

    async readSurface(id: string): Promise<SurfaceActionResult> {
        return this.asClyffy(`read ${id}`, () => this.surfaces.read(id));
    }

    async setSurface(id: string, value: string): Promise<SurfaceActionResult> {
        return this.asClyffy(`set ${id}`, () => this.surfaces.set(id, value));
    }

    async focusSurface(id: string): Promise<SurfaceActionResult> {
        return this.asClyffy(`focus ${id}`, () => this.surfaces.focus(id));
    }

    async invokeSurface(id: string, args?: unknown[]): Promise<SurfaceActionResult> {
        return this.asClyffy(`invoke ${id}`, () => this.surfaces.invoke(id, args));
    }

    async typeInto(id: string, text: string, options: { cadence?: number; submit?: boolean } = {}): Promise<{ typed: number }> {
        return this.asClyffy(`type into ${id}`, async () => {
            const target = await this.surfaces.typeTarget(id);
            if (!target) {
                throw new Error(`surface '${id}' cannot be typed into`);
            }
            const terminal = this.terminalService.all.find(candidate => candidate.node === target);
            const typed = terminal
                ? await this.typing.intoTerminal(terminal, text, options)
                : await this.typing.intoElement(target, text, { ...options, yieldToOperator: true });
            this.bus.emit('act.surface.set', { surface: id, kind: terminal ? 'terminal' : 'input', chars: typed });
            return { typed };
        });
    }

    async notify(text: string, kind: 'info' | 'warn' = 'info'): Promise<{ shown: boolean }> {
        if (!text) {
            return { shown: false };
        }
        // Fire-and-forget: the MessageService promise resolves on dismissal — the
        // channel must answer immediately, not when the toast times out.
        if (kind === 'warn') {
            this.messageService.warn(text, { timeout: 8000 }).then(undefined, () => { /* dismissed */ });
        } else {
            this.messageService.info(text, { timeout: 8000 }).then(undefined, () => { /* dismissed */ });
        }
        this.bus.emit('act.notice.shown', { chars: text.length, kind });
        return { shown: true };
    }

    async getState(): Promise<OgunStateSnapshot> {
        const roots = await this.workspaceService.roots;
        this.bus.emit('sense.state.read', { editors: this.editorManager.all.length, terminals: this.terminalService.all.length });
        return {
            workspaceRoots: roots.map(r => r.resource.path.toString()),
            activeEditor: this.editorManager.currentEditor?.editor.uri.path.toString(),
            openEditors: this.editorManager.all.map(e => e.editor.uri.path.toString()),
            terminals: this.terminalService.all.map(t => t.title.label),
        };
    }

    async guideType(command: string, note?: string, threshold?: number): Promise<{ started: boolean }> {
        const trimmed = command.trim();
        if (!trimmed) {
            throw new Error('command is required');
        }
        // Offering the guide is Clyffy's act; completing it is the learner's, and that
        // outcome fires later, outside this scope, so it is attributed to them.
        return this.asClyffy('offer a guided command', () => this.showGuide(trimmed, note, threshold));
    }

    protected async showGuide(trimmed: string, note?: string, threshold?: number): Promise<{ started: boolean }> {
        const terminal = await this.getTeachingTerminal();
        this.terminalService.open(terminal, { mode: 'activate' });
        // An explicit threshold on the op wins; otherwise the operator's own preference,
        // because how much help feels like help is a personal setting.
        const preferred = this.preferences.get<number>(OGUN_GUIDED_TYPING_THRESHOLD, 0.7);
        const effectiveThreshold = typeof threshold === 'number' && threshold > 0 && threshold <= 1 ? threshold : preferred;
        this.bus.emit('teach.guide.shown', { command: trimmed, chars: trimmed.length });
        this.guidedTyping.show(terminal, trimmed, note, effectiveThreshold, result => {
            // The learner typed this, not Clyffy — the outcome is recorded as theirs.
            this.bus.emit(`teach.${result.type}`, { command: result.command, typedRatio: result.typedRatio });
        });
        return { started: true };
    }

    protected async getTeachingTerminal(): Promise<TerminalWidget> {
        if (this.teachingTerminal && !this.teachingTerminal.isDisposed) {
            return this.teachingTerminal;
        }
        const terminal = await this.terminalService.newTerminal({ title: 'Clyffy', useServerTitle: false });
        this.terminalService.open(terminal, { mode: 'activate' });
        await terminal.start();
        this.teachingTerminal = terminal;
        return terminal;
    }
}
