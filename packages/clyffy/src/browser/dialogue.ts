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

import { ClyffyMood, clyffyPortrait } from './portrait';

/**
 * The dialogue frame — a portrait, a nameplate, and words that arrive.
 *
 * Borrowed wholesale from role-playing games, because they solved this: a portrait beside
 * the text turns an instruction into someone talking to you, and a newcomer who is being
 * talked to is not being lectured by software. The nameplate matters as much as the face;
 * it is what makes the guide a character with a name rather than an anonymous tip.
 *
 * The typewriter reveal is the other half. Text that appears all at once is a wall to skim;
 * text that arrives at a readable pace is a voice, and it sets the tempo of the whole
 * walkthrough. Clicking finishes the line immediately — never make someone wait for a
 * machine to finish a sentence they have already read.
 */
export interface DialogueOptions {
    /** Who is speaking. Rendered on the plate. */
    speaker: string;
    /** A short qualifier under the name — "your guide", "step 2 of 5". RPG subtitle energy. */
    role?: string;
    mood?: ClyffyMood;
    /** Characters per second. Slow enough to read along, fast enough not to be a toy. */
    cadence?: number;
}

const DEFAULT_CADENCE = 42;

export class OgunDialogue {

    readonly node: HTMLElement;
    protected readonly portraitSlot: HTMLElement;
    protected readonly nameEl: HTMLElement;
    protected readonly roleEl: HTMLElement;
    protected readonly textEl: HTMLElement;
    protected readonly caret: HTMLElement;
    protected timer?: number;
    protected full = '';

    constructor(protected readonly options: DialogueOptions) {
        this.node = document.createElement('div');
        this.node.className = 'og-dialogue';

        this.portraitSlot = document.createElement('div');
        this.portraitSlot.className = 'og-dialogue-portrait';
        this.portraitSlot.innerHTML = clyffyPortrait(options.mood ?? 'idle', options.speaker);

        const column = document.createElement('div');
        column.className = 'og-dialogue-body';

        const plate = document.createElement('div');
        plate.className = 'og-dialogue-plate';
        this.nameEl = document.createElement('span');
        this.nameEl.className = 'og-dialogue-name';
        this.nameEl.textContent = options.speaker;
        this.roleEl = document.createElement('span');
        this.roleEl.className = 'og-dialogue-role';
        this.roleEl.textContent = options.role ?? '';
        plate.append(this.nameEl, this.roleEl);

        this.textEl = document.createElement('p');
        this.textEl.className = 'og-dialogue-text';
        // Announce the finished line, not each character — a per-character live region
        // would make a screen reader stutter through the whole sentence.
        this.textEl.setAttribute('aria-live', 'polite');

        this.caret = document.createElement('span');
        this.caret.className = 'og-dialogue-caret';
        this.caret.textContent = '▼';
        this.caret.hidden = true;

        column.append(plate, this.textEl, this.caret);
        this.node.append(this.portraitSlot, column);

        // Someone who has read ahead should not be made to wait for the animation.
        this.node.addEventListener('click', () => this.finish());
    }

    /** Change the face without rebuilding the frame — Clyffy stays the same character. */
    set mood(mood: ClyffyMood) {
        this.portraitSlot.innerHTML = clyffyPortrait(mood, this.options.speaker);
    }

    set role(role: string) {
        this.roleEl.textContent = role;
    }

    /** Say a line. Replaces whatever was being said. */
    say(text: string): void {
        this.stop();
        this.full = text;
        this.textEl.textContent = '';
        this.caret.hidden = true;
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.finish();
            return;
        }
        const step = 1000 / (this.options.cadence ?? DEFAULT_CADENCE);
        let index = 0;
        this.timer = window.setInterval(() => {
            index++;
            this.textEl.textContent = text.slice(0, index);
            if (index >= text.length) {
                this.finish();
            }
        }, step);
    }

    /** Show the whole line now and mark it ready to continue. */
    finish(): void {
        this.stop();
        this.textEl.textContent = this.full;
        this.caret.hidden = false;
    }

    protected stop(): void {
        if (this.timer !== undefined) {
            window.clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    /**
     * Structurally a `Disposable`, without importing one. Theia's DisposableCollection
     * accepts anything with this shape, so the frame drops into the IDE's lifecycle while
     * this package stays free of it — which is what lets the same code dress a page that
     * has no IDE anywhere near it.
     */
    dispose(): void {
        this.stop();
        this.node.remove();
    }
}
