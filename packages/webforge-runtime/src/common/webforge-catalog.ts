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

import { SurfaceDanger, SurfaceZone } from './webforge-surfaces';

/**
 * What we know about a surface beyond what the workbench itself declares.
 *
 * A workbench command knows its id and its label. It does not know whether running it
 * throws away the operator's work, nor how to explain itself to someone who has never
 * used an IDE. That knowledge is the catalog's, and it is the same knowledge whether it
 * is rendered as a tooltip or handed to Clyffy.
 */
export interface CatalogHint {
    /** One plain-language line: what it does, in the operator's words. */
    description?: string;
    danger?: SurfaceDanger;
    zone?: SurfaceZone;
}

/**
 * Verbs that say plainly the thing destroys something.
 *
 * A heuristic, not a security boundary: it exists so that thousands of contributed
 * commands get a sane default label without anyone hand-writing an entry for each. An
 * explicit hint always wins over this.
 */
const DESTRUCTIVE = /\b(delete|remove|clear|reset|revert|discard|uninstall|trash|destroy|kill|purge|clean|wipe)\b/i;

/** Verbs that change the world in a way the operator would want to know about. */
const CAUTION = new RegExp(
    '\\b(install|publish|push|commit|stage|rename|move|create|new|write|save|format|close'
    + '|restart|reload|run|start|stop|apply|replace|merge|rebase|checkout|import|export)\\b', 'i');

/**
 * Word boundaries have to survive both naming worlds the workbench mixes: dotted command
 * ids (`debug.breakpoint.removeAll`) and human labels ("Remove All Breakpoints"). Split
 * camelCase and turn separators into spaces, and one `\b` pattern then reads both.
 */
function words(id: string, label?: string): string {
    return `${id} ${label ?? ''}`.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._:\-/]+/g, ' ');
}

export function classifyDanger(id: string, label?: string): SurfaceDanger {
    const text = words(id, label);
    if (DESTRUCTIVE.test(text)) {
        return 'destructive';
    }
    if (CAUTION.test(text)) {
        return 'caution';
    }
    return 'safe';
}
