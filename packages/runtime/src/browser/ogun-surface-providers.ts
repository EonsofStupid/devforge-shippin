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

import { CommandRegistry, PreferenceSchemaService, PreferenceScope, PreferenceService } from '@ogun/core';
import { ApplicationShell, Widget } from '@ogun/core/lib/browser';
import { inject, injectable } from '@ogun/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';
import { EditorManager, EditorWidget } from '@ogun/editor/lib/browser';
import { TerminalService } from '@ogun/terminal/lib/browser/base/terminal-service';
import { TerminalWidget } from '@ogun/terminal/lib/browser/base/terminal-widget';
import { classifyDanger } from '../common/ogun-catalog';
import { SurfaceDescriptor, SurfaceKind, SurfaceQuery, SurfaceZone } from '../common/ogun-surfaces';
import { OgunSurfaceProvider } from './ogun-surface-registry';

function tail(id: string): string {
    return id.slice(id.indexOf(':') + 1);
}

/** Values shown in listings are for orientation, not transport — keep them short. */
function brief(value: unknown, max = 120): string {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Every preference in the application — thousands of them, searchable and settable. */
@injectable()
export class SettingSurfaceProvider implements OgunSurfaceProvider {
    readonly kind: SurfaceKind = 'setting';

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(PreferenceSchemaService)
    protected readonly schema: PreferenceSchemaService;

    async list(query: SurfaceQuery): Promise<SurfaceDescriptor[]> {
        const result: SurfaceDescriptor[] = [];
        for (const [name, property] of this.schema.getSchemaProperties()) {
            result.push({
                id: `setting:${name}`,
                kind: 'setting',
                label: name,
                zone: 'settings',
                danger: 'caution',
                capabilities: ['read', 'set'],
                description: typeof property.description === 'string' ? property.description : undefined,
                value: query.withValues ? brief(this.preferences.get(name)) : undefined
            });
        }
        return result;
    }

    async read(id: string): Promise<string | undefined> {
        return brief(this.preferences.get(tail(id)), 400);
    }

    async set(id: string, value: string): Promise<void> {
        const name = tail(id);
        const property = this.schema.getSchemaProperty(name);
        // Preferences are typed; a channel only ever hands us text, so coerce against the
        // declared schema rather than writing a string into a boolean setting.
        let coerced: unknown = value;
        if (property?.type === 'boolean') {
            coerced = value === 'true';
        } else if (property?.type === 'number' || property?.type === 'integer') {
            const parsed = Number(value);
            if (Number.isNaN(parsed)) {
                throw new Error(`'${value}' is not a number for setting '${name}'`);
            }
            coerced = parsed;
        } else if (property?.type === 'array' || property?.type === 'object') {
            coerced = JSON.parse(value);
        }
        await this.preferences.set(name, coerced, PreferenceScope.User);
    }
}

/** Every workbench command, invocable by address. */
@injectable()
export class CommandSurfaceProvider implements OgunSurfaceProvider {
    readonly kind: SurfaceKind = 'command';

    @inject(CommandRegistry)
    protected readonly commands: CommandRegistry;

    async list(): Promise<SurfaceDescriptor[]> {
        return this.commands.commands
            .filter(command => !!command.label)
            .map(command => ({
                id: `command:${command.id}`,
                kind: 'command' as SurfaceKind,
                label: command.category ? `${command.category}: ${command.label}` : command.label!,
                zone: 'palette',
                capabilities: ['invoke' as const],
                danger: classifyDanger(command.id, command.label)
            }));
    }

    async invoke(id: string, args: unknown[] = []): Promise<void> {
        await this.commands.executeCommand(tail(id), ...args);
    }
}

/** Panels and widgets: what is open, and how to bring one forward. */
@injectable()
export class ViewSurfaceProvider implements OgunSurfaceProvider {
    readonly kind: SurfaceKind = 'view';

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    async list(): Promise<SurfaceDescriptor[]> {
        return this.shell.widgets.map(widget => ({
            id: `view:${widget.id}`,
            kind: 'view' as SurfaceKind,
            label: widget.title.label || widget.id,
            zone: this.zoneOf(widget),
            capabilities: ['focus' as const]
        }));
    }

    /**
     * Shell areas are layout words (`left`, `right`, `bottom`); zones are the words an
     * operator uses pointing at the screen. The catalog speaks the operator's.
     */
    protected zoneOf(widget: Widget): SurfaceZone {
        switch (this.shell.getAreaFor(widget)) {
            case 'left': return 'sidebar';
            case 'right': return 'secondary';
            case 'bottom': return 'panel';
            case 'top': return 'toolbar';
            default: return 'editor';
        }
    }

    async focus(id: string): Promise<void> {
        await this.shell.revealWidget(tail(id));
        await this.shell.activateWidget(tail(id));
    }
}

/** Open editors, readable and typeable through Monaco rather than through the DOM. */
@injectable()
export class EditorSurfaceProvider implements OgunSurfaceProvider {
    readonly kind: SurfaceKind = 'editor';

    @inject(EditorManager)
    protected readonly editors: EditorManager;

    async list(query: SurfaceQuery): Promise<SurfaceDescriptor[]> {
        return this.editors.all.map(widget => ({
            id: `editor:${widget.editor.uri.path.fsPath()}`,
            kind: 'editor' as SurfaceKind,
            label: widget.title.label,
            zone: 'editor',
            capabilities: ['read', 'focus', 'type'] as const as SurfaceDescriptor['capabilities'],
            value: query.withValues ? brief(widget.editor.document.getText()) : undefined
        }));
    }

    protected find(id: string): EditorWidget | undefined {
        const path = tail(id);
        return this.editors.all.find(widget => widget.editor.uri.path.fsPath() === path);
    }

    async read(id: string): Promise<string | undefined> {
        return this.find(id)?.editor.document.getText();
    }

    async focus(id: string): Promise<void> {
        const widget = this.find(id);
        if (widget) {
            widget.activate();
        }
    }
}

/** Terminals, addressed by their visible title — the pane the operator can point at. */
@injectable()
export class TerminalSurfaceProvider implements OgunSurfaceProvider {
    readonly kind: SurfaceKind = 'terminal';

    @inject(TerminalService)
    protected readonly terminals: TerminalService;

    async list(): Promise<SurfaceDescriptor[]> {
        return this.terminals.all.map(terminal => ({
            id: `terminal:${terminal.title.label}`,
            kind: 'terminal' as SurfaceKind,
            label: terminal.title.label,
            zone: 'terminal',
            capabilities: ['focus', 'type'] as const as SurfaceDescriptor['capabilities']
        }));
    }

    protected find(id: string): TerminalWidget | undefined {
        const label = tail(id);
        return this.terminals.all.find(terminal => terminal.title.label === label);
    }

    async focus(id: string): Promise<void> {
        const terminal = this.find(id);
        if (terminal) {
            this.terminals.open(terminal, { mode: 'activate' });
        }
    }

    async resolveTypeTarget(id: string): Promise<HTMLElement | undefined> {
        return this.find(id)?.node;
    }
}

/**
 * Live text inputs found in the workbench.
 *
 * This is the general case that keeps the engine honest: rather than enumerating every
 * dialog and field by hand, we describe what is actually on screen right now — search
 * boxes, filter fields, the chat prompt, dialog inputs — and address each by the most
 * stable name it exposes. Anything a person could type into, Clyffy can find.
 */
@injectable()
export class InputSurfaceProvider implements OgunSurfaceProvider {
    readonly kind: SurfaceKind = 'input';

    protected nameOf(element: HTMLElement, index: number): string {
        const candidates = [
            element.getAttribute('aria-label'),
            element.getAttribute('placeholder'),
            element.getAttribute('name'),
            element.id,
            element.closest('[id]')?.id
        ];
        const name = candidates.find(value => !!value && value.trim().length > 0);
        return (name ?? `field-${index}`).trim().toLowerCase().replace(/\s+/g, '-').slice(0, 60);
    }

    protected elements(): HTMLElement[] {
        const selector = 'input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable="true"]';
        return [...document.querySelectorAll<HTMLElement>(selector)]
            // Only what the operator can actually reach: hidden fields are not surfaces.
            // eslint-disable-next-line no-null/no-null
            .filter(element => element.offsetParent !== null || element.getClientRects().length > 0);
    }

    async list(query: SurfaceQuery): Promise<SurfaceDescriptor[]> {
        return this.elements().map((element, index) => ({
            id: `input:${this.nameOf(element, index)}`,
            kind: 'input' as SurfaceKind,
            label: element.getAttribute('aria-label') || element.getAttribute('placeholder') || `field ${index + 1}`,
            capabilities: ['read', 'set', 'type', 'focus'] as const as SurfaceDescriptor['capabilities'],
            value: query.withValues ? brief(this.valueOf(element)) : undefined
        }));
    }

    /** Monaco owns the text inside an editor; ask it rather than scraping its DOM. */
    protected monacoFor(element: HTMLElement): monaco.editor.ICodeEditor | undefined {
        const host = element.closest('.monaco-editor');
        return host
            ? monaco.editor.getEditors().find(editor => editor.getContainerDomNode() === host || host.contains(editor.getContainerDomNode()))
            : undefined;
    }

    protected valueOf(element: HTMLElement): string {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            return element.value;
        }
        const editor = this.monacoFor(element);
        return editor ? editor.getModel()?.getValue() ?? '' : element.textContent ?? '';
    }

    protected find(id: string): HTMLElement | undefined {
        const wanted = tail(id);
        return this.elements().find((element, index) => this.nameOf(element, index) === wanted);
    }

    async read(id: string): Promise<string | undefined> {
        const element = this.find(id);
        return element ? this.valueOf(element) : undefined;
    }

    /**
     * Replace the value the way a browser would, not the way a script would: many inputs
     * in the workbench are framework-controlled and ignore a plain assignment, so we go
     * through the native setter and then announce the change.
     */
    async set(id: string, value: string): Promise<void> {
        const element = this.find(id);
        if (!element) {
            throw new Error(`no input surface '${id}' on screen`);
        }
        const editor = this.monacoFor(element);
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            setter?.call(element, value);
        } else if (editor) {
            editor.getModel()?.setValue(value);
            return;
        } else if (element.isContentEditable && element.childElementCount === 0) {
            element.textContent = value;
        } else {
            throw new Error(`surface '${id}' is not a writable field`);
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async focus(id: string): Promise<void> {
        this.find(id)?.focus();
    }

    async invoke(id: string): Promise<void> {
        const element = this.find(id);
        element?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }

    async resolveTypeTarget(id: string): Promise<HTMLElement | undefined> {
        return this.find(id);
    }
}
