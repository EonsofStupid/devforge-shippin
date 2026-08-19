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
 * Provenance — who did this, and what caused it.
 *
 * Every act in WebForge is attributable. Not for audit theatre: it is what lets the
 * operator ask "why is this file open?" and get a real answer, what lets Clyffy read
 * back its own effects without guessing, and what keeps an AI's work distinguishable
 * from a human's when both are typing into the same workbench.
 *
 * Actor addresses follow the Clyffy scheme (see `docs/CLYFFY-ORCHESTRATION.md`):
 * one user-facing name, a precise internal address that never appears in the UI.
 */

/** Who performed an act. */
export interface Actor {
    kind: 'operator' | 'clyffy' | 'channel' | 'plugin' | 'system';
    /**
     * Precise internal address. For Clyffy: `clyffy/<scope>/<role>`. For channels: the
     * caller identity the endpoint authenticated. Never rendered in the UI.
     */
    address: string;
    /** What a human should be told, if anything is shown at all. */
    label?: string;
}

export namespace Actor {
    /** The person at the keyboard. The default, and the one we never mislabel. */
    export const OPERATOR: Actor = { kind: 'operator', address: 'operator/self', label: 'You' };
    export const SYSTEM: Actor = { kind: 'system', address: 'webforge/system', label: 'WebForge' };

    export function clyffy(role = 'prime', scope = 'platform'): Actor {
        return { kind: 'clyffy', address: `clyffy/${scope}/${role}`, label: 'Clyffy' };
    }

    export function channel(caller: string): Actor {
        return { kind: 'channel', address: `channel/${caller}`, label: 'Clyffy' };
    }

    export function is(candidate: unknown): candidate is Actor {
        const value = candidate as Actor;
        return !!value && typeof value.address === 'string' && typeof value.kind === 'string';
    }
}

/**
 * The causal chain. `cause` is the id of the act that led to this one, so a lesson, a
 * chat turn, or a channel request can be reassembled from the tape without heuristics.
 */
export interface Provenance {
    actor: Actor;
    /** Correlates every act produced by one intent. */
    chain: string;
    /** The immediately preceding act in the chain, if any. */
    cause?: string;
    /** Free-form, operator-readable reason. Kept short; shown in provenance views. */
    reason?: string;
}

export namespace Provenance {
    export function of(actor: Actor, chain: string, reason?: string, cause?: string): Provenance {
        return { actor, chain, reason, cause };
    }
}
