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
import { TerminalWidget } from '@ogun/terminal/lib/browser/base/terminal-widget';

/**
 * The guided-typing teaching mechanic:
 *
 * The target command floats in a chip just ABOVE the terminal — never inline where it
 * could be mistaken for typed text. As the learner types, correctly-typed prefix
 * characters render green and a live percentage ticks up. At the threshold (default
 * 0.7) the system meets them: the remainder is auto-filled into the real terminal and
 * the learner confirms with Enter. Wrong keys are simply not counted — the chip never
 * turns red; a nervous beginner is never shamed. Outcomes are reported for the tape.
 */
export interface GuideResult {
    type: 'guide.completed' | 'guide.abandoned';
    command: string;
    typedRatio: number;
}

@injectable()
export class OgunGuidedTyping {

    protected active?: {
        overlay: HTMLElement;
        keyListener: (e: KeyboardEvent) => void;
        node: HTMLElement;
        report: (result: GuideResult) => void;
        command: string;
        progress: number;
        filled: boolean;
        /** How far the LEARNER got by their own hands before the system filled — the honest ratio for the ledger. */
        typedBeforeFill?: number;
    };

    /** Show the guide on the given terminal. Any previous guide is abandoned. */
    show(terminal: TerminalWidget, command: string, note: string | undefined, threshold: number, report: (result: GuideResult) => void): void {
        this.dismiss('guide.abandoned');

        const node = terminal.node;
        node.style.position = node.style.position || 'relative';

        const overlay = document.createElement('div');
        overlay.setAttribute('aria-live', 'polite');
        Object.assign(overlay.style, {
            position: 'absolute',
            left: '14px',
            bottom: '34px',
            zIndex: '1000',
            fontFamily: 'var(--theia-code-font-family, monospace)',
            fontSize: '13px',
            lineHeight: '1.6',
            pointerEvents: 'none',
            maxWidth: 'calc(100% - 28px)',
        } as CSSStyleDeclaration);

        if (note) {
            const noteEl = document.createElement('div');
            noteEl.textContent = `✦ ${note}`;
            Object.assign(noteEl.style, {
                color: 'var(--theia-terminal-ansiYellow, #E0AF68)',
                fontSize: '11.5px',
                marginBottom: '3px',
            } as CSSStyleDeclaration);
            overlay.appendChild(noteEl);
        }

        const chip = document.createElement('div');
        Object.assign(chip.style, {
            display: 'inline-block',
            border: '1px dashed var(--theia-terminal-ansiYellow, #E0AF68)',
            borderRadius: '6px',
            padding: '3px 10px',
            background: 'var(--theia-editor-background, rgba(0,0,0,.6))',
            whiteSpace: 'pre',
        } as CSSStyleDeclaration);
        overlay.appendChild(chip);
        node.appendChild(overlay);

        const state = {
            overlay, node, report, command,
            progress: 0,
            filled: false,
            typedBeforeFill: undefined as number | undefined,
            keyListener: undefined as unknown as (e: KeyboardEvent) => void
        };

        const render = () => {
            chip.textContent = '';
            const done = document.createElement('span');
            done.textContent = command.slice(0, state.progress);
            done.style.color = 'var(--theia-terminal-ansiGreen, #98C379)';
            done.style.fontWeight = '600';
            const rest = document.createElement('span');
            rest.textContent = command.slice(state.progress);
            rest.style.color = 'var(--theia-descriptionForeground, #6E7681)';
            const pct = document.createElement('span');
            const ratio = state.progress / Math.max(1, command.length);
            pct.textContent = state.filled ? '  ✓ completed — press Enter' : `  ${Math.round(ratio * 100)}%`;
            pct.style.color = state.filled
                ? 'var(--theia-terminal-ansiGreen, #98C379)'
                : 'var(--theia-descriptionForeground, #6E7681)';
            pct.style.fontSize = '11px';
            chip.append(done, rest, pct);
        };

        // Capture-phase observation: the pty still receives every key; the guide only
        // watches. Wrong keys are not counted (and never punished).
        state.keyListener = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) {
                return;
            }
            if (e.key === 'Enter') {
                if (state.filled || state.progress >= command.length) {
                    // The honest ratio: what the LEARNER typed with their own hands —
                    // the fill never inflates the ledger.
                    const typed = state.filled ? (state.typedBeforeFill ?? 0) : state.progress;
                    this.conclude({ type: 'guide.completed', command, typedRatio: Math.min(1, typed / Math.max(1, command.length)) });
                }
                return;
            }
            if (e.key === 'Backspace') {
                state.progress = Math.max(0, state.progress - 1);
                render();
                return;
            }
            if (e.key.length === 1 && !state.filled) {
                if (e.key === command[state.progress]) {
                    state.progress++;
                    const ratio = state.progress / Math.max(1, command.length);
                    if (ratio >= threshold && state.progress < command.length) {
                        // The system meets the learner: fill the remainder into the
                        // REAL terminal; they confirm with Enter.
                        state.typedBeforeFill = state.progress;
                        terminal.sendText(command.slice(state.progress));
                        state.progress = command.length;
                        state.filled = true;
                    }
                }
                render();
            }
        };
        node.addEventListener('keydown', state.keyListener, true);
        this.active = state;
        render();
    }

    dismiss(as: 'guide.completed' | 'guide.abandoned' = 'guide.abandoned'): void {
        if (!this.active) {
            return;
        }
        const { overlay, node, keyListener, report, command, progress } = this.active;
        node.removeEventListener('keydown', keyListener, true);
        overlay.remove();
        const ratio = Math.min(1, progress / Math.max(1, command.length));
        this.active = undefined;
        if (as === 'guide.abandoned') {
            report({ type: 'guide.abandoned', command, typedRatio: ratio });
        }
    }

    protected conclude(result: GuideResult): void {
        if (!this.active) {
            return;
        }
        const { overlay, node, keyListener, report } = this.active;
        node.removeEventListener('keydown', keyListener, true);
        overlay.remove();
        this.active = undefined;
        report(result);
    }
}
