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

import { Provenance } from './webforge-provenance';

/**
 * The WebForge runtime-event catalog.
 *
 * Events are **declared, not invented**. Anything emitting a name that isn't in the
 * catalog is a bug we can see, and every declared event carries its plane, its meaning
 * and the shape of its payload — so an AI reading the tape never has to infer what a
 * row means, and new events can be added by declaration rather than by convention.
 *
 * Names are `<plane>.<noun>.<verb>` and become CloudEvents types under the instance's
 * platform-scoped source (`io.shippin.webforge/<operator>`). This is the same envelope
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
export const WEBFORGE_EVENT_CATALOG: RuntimeEventDescriptor[] = [
    // ── act ───────────────────────────────────────────────────────────────────
    { name: 'act.file.opened', plane: 'act', description: 'A file was opened in an editor.', fields: ['path', 'line'] },
    { name: 'act.file.changed', plane: 'act', description: 'A file was edited.', fields: ['path', 'added', 'removed'] },
    { name: 'act.command.executed', plane: 'act', description: 'A workbench command ran.', fields: ['command', 'args'] },
    { name: 'act.terminal.typed', plane: 'act', description: 'Text was typed into a terminal.', fields: ['terminal', 'chars', 'submitted'] },
    { name: 'act.surface.set', plane: 'act', description: 'A surface value was set (input, setting, toggle).', fields: ['surface', 'kind', 'chars'] },
    { name: 'act.surface.focused', plane: 'act', description: 'A surface was focused.', fields: ['surface', 'kind'] },
    { name: 'act.surface.invoked', plane: 'act', description: 'A surface was invoked (button, command, submit).', fields: ['surface', 'kind'] },
    { name: 'act.setting.changed', plane: 'act', description: 'A preference changed.', fields: ['key', 'scope'] },
    { name: 'act.notice.shown', plane: 'act', description: 'A message was shown to the operator.', fields: ['chars', 'kind'] },

    // ── sense ─────────────────────────────────────────────────────────────────
    { name: 'sense.state.read', plane: 'sense', description: 'The workbench state snapshot was read.', fields: ['editors', 'terminals'] },
    { name: 'sense.surface.listed', plane: 'sense', description: 'The surface registry was enumerated.', fields: ['count', 'filter'] },

    // ── teach ─────────────────────────────────────────────────────────────────
    { name: 'teach.guide.shown', plane: 'teach', description: 'A guided command was offered.', fields: ['command', 'chars'] },
    // eslint-disable-next-line max-len
    { name: 'teach.guide.completed', plane: 'teach', description: 'A guided command was completed; typedRatio is what the learner typed by hand.', fields: ['command', 'typedRatio'] },
    { name: 'teach.guide.abandoned', plane: 'teach', description: 'A guided command was left unfinished.', fields: ['command', 'typedRatio'] },
    { name: 'teach.walkthrough.started', plane: 'teach', description: 'The guided walkthrough opened.', fields: ['scene', 'index', 'total'] },
    { name: 'teach.walkthrough.scene', plane: 'teach', description: 'A walkthrough scene was shown.', fields: ['scene', 'index', 'total'] },
    { name: 'teach.walkthrough.completed', plane: 'teach', description: 'The walkthrough was finished.', fields: ['scene', 'index', 'total'] },
    { name: 'teach.walkthrough.skipped', plane: 'teach', description: 'The walkthrough was left early.', fields: ['scene', 'index', 'total'] },

    // ── state ─────────────────────────────────────────────────────────────────
    { name: 'state.workbench.ready', plane: 'state', description: 'The workbench finished starting.', fields: ['perspective'] },
    { name: 'state.perspective.changed', plane: 'state', description: 'The active perspective changed.', fields: ['perspective'] },
    { name: 'state.layer.changed', plane: 'state', description: 'The operator moved between the simplified and the full layer.', fields: ['layer'] }
];

export namespace WebForgeEvents {
    const byName = new Map(WEBFORGE_EVENT_CATALOG.map(d => [d.name, d]));

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

    export function isDeclared(name: string): boolean {
        return byName.has(name);
    }
}
