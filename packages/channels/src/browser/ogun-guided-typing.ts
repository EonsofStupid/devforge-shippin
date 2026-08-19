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

import { nls } from '@ogun/core';
import { injectable } from '@ogun/core/shared/inversify';
import { TerminalWidget } from '@ogun/terminal/lib/browser/base/terminal-widget';

/**
 * The guided-typing teaching mechanic:
 *
 * The target command floats in a card ABOVE the terminal — never inline where it could be
 * mistaken for typed text. It is drawn as keycaps rather than a string, with exactly one
 * key lit as the next to press: "press these keys" is a shape a person reads without being
 * told, and a single lit key removes any question about where to look. As the learner
 * types, keys settle green and a progress bar fills. At the threshold (default 0.7) the
 * system meets them: the remainder is auto-filled into the real terminal and the learner
 * confirms with Enter. Wrong keys are simply not counted — nothing ever turns red; a
 * nervous beginner is never shamed. Outcomes are reported for the tape.
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
        overlay.className = 'ogun-guide';
        overlay.setAttribute('aria-live', 'polite');
        overlay.setAttribute('aria-label', nls.localize('ogun/guide/aria', 'Type this command: {0}', command));

        const label = document.createElement('div');
        label.className = 'og-guide-label';
        const badge = document.createElement('span');
        badge.className = 'og-guide-badge';
        badge.textContent = '⌨';
        const labelText = document.createElement('span');
        labelText.textContent = nls.localize('ogun/guide/prompt', "Type this — I'll finish it for you");
        label.append(badge, labelText);
        overlay.appendChild(label);

        if (note) {
            const noteEl = document.createElement('div');
            noteEl.className = 'og-guide-note';
            noteEl.textContent = note;
            overlay.appendChild(noteEl);
        }

        const keys = document.createElement('div');
        keys.className = 'og-guide-keys';
        // One element per character, built once and only re-styled as the learner moves —
        // rebuilding would restart the lit key's animation on every keystroke.
        const caps = [...command].map(character => {
            const cap = document.createElement('span');
            const isSpace = character === ' ';
            cap.className = isSpace ? 'og-key og-space' : 'og-key';
            cap.textContent = isSpace ? nls.localize('ogun/guide/space', 'space') : character;
            keys.appendChild(cap);
            return cap;
        });
        overlay.appendChild(keys);

        const track = document.createElement('div');
        track.className = 'og-guide-track';
        const fill = document.createElement('div');
        fill.className = 'og-guide-fill';
        track.appendChild(fill);
        overlay.appendChild(track);

        node.appendChild(overlay);

        const state = {
            overlay, node, report, command,
            progress: 0,
            filled: false,
            typedBeforeFill: undefined as number | undefined,
            keyListener: undefined as unknown as (e: KeyboardEvent) => void
        };

        const render = () => {
            caps.forEach((cap, index) => {
                const done = index < state.progress;
                const next = !state.filled && index === state.progress;
                cap.classList.toggle('og-done', done);
                cap.classList.toggle('og-next', next);
            });
            const ratio = state.progress / Math.max(1, command.length);
            fill.style.width = `${Math.round(ratio * 100)}%`;
            overlay.classList.toggle('og-filled', state.filled);
            labelText.textContent = state.filled
                ? nls.localize('ogun/guide/confirm', 'Got it — press Enter to run it')
                : nls.localize('ogun/guide/prompt', "Type this — I'll finish it for you");
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
