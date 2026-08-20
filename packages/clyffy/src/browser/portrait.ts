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

/**
 * Clyffy's face.
 *
 * A companion the operator can see is a different thing from a chat panel that answers.
 * Role-playing games worked this out decades ago: put a portrait beside the words and the
 * player stops reading UI and starts listening to someone. That is exactly the shift we
 * want from a newcomer who is frightened of the terminal.
 *
 * So Clyffy is drawn, not iconified — a phosphor-screen head in the same Flat 2.0 language
 * as the walkthrough art, lit from the palette tokens so the lineage swap re-themes him
 * with no re-export. Every mood is the SAME head with a different face, which is what
 * makes him read as one character across the app rather than a set of icons.
 *
 * Nothing here is an image file. The portrait is markup, so it scales, themes, and
 * animates, and costs nothing to ship.
 */

/** The expressions Clyffy has. Each is the same head, re-faced — never a different head. */
export type ClyffyMood =
    | 'idle'      /** present, waiting, not demanding anything */
    | 'thinking'  /** working something out; the ember is busy */
    | 'acting'    /** hands on the keyboard, doing the thing he described */
    | 'pointing'  /** drawing attention to somewhere else on screen */
    | 'pleased';  /** the operator just did it themselves */

/**
 * Ink roles, so a mood never hardcodes a colour.
 *
 * Structural surfaces take STRUCTURAL tokens — `--og-plate` and `--og-ground` — never the
 * numbered accents. The accents carry meaning in this palette (`--og-a6` is trouble), so
 * borrowing one for a background paints the wrong thing in the wrong lineage: Clyffy's
 * screen came out alarm-pink the first time this rendered.
 */
const INK = {
    plate: 'var(--og-ground, #101119)',
    edge: 'var(--og-a2, #FF7A3D)',
    screen: 'var(--og-plate, #1B1E2C)',
    glow: 'var(--og-a1, #FFB000)',
    ember: 'var(--og-a2, #FF7A3D)',
    body: 'var(--og-a4, #6C8CFF)'
};

/**
 * The eyes carry the whole performance, so they are the only part a mood may redraw.
 * Rounded bars read as awake; arcs read as warm; a narrowed pair reads as concentrating.
 */
function eyes(mood: ClyffyMood): string {
    const bar = (x: number, height: number, y = 46) =>
        `<rect x="${x}" y="${y}" width="9" height="${height}" rx="4.5" fill="${INK.glow}"/>`;
    switch (mood) {
        case 'thinking':
            // Looking up and away — the universal shape of working something out.
            return `${bar(40, 14, 44)}${bar(63, 9, 47)}`;
        case 'acting':
            // Narrowed: concentrating on the keys, not on you.
            return `${bar(38, 7, 50)}${bar(63, 7, 50)}`;
        case 'pointing':
            // Both eyes thrown to one side; you follow a gaze before you follow an arrow.
            return `${bar(46, 13, 46)}${bar(68, 13, 46)}`;
        case 'pleased':
            return `<path d="M38 54 q6 -9 12 0" stroke="${INK.glow}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`
                + `<path d="M63 54 q6 -9 12 0" stroke="${INK.glow}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
        default:
            return `${bar(40, 13)}${bar(66, 13)}`;
    }
}

function mouth(mood: ClyffyMood): string {
    switch (mood) {
        case 'pleased':
            return `<path d="M48 72 q10 10 20 0" stroke="${INK.glow}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".95"/>`;
        case 'acting':
            // A flat line: he is not talking, he is typing.
            return `<rect x="50" y="71" width="16" height="4" rx="2" fill="${INK.glow}" opacity=".7"/>`;
        case 'thinking':
            return `<rect x="52" y="71" width="9" height="4" rx="2" fill="${INK.glow}" opacity=".55"/>`;
        default:
            return `<path d="M49 70 q9 7 18 0" stroke="${INK.glow}" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".8"/>`;
    }
}

/** The ember on the antenna — Ogun's fire, and Clyffy's only idle animation. */
function ember(mood: ClyffyMood): string {
    const busy = mood === 'thinking' || mood === 'acting';
    return `<g class="og-clyffy-antenna">
<rect x="58" y="12" width="3" height="12" rx="1.5" fill="${INK.edge}" opacity=".8"/>
<circle class="og-clyffy-ember${busy ? ' og-busy' : ''}" cx="59.5" cy="10" r="5" fill="${INK.ember}"/>
</g>`;
}

/**
 * The anvil behind him — Ogun's tool, screened back so it reads as a crest rather than a
 * second subject. It is the one place the portrait says whose software this is.
 */
const ANVIL = `<g opacity=".16">
<path d="M24 104 h72 v6 h-72 z" fill="${INK.body}"/>
<path d="M34 88 h52 l-8 12 h-36 z" fill="${INK.body}"/>
</g>`;

/** Scanlines: the honest CRT tell, one definition per portrait. */
function scan(uid: string): string {
    return `<defs><pattern id="${uid}" width="3" height="3" patternUnits="userSpaceOnUse">
<rect width="3" height="1" fill="#ffffff" opacity=".06"/></pattern></defs>`;
}

let counter = 0;

/**
 * Clyffy, as inline SVG markup.
 *
 * @param mood which face to wear
 * @param title the accessible name — a portrait with no name is decoration to a screen reader
 */
export function clyffyPortrait(mood: ClyffyMood = 'idle', title = 'Clyffy'): string {
    // Pattern ids are document-global; two portraits on screen would otherwise share one.
    const uid = `ogScan${counter++}`;
    return `<svg class="og-clyffy og-mood-${mood}" viewBox="0 0 120 120" role="img" aria-label="${title}">
${scan(uid)}
<rect x="6" y="6" width="108" height="108" rx="14" fill="${INK.plate}"/>
${ANVIL}
<g class="og-clyffy-head">
  <rect x="26" y="24" width="68" height="64" rx="16" fill="${INK.plate}" stroke="${INK.edge}" stroke-width="2.5"/>
  <rect x="33" y="31" width="54" height="50" rx="11" fill="${INK.screen}"/>
  <rect x="33" y="31" width="54" height="50" rx="11" fill="url(#${uid})"/>
  ${eyes(mood)}
  ${mouth(mood)}
</g>
${ember(mood)}
<rect x="40" y="92" width="40" height="8" rx="4" fill="${INK.body}" opacity=".55"/>
</svg>`;
}
