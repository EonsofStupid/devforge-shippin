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

import { injectable } from '@ogun/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';
import { TerminalWidget } from '@ogun/terminal/lib/browser/base/terminal-widget';

/**
 * Real typing.
 *
 * When Clyffy types, it types — character by character, at a human cadence, into the
 * actual input, so the operator watches the same motion they would make themselves.
 * Pasting a whole line is faster and teaches nothing; the delay is the lesson. The
 * surface being typed into wears a marker while it happens, so it is always obvious
 * who is at the keyboard.
 *
 * Cadence is uneven on purpose — a fixed interval reads as a machine dumping text,
 * a varied one reads as someone typing — and it pauses fractionally longer after a
 * space, which is where a real typist's hands hesitate.
 */

export interface RealTypingOptions {
    /** Milliseconds per character, before jitter. */
    cadence?: number;
    /** Fraction of the cadence to vary by, 0–1. */
    jitter?: number;
    /** Press Enter at the end. */
    submit?: boolean;
    /** Abort if the operator takes over. */
    yieldToOperator?: boolean;
}

const DEFAULT_CADENCE = 42;
const DEFAULT_JITTER = 0.5;
/** The class a surface wears while Clyffy is typing into it. */
export const TYPING_MARKER_CLASS = 'ogun-clyffy-typing';

@injectable()
export class OgunRealTyping {

    /** Deterministic-enough variation without pulling in randomness we can't replay. */
    protected step = 0;

    protected delayFor(character: string, cadence: number, jitter: number): number {
        this.step++;
        // A cheap repeating wobble: no RNG, so a replayed tape produces the same rhythm.
        const wobble = Math.sin(this.step * 1.7) * jitter;
        const base = cadence * (1 + wobble);
        return Math.max(8, character === ' ' ? base * 1.6 : base);
    }

    protected wait(ms: number): Promise<void> {
        return new Promise(resolve => window.setTimeout(resolve, ms));
    }

    /** Type into a terminal, one character at a time, straight down the pty. */
    async intoTerminal(terminal: TerminalWidget, text: string, options: RealTypingOptions = {}): Promise<number> {
        const cadence = options.cadence ?? DEFAULT_CADENCE;
        const jitter = options.jitter ?? DEFAULT_JITTER;
        terminal.node.classList.add(TYPING_MARKER_CLASS);
        try {
            for (const character of text) {
                terminal.sendText(character);
                await this.wait(this.delayFor(character, cadence, jitter));
            }
            if (options.submit) {
                terminal.sendText('\n');
            }
        } finally {
            terminal.node.classList.remove(TYPING_MARKER_CLASS);
        }
        return text.length;
    }

    /**
     * Type into a DOM input. Each character is a full keydown → value change → input →
     * keyup cycle, because framework-controlled fields (and Monaco's edit context)
     * ignore anything less.
     */
    async intoElement(element: HTMLElement, text: string, options: RealTypingOptions = {}): Promise<number> {
        const cadence = options.cadence ?? DEFAULT_CADENCE;
        const jitter = options.jitter ?? DEFAULT_JITTER;
        const monacoEditor = this.monacoFor(element);
        (monacoEditor ? monacoEditor.getContainerDomNode() : element).focus?.();
        element.focus();
        const marked = monacoEditor?.getContainerDomNode() ?? element;
        marked.classList.add(TYPING_MARKER_CLASS);
        try {
            for (const character of text) {
                if (options.yieldToOperator && !monacoEditor && document.activeElement !== element) {
                    // The operator took the keyboard. Their input wins, always.
                    break;
                }
                this.pressInto(element, character);
                await this.wait(this.delayFor(character, cadence, jitter));
            }
            if (options.submit) {
                const target = monacoEditor?.getDomNode() ?? element;
                target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
            }
        } finally {
            marked.classList.remove(TYPING_MARKER_CLASS);
        }
        return text.length;
    }

    /**
     * Monaco owns the DOM inside an editor — the chat prompt and every code editor are
     * Monaco. Writing into that DOM directly is silently discarded on the next render (and
     * can tear out nodes Monaco is managing), so those go through the editor's own type
     * command instead. This is the difference between typing into the application and
     * typing at it.
     */
    protected monacoFor(element: HTMLElement): monaco.editor.ICodeEditor | undefined {
        const host = element.closest('.monaco-editor');
        if (!host) {
            return undefined;
        }
        return monaco.editor.getEditors().find(editor => {
            const node = editor.getContainerDomNode();
            return node === host || node.contains(element) || host.contains(node);
        });
    }

    protected pressInto(element: HTMLElement, character: string): void {
        const editor = this.monacoFor(element);
        if (editor) {
            editor.focus();
            editor.trigger('ogun', 'type', { text: character });
            return;
        }
        element.dispatchEvent(new KeyboardEvent('keydown', { key: character, bubbles: true, cancelable: true }));
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            setter?.call(element, element.value + character);
        } else if (element.isContentEditable && element.childElementCount === 0) {
            // Only ever append to a leaf: replacing the content of a container would tear
            // out DOM another component owns.
            element.textContent = `${element.textContent ?? ''}${character}`;
        }
        element.dispatchEvent(new InputEvent('input', { data: character, inputType: 'insertText', bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: character, bubbles: true }));
    }
}
