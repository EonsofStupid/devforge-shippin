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
 * Surfaces — every part of the application, addressable.
 *
 * A surface is anything an operator can touch: a text input, a preference, a command,
 * a panel, an editor, a terminal. Each carries a stable address and a declared set of
 * capabilities, so Clyffy drives the application the way a person does — by finding the
 * thing and using it — instead of by screenshot-guessing or by a bespoke op per feature.
 *
 * The registry is the reason this scales: a new feature contributes surfaces and is
 * immediately drivable, with no new channel ops and no new AI instructions.
 */

export type SurfaceKind =
    | 'input'      /** a text field the operator types into */
    | 'setting'    /** a preference */
    | 'command'    /** an invocable workbench command */
    | 'view'       /** a panel or widget */
    | 'editor'     /** an open text editor */
    | 'terminal'   /** a terminal pane */
    | 'preview';   /** the running application */

export type SurfaceCapability =
    | 'read'    /** the value can be read */
    | 'set'     /** the value can be replaced */
    | 'type'    /** text can be typed into it, keystroke by keystroke */
    | 'focus'   /** it can be brought to the operator's attention */
    | 'invoke'; /** it can be triggered */

export interface SurfaceDescriptor {
    /** Stable address, e.g. `setting:editor.fontSize`, `input:chat.prompt`, `command:workbench.action.files.save`. */
    id: string;
    kind: SurfaceKind;
    /** What a human would call it. */
    label: string;
    /** Where it lives, for orientation: `right`, `main`, `bottom`, `settings`, `palette`. */
    area?: string;
    capabilities: SurfaceCapability[];
    /** Present on `read` surfaces when listed with values. Truncated for large values. */
    value?: string;
    /** One line of help, so an AI need not infer intent from the label alone. */
    description?: string;
}

export interface SurfaceQuery {
    kind?: SurfaceKind;
    /** Case-insensitive substring match against id and label. */
    match?: string;
    /** Cap the result; the registry can hold thousands of settings. */
    limit?: number;
    /** Include current values (costs a read per surface). */
    withValues?: boolean;
}

export interface SurfaceActionResult {
    surface: string;
    ok: boolean;
    /** The value after the action, when the surface can be read back. */
    value?: string;
    detail?: string;
}
