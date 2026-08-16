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

import { MessageService, URI } from '@theia/core';
import { inject, injectable } from '@theia/core/shared/inversify';
import { EditorManager } from '@theia/editor/lib/browser';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { WebForgeChannelClient, WebForgeStateSnapshot } from '../common/webforge-channel-protocol';

/**
 * Executes channel ops in the LIVE workbench — visibly, because the point is to show
 * and teach. The teaching terminal is a dedicated, clearly-named terminal so the
 * operator always knows which pane the AI types in.
 */
@injectable()
export class WebForgeChannelClientImpl implements WebForgeChannelClient {

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    protected teachingTerminal: TerminalWidget | undefined;

    async openFile(path: string, line?: number): Promise<{ opened: string }> {
        if (!path) {
            throw new Error('path is required');
        }
        const uri = new URI(path.startsWith('file://') ? path : `file://${path}`);
        const editor = await this.editorManager.open(uri, {
            mode: 'activate',
            ...(typeof line === 'number' ? { selection: { start: { line, character: 0 } } } : {}),
        });
        return { opened: editor.editor.uri.path.toString() };
    }

    async terminalType(text: string, submit = false): Promise<{ typed: number; submitted: boolean }> {
        const terminal = await this.getTeachingTerminal();
        this.terminalService.open(terminal, { mode: 'activate' });
        if (text) {
            terminal.sendText(text);
        }
        if (submit) {
            terminal.sendText('\n');
        }
        return { typed: text.length, submitted: submit };
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
        return { shown: true };
    }

    async getState(): Promise<WebForgeStateSnapshot> {
        const roots = await this.workspaceService.roots;
        return {
            workspaceRoots: roots.map(r => r.resource.path.toString()),
            activeEditor: this.editorManager.currentEditor?.editor.uri.path.toString(),
            openEditors: this.editorManager.all.map(e => e.editor.uri.path.toString()),
            terminals: this.terminalService.all.map(t => t.title.label),
        };
    }

    protected async getTeachingTerminal(): Promise<TerminalWidget> {
        if (this.teachingTerminal && !this.teachingTerminal.isDisposed) {
            return this.teachingTerminal;
        }
        const terminal = await this.terminalService.newTerminal({ title: 'Clyffy' });
        this.terminalService.open(terminal, { mode: 'activate' });
        await terminal.start();
        this.teachingTerminal = terminal;
        return terminal;
    }
}
