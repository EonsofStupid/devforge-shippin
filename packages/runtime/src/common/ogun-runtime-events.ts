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

import { Provenance } from './ogun-provenance';

/**
 * The Ogun runtime-event catalog.
 *
 * Events are **declared, not invented**. Anything emitting a name that isn't in the
 * catalog is a bug we can see, and every declared event carries its plane, its meaning
 * and the shape of its payload — so an AI reading the tape never has to infer what a
 * row means, and new events can be added by declaration rather than by convention.
 *
 * Names are `<plane>.<noun>.<verb>` and become CloudEvents types under the instance's
 * platform-scoped source (`io.shippin.ogun/<operator>`). This is the same envelope
 * the mesh carries later, so nothing here has to be reshaped to leave the machine.
 */

/** The planes an event can belong to. The plane answers "what kind of thing happened". */
export type EventPlane =
    /** Something changed the world. */
    | 'act'
    /** Something was observed or read. Sensing never wakes its own tape as an act. */
    | 'sense'
    /** A teaching moment: guidance shown, taken, abandoned. */
    | 'teach'
    /** The application's own lifecycle and shape. */
    | 'state';

export interface RuntimeEventDescriptor {
    /** Catalog name, `<plane>.<noun>.<verb>`. */
    name: string;
    plane: EventPlane;
    /** One line, written for whoever reads the tape — including an AI. */
    description: string;
    /**
     * The same event said out loud, to the person it happened to.
     *
     * `{field}` is replaced from the payload. This is the difference between a tape only
     * a machine can read and a record the operator can watch scroll past: `description`
     * explains the event to whoever is debugging the system, `sentence` explains it to
     * whoever is sitting in front of it. An act without one cannot be shown in the chat,
     * which is deliberate — if we cannot say plainly what Clyffy just did, we should not
     * be doing it behind their back.
     */
    sentence?: string;
    /** Payload field names, in the order a reader should think about them. */
    fields: string[];
}

export interface RuntimeEvent {
    name: string;
    plane: EventPlane;
    provenance: Provenance;
    data: Record<string, unknown>;
}

/**
 * The predefined catalog. It is expected to grow; growth means adding a declaration
 * here (or registering one at runtime), never emitting an undeclared name.
 */
export const OGUN_EVENT_CATALOG: RuntimeEventDescriptor[] = [
    // ── act ───────────────────────────────────────────────────────────────────
    { name: 'act.file.opened', plane: 'act', description: 'A file was opened in an editor.', sentence: 'Opened {path}', fields: ['path', 'line'] },
    { name: 'act.file.changed', plane: 'act', description: 'A file was edited.', sentence: 'Edited {path}', fields: ['path', 'added', 'removed'] },
    { name: 'act.command.executed', plane: 'act', description: 'A workbench command ran.', sentence: 'Ran the {command} command', fields: ['command', 'args'] },
    {
        name: 'act.terminal.typed', plane: 'act',
        description: 'Text was typed into a terminal.',
        sentence: 'Typed {chars} characters in the terminal', fields: ['terminal', 'chars', 'submitted']
    },
    {
        name: 'act.surface.set', plane: 'act',
        description: 'A surface value was set (input, setting, toggle).',
        sentence: 'Changed {surface}', fields: ['surface', 'kind', 'chars']
    },
    { name: 'act.surface.focused', plane: 'act', description: 'A surface was focused.', sentence: 'Pointed at {surface}', fields: ['surface', 'kind'] },
    { name: 'act.surface.invoked', plane: 'act', description: 'A surface was invoked (button, command, submit).', sentence: 'Used {surface}', fields: ['surface', 'kind'] },
    { name: 'act.setting.changed', plane: 'act', description: 'A preference changed.', sentence: 'Changed the {key} setting to {value}', fields: ['key', 'scope'] },
    { name: 'act.notice.shown', plane: 'act', description: 'A message was shown to the operator.', sentence: 'Left you a note', fields: ['chars', 'kind'] },
    { name: 'act.preview.opened', plane: 'act', description: 'The running application was put on screen.', sentence: 'Opened a preview of your app', fields: ['url'] },
    { name: 'act.preview.navigated', plane: 'act', description: 'The preview was pointed at a different URL.', sentence: 'Moved the preview to {url}', fields: ['url'] },

    // ── sense ─────────────────────────────────────────────────────────────────
    { name: 'sense.state.read', plane: 'sense', description: 'The workbench state snapshot was read.', fields: ['editors', 'terminals'] },
    { name: 'sense.surface.listed', plane: 'sense', description: 'The surface registry was enumerated.', fields: ['count', 'filter'] },

    // ── teach ─────────────────────────────────────────────────────────────────
    { name: 'teach.guide.shown', plane: 'teach', description: 'A guided command was offered.', sentence: 'Offered you a command to type: {command}', fields: ['command', 'chars'] },
    // eslint-disable-next-line max-len
    {
        name: 'teach.guide.completed', plane: 'teach',
        description: 'A guided command was completed; typedRatio is what the learner typed by hand.',
        sentence: 'You typed {command} yourself', fields: ['command', 'typedRatio']
    },
    {
        name: 'teach.guide.abandoned', plane: 'teach',
        description: 'A guided command was left unfinished.',
        sentence: 'Set aside the command {command}', fields: ['command', 'typedRatio']
    },
    { name: 'teach.walkthrough.started', plane: 'teach', description: 'The guided walkthrough opened.', sentence: 'Started the walkthrough', fields: ['scene', 'index', 'total'] },
    { name: 'teach.walkthrough.scene', plane: 'teach', description: 'A walkthrough scene was shown.', sentence: 'Walkthrough step {index}', fields: ['scene', 'index', 'total'] },
    {
        name: 'teach.walkthrough.completed', plane: 'teach',
        description: 'The walkthrough was finished.',
        sentence: 'You finished the walkthrough', fields: ['scene', 'index', 'total']
    },
    { name: 'teach.walkthrough.skipped', plane: 'teach', description: 'The walkthrough was left early.', sentence: 'Left the walkthrough', fields: ['scene', 'index', 'total'] },

    // ── state ─────────────────────────────────────────────────────────────────
    { name: 'state.workbench.ready', plane: 'state', description: 'The workbench finished starting.', sentence: 'The workbench is ready', fields: ['perspective'] },
    { name: 'state.perspective.changed', plane: 'state', description: 'The active perspective changed.', sentence: 'Rearranged the workbench', fields: ['perspective'] },
    {
        name: 'state.layer.changed', plane: 'state',
        description: 'The operator moved between the simplified and the full layer.',
        sentence: 'Switched to the {layer} view', fields: ['layer']
    },
    // eslint-disable-next-line max-len
    {
        name: 'state.devserver.detected', plane: 'state',
        description: 'A dev server announced itself in a terminal; the preview follows automatically.',
        sentence: 'Noticed your app is running on port {port}', fields: ['port']
    }
];

export namespace OgunEvents {
    const byName = new Map(OGUN_EVENT_CATALOG.map(d => [d.name, d]));

    export function get(name: string): RuntimeEventDescriptor | undefined {
        return byName.get(name);
    }

    export function all(): RuntimeEventDescriptor[] {
        return [...byName.values()];
    }

    /** Register an event the catalog didn't ship with. Growth is declaration, not drift. */
    export function declare(descriptor: RuntimeEventDescriptor): void {
        byName.set(descriptor.name, descriptor);
    }

    /**
     * Say what happened, to the person it happened to.
     *
     * Returns undefined when the event has no sentence — the caller must then show
     * nothing rather than inventing prose or dumping the raw name. A record the operator
     * cannot read is not transparency, it is noise wearing transparency's clothes.
     */
    export function humanize(event: { name: string; data?: Record<string, unknown> }): string | undefined {
        const template = get(event.name)?.sentence;
        if (!template) {
            return undefined;
        }
        return template.replace(/\{(\w+)\}/g, (whole, field) => {
            const value = event.data?.[field];
            return value === undefined || value === '' ? whole : String(value);
        });
    }

    export function isDeclared(name: string): boolean {
        return byName.has(name);
    }
}
