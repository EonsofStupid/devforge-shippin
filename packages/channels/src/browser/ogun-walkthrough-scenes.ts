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

/**
 * The walkthrough scenes, drawn in "Phosphor Flat".
 *
 * Three rules the art obeys, and they are the reason it stays small and stays
 * theme-aware:
 *
 * 1. **Six inks, twenty colours.** Vibrancy comes from overlap — planes composite
 *    with `screen` on the dark ground — not from a bigger palette.
 * 2. **One focal plane per scene.** Everything is flat except a single object, which
 *    gets a hard-offset shadow and a 1px light top edge. If two things pop, nothing
 *    pops.
 * 3. **Tokens, not exports.** Every fill is a CSS custom property (`--og-a1`…`--og-a6`),
 *    so changing palette lineage re-themes every scene with no re-export and no
 *    animation runtime.
 *
 * Each scene ends by doing the thing for real, through the channels. The art is the
 * invitation; the workbench is the classroom.
 */

/** What a scene does in the live workbench when the learner accepts it. */
export type SceneAct = 'none' | 'open-house-rules' | 'guide-list-files' | 'reveal-clyffy';

export interface WalkthroughScene {
    /** Stable id — this is what lands on the event tape. */
    id: string;
    title: string;
    body: string;
    /** Label of the button that performs the act. */
    actionLabel: string;
    act: SceneAct;
    /** Inline SVG markup; all fills are palette tokens. */
    art: string;
}

/** Repeated scan texture — an honest CRT tell, at one pattern definition per scene. */
const SCAN_DEFS = `<defs><pattern id="wfScan" width="4" height="4" patternUnits="userSpaceOnUse">
<rect width="4" height="1" fill="#ffffff" opacity=".05"/></pattern></defs>`;

/** The phosphor disc every scene opens on, scan-lined and screened onto the ground. */
function disc(cx: number, cy: number, r: number, ink = 'var(--og-a1)'): string {
    return `<g class="og-plane og-p1">
<circle class="og-blend" cx="${cx}" cy="${cy}" r="${r}" fill="${ink}" opacity=".22"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#wfScan)"/></g>`;
}

/**
 * The focal treatment, applied to exactly one object per scene: a hard-offset shadow
 * (no blur — blur is what makes flat art look cheap), the plate, and a 1px light edge
 * along the top.
 */
function focalPlate(x: number, y: number, w: number, h: number, contents: string): string {
    return `<g class="og-plane og-p4">
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#000" opacity=".55" transform="translate(5 6)"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="var(--og-plate)" stroke="var(--og-focal)" stroke-width="1.5"/>
<path d="M${x + 4} ${y + 4} H${x + w - 4}" stroke="#fff" stroke-opacity=".14" stroke-width="1.5" stroke-linecap="round"/>
${contents}</g>`;
}

function svg(body: string, label: string): string {
    return `<svg class="og-art" viewBox="0 0 300 220" role="img" aria-label="${label}">${SCAN_DEFS}${body}</svg>`;
}

/** Scene 1 — the machine wakes up. */
function artWelcome(): string {
    return svg(`
${disc(214, 62, 78)}
<g class="og-plane og-p2"><rect class="og-blend" x="30" y="96" width="150" height="30" rx="6" fill="var(--og-a4)" opacity=".6" transform="rotate(-5 105 111)"/></g>
<g class="og-plane og-p3"><rect class="og-blend" x="44" y="132" width="118" height="24" rx="6" fill="var(--og-a5)" opacity=".55" transform="rotate(-3 103 144)"/></g>
${focalPlate(66, 52, 176, 92, `
<rect x="80" y="72" width="14" height="18" rx="2" fill="var(--og-a3)"/>
<rect x="102" y="76" width="88" height="8" rx="4" fill="var(--og-focal)"/>
<rect x="80" y="102" width="118" height="6" rx="3" fill="var(--og-dim)" opacity=".55"/>
<rect x="80" y="118" width="76" height="6" rx="3" fill="var(--og-dim)" opacity=".35"/>`)}
<g class="og-plane og-p5"><circle class="og-pulse" cx="252" cy="176" r="7" fill="var(--og-focal)"/>
<rect x="30" y="168" width="86" height="8" rx="4" fill="var(--og-dim)" opacity=".3"/></g>`,
        'A lit plate rising out of overlapping planes');
}

/** Scene 2 — a project is a folder of files. */
function artProject(): string {
    return svg(`
${disc(212, 66, 82)}
<g class="og-plane og-p2"><rect class="og-blend" x="34" y="72" width="164" height="104" rx="9" fill="var(--og-a4)" opacity=".62" transform="rotate(-7 116 124)"/></g>
<g class="og-plane og-p3"><rect class="og-blend" x="56" y="62" width="164" height="104" rx="9" fill="var(--og-a5)" opacity=".6" transform="rotate(-3 138 114)"/></g>
${focalPlate(80, 56, 168, 106, `
<rect x="94" y="76" width="86" height="6" rx="3" fill="var(--og-dim)" opacity=".5"/>
<rect x="94" y="92" width="120" height="6" rx="3" fill="var(--og-focal)"/>
<rect x="94" y="108" width="64" height="6" rx="3" fill="var(--og-dim)" opacity=".5"/>
<rect x="94" y="124" width="102" height="6" rx="3" fill="var(--og-dim)" opacity=".35"/>
<rect x="94" y="140" width="44" height="6" rx="3" fill="var(--og-dim)" opacity=".35"/>`)}
<g class="og-plane og-p5"><rect x="24" y="152" width="112" height="46" rx="8" fill="var(--og-plate)" stroke="var(--og-edge)"/>
<rect x="36" y="169" width="9" height="12" rx="2" fill="var(--og-a3)"/>
<rect x="52" y="172" width="54" height="6" rx="3" fill="var(--og-a3)" opacity=".45"/></g>`,
        'Overlapping sheets of a project with one elevated file');
}

/** Scene 3 — the terminal, and the chip that floats above it. */
function artTerminal(): string {
    return svg(`
${disc(78, 60, 70, 'var(--og-a3)')}
<g class="og-plane og-p2"><rect class="og-blend" x="96" y="40" width="150" height="60" rx="8" fill="var(--og-a5)" opacity=".5" transform="rotate(4 171 70)"/></g>
<g class="og-plane og-p3"><rect x="60" y="52" width="150" height="26" rx="7" fill="none" stroke="var(--og-focal)" stroke-width="1.5" stroke-dasharray="5 4"/>
<rect x="72" y="61" width="52" height="8" rx="4" fill="var(--og-a3)"/>
<rect x="130" y="61" width="66" height="8" rx="4" fill="var(--og-dim)" opacity=".45"/></g>
${focalPlate(52, 96, 196, 96, `
<rect x="68" y="118" width="10" height="13" rx="2" fill="var(--og-a3)"/>
<rect x="86" y="121" width="58" height="7" rx="3.5" fill="var(--og-a3)" opacity=".8"/>
<rect x="150" y="121" width="12" height="13" rx="2" fill="var(--og-focal)" class="og-pulse"/>
<rect x="68" y="148" width="140" height="6" rx="3" fill="var(--og-dim)" opacity=".4"/>
<rect x="68" y="164" width="96" height="6" rx="3" fill="var(--og-dim)" opacity=".28"/>`)}`,
        'A terminal plate with a dashed guidance chip floating above it');
}

/** Scene 4 — Clyffy is beside the work, not in front of it. */
function artClyffy(): string {
    return svg(`
${disc(96, 74, 76, 'var(--og-a4)')}
<g class="og-plane og-p2"><circle class="og-blend" cx="196" cy="120" r="60" fill="var(--og-a5)" opacity=".45"/></g>
<g class="og-plane og-p3"><rect class="og-blend" x="34" y="120" width="128" height="72" rx="9" fill="var(--og-a1)" opacity=".38" transform="rotate(-4 98 156)"/></g>
${focalPlate(112, 52, 150, 108, `
<rect x="128" y="74" width="94" height="7" rx="3.5" fill="var(--og-a4)"/>
<rect x="128" y="92" width="118" height="6" rx="3" fill="var(--og-dim)" opacity=".5"/>
<rect x="128" y="108" width="76" height="6" rx="3" fill="var(--og-dim)" opacity=".35"/>
<circle cx="132" cy="134" r="4" fill="var(--og-a4)"/><circle cx="146" cy="134" r="4" fill="var(--og-a4)" opacity=".6"/>
<circle cx="160" cy="134" r="4" fill="var(--og-a4)" opacity=".3"/>`)}
<g class="og-plane og-p5"><rect x="42" y="150" width="86" height="8" rx="4" fill="var(--og-dim)" opacity=".35"/>
<rect x="42" y="168" width="58" height="8" rx="4" fill="var(--og-dim)" opacity=".22"/></g>`,
        'A speaking plate beside a quieter one');
}

/** Scene 5 — the ladder, with the rung you are on lit. */
function artLadder(): string {
    return svg(`
${disc(220, 58, 74)}
<g class="og-plane og-p2"><rect class="og-blend" x="40" y="158" width="200" height="20" rx="10" fill="var(--og-a5)" opacity=".5"/></g>
<g class="og-plane og-p3"><rect class="og-blend" x="52" y="128" width="176" height="20" rx="10" fill="var(--og-a4)" opacity=".55"/></g>
${focalPlate(64, 84, 152, 34, `
<rect x="80" y="96" width="10" height="10" rx="2" fill="var(--og-a3)"/>
<rect x="98" y="98" width="94" height="6" rx="3" fill="var(--og-focal)"/>`)}
<g class="og-plane og-p5"><rect x="76" y="56" width="128" height="18" rx="9" fill="none" stroke="var(--og-dim)" stroke-opacity=".4" stroke-dasharray="5 4"/>
<circle class="og-pulse" cx="248" cy="102" r="6" fill="var(--og-focal)"/></g>`,
        'Four ascending rungs with the current one elevated and lit');
}

export function walkthroughScenes(): WalkthroughScene[] {
    return [
        {
            id: 'welcome',
            title: nls.localize('ogun/walkthrough/welcome/title', 'This is Ogun. Nothing here can break.'),
            body: nls.localize(
                'ogun/walkthrough/welcome/body',
                // eslint-disable-next-line max-len
                'It is the same tool professionals use, arranged so it stops shouting at you. Five short steps and you will have opened a file, run a command, and met Clyffy. You can leave at any point — the door is always the button on the right.'
            ),
            actionLabel: nls.localizeByDefault('Start'),
            act: 'none',
            art: artWelcome()
        },
        {
            id: 'project',
            title: nls.localize('ogun/walkthrough/project/title', 'A project is a folder. A file is a page in it.'),
            body: nls.localize(
                'ogun/walkthrough/project/body',
                // eslint-disable-next-line max-len
                'Let me open the house rules that live in your workspace — the file Clyffy and every other AI reads before touching your work. Watch the middle of the screen: that is where files open.'
            ),
            actionLabel: nls.localize('ogun/walkthrough/project/action', 'Open it for me'),
            act: 'open-house-rules',
            art: artProject()
        },
        {
            id: 'terminal',
            title: nls.localize('ogun/walkthrough/terminal/title', 'The terminal is where you tell the machine things.'),
            body: nls.localize(
                'ogun/walkthrough/terminal/body',
                // eslint-disable-next-line max-len
                'I will show you a command floating above it and type along with you. Wrong keys do not count against you, and nothing turns red. When you are most of the way through, I fill in the rest.'
            ),
            actionLabel: nls.localize('ogun/walkthrough/terminal/action', 'Type it with me'),
            act: 'guide-list-files',
            art: artTerminal()
        },
        {
            id: 'clyffy',
            title: nls.localize('ogun/walkthrough/clyffy/title', 'Clyffy sits beside the work, not in front of it.'),
            body: nls.localize(
                'ogun/walkthrough/clyffy/body',
                // eslint-disable-next-line max-len
                'Ask in plain words. Clyffy can open files, run commands and explain what just happened — always visibly, in the panes you can see, so you learn the tool instead of being carried by it.'
            ),
            actionLabel: nls.localize('ogun/walkthrough/clyffy/action', 'Show me Clyffy'),
            act: 'reveal-clyffy',
            art: artClyffy()
        },
        {
            id: 'ladder',
            title: nls.localize('ogun/walkthrough/ladder/title', 'You are on the first rung, and nothing is locked.'),
            body: nls.localize(
                'ogun/walkthrough/ladder/body',
                // eslint-disable-next-line max-len
                'Guided keeps the machinery folded away until a lesson needs it. Everything advanced is still here — the command palette reaches all of it, and you can switch to the full workbench whenever you like from the View menu.'
            ),
            actionLabel: nls.localize('ogun/walkthrough/ladder/action', 'Finish'),
            act: 'none',
            art: artLadder()
        }
    ];
}
