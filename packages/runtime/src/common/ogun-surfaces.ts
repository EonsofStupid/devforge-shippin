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
 * a menu item, a toolbar button, a panel, an editor, a terminal. Each carries a stable
 * address and a declared set of capabilities, so Clyffy drives the application the way a
 * person does — by finding the thing and using it — instead of by screenshot-guessing or
 * by a bespoke op per feature.
 *
 * The registry is the reason this scales: a new feature contributes surfaces and is
 * immediately drivable, with no new channel ops and no new AI instructions.
 *
 * This file is the **catalog schema**, and it is deliberately shared with the local
 * DevForge seam (`devforge/ops/channel`) rather than being Ogun's private vocabulary.
 * One description, written once, is both the tooltip a person reads and the sentence the
 * AI reads: that is the whole trick, and it only works if there is one schema.
 */

/**
 * The kinds, in one place, so the address parser and the type can never drift apart.
 */
export const SURFACE_KINDS = [
    'input',      /** a text field the operator types into */
    'setting',    /** a preference */
    'command',    /** an invocable workbench command */
    'menu',       /** an entry in a menu, addressed by its menu path */
    'button',     /** a toolbar button on a view or editor */
    'view',       /** a panel or widget */
    'editor',     /** an open text editor */
    'terminal',   /** a terminal pane */
    'preview'     /** the running application */
] as const;

export type SurfaceKind = (typeof SURFACE_KINDS)[number];

/**
 * Where a surface lives, in the words an operator would use pointing at the screen.
 *
 * Shared with the local seam's UI zones so that "the thing in the sidebar" means the same
 * thing to Clyffy in both products.
 */
export const SURFACE_ZONES = [
    'menubar',    /** the application menu */
    'toolbar',    /** a view's or editor's title-bar actions */
    'activity',   /** the far-left icon bar */
    'sidebar',    /** the left panel */
    'secondary',  /** the right panel, where chat lives */
    'editor',     /** the editing area */
    'panel',      /** the bottom panel */
    'terminal',
    'scm',
    'status',     /** the status bar */
    'palette',    /** reachable only through the command palette */
    'settings',
    'main'
] as const;

export type SurfaceZone = (typeof SURFACE_ZONES)[number];

/**
 * How much damage using this surface could do.
 *
 * Not a permission system — a labelling system. It lets the simplified layer soften what
 * it shows a newcomer, and lets Clyffy say "this one deletes things" before it acts.
 */
export type SurfaceDanger =
    | 'safe'         /** reversible, or no effect on the operator's work */
    | 'caution'      /** changes files, settings, or the running world */
    | 'destructive'; /** discards work, deletes, or resets */

export type SurfaceCapability =
    | 'read'    /** the value can be read */
    | 'set'     /** the value can be replaced */
    | 'type'    /** text can be typed into it, keystroke by keystroke */
    | 'focus'   /** it can be brought to the operator's attention */
    | 'invoke'; /** it can be triggered */

export interface SurfaceDescriptor {
    /** Stable address, e.g. `setting:editor.fontSize`, `menu:menubar/file/file.save`. */
    id: string;
    kind: SurfaceKind;
    /** What a human would call it. */
    label: string;
    /** Where it lives, for orientation. */
    zone?: SurfaceZone;
    capabilities: SurfaceCapability[];
    /** Present on `read` surfaces when listed with values. Truncated for large values. */
    value?: string;
    /**
     * One plain-language line: what this does and why you would use it.
     *
     * The same sentence is rendered as the operator's tooltip. Write it for the person;
     * the AI gets the same help the human does, which is the point.
     */
    description?: string;
    /** Defaults to `safe` when a provider does not classify. */
    danger?: SurfaceDanger;
    /** False when the surface exists but cannot currently be used (a disabled button). */
    enabled?: boolean;
    /** For menus: the address of the containing menu, so a client can walk the tree. */
    parent?: string;
}

export interface SurfaceQuery {
    kind?: SurfaceKind;
    /** Case-insensitive substring match against id and label. */
    match?: string;
    /** Cap the result; the registry can hold thousands of settings. */
    limit?: number;
    /** Include current values (costs a read per surface). */
    withValues?: boolean;
    /** Restrict to one zone — "what can I do in the sidebar". */
    zone?: SurfaceZone;
    /** Only surfaces at or below this danger level. `safe` hides anything that bites. */
    maxDanger?: SurfaceDanger;
    /** For `menu`: list only the direct children of this address. Omit for the roots. */
    parent?: string;
}

export interface SurfaceActionResult {
    surface: string;
    ok: boolean;
    /** The value after the action, when the surface can be read back. */
    value?: string;
    detail?: string;
}

/** Ordered least to most dangerous, so `maxDanger` is a simple comparison. */
export const DANGER_ORDER: readonly SurfaceDanger[] = ['safe', 'caution', 'destructive'];

export function dangerExceeds(danger: SurfaceDanger | undefined, ceiling: SurfaceDanger): boolean {
    return DANGER_ORDER.indexOf(danger ?? 'safe') > DANGER_ORDER.indexOf(ceiling);
}
