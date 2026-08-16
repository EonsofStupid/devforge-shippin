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

import { Emitter, Event, ILogger } from '@theia/core';
import { inject, injectable, named } from '@theia/core/shared/inversify';
import { Actor, Provenance } from '../common/webforge-provenance';
import { RuntimeEvent, WebForgeEvents } from '../common/webforge-runtime-events';
import { WebForgeRuntimeSink } from '../common/webforge-runtime-protocol';

/**
 * The runtime bus: one place every plane reports through.
 *
 * Two jobs. It **attributes** — whatever is running inside `as(actor, …)` is recorded
 * as that actor, so an act Clyffy performed is never mistaken for the operator's, and
 * nested acts inherit the causal chain without anyone threading a parameter through.
 * And it **guards the catalog** — an undeclared event name is a loud warning rather
 * than a silent new row, which is what keeps the tape readable as this grows.
 */
@injectable()
export class WebForgeRuntimeBus {

    @inject(ILogger) @named('webforge-runtime')
    protected readonly logger: ILogger;

    /** Set by the frontend module once the RPC proxy exists. */
    sink: WebForgeRuntimeSink | undefined;

    protected readonly onEventEmitter = new Emitter<RuntimeEvent>();
    /** Local subscribers — provenance views, the chat's route awareness, tests. */
    readonly onEvent: Event<RuntimeEvent> = this.onEventEmitter.event;

    /** The actor stack. The operator is the floor: unattributed work is the human's. */
    protected readonly stack: Provenance[] = [];
    protected chainCounter = 0;

    protected current(): Provenance {
        return this.stack[this.stack.length - 1]
            ?? { actor: Actor.OPERATOR, chain: 'operator' };
    }

    /** A fresh causal chain id. Monotonic per session; correlates one intent's acts. */
    newChain(prefix = 'chain'): string {
        this.chainCounter++;
        return `${prefix}-${this.chainCounter}`;
    }

    /**
     * Run `work` attributed to `actor`. Acts emitted inside — including ones raised deep
     * in Theia by a command this triggers — are recorded as that actor's, with a shared
     * chain, and the scope unwinds even if the work throws.
     */
    async as<T>(actor: Actor, reason: string, work: () => Promise<T>, chain?: string): Promise<T> {
        this.stack.push({ actor, chain: chain ?? this.newChain(actor.kind), reason });
        try {
            return await work();
        } finally {
            this.stack.pop();
        }
    }

    /** The actor an act would currently be attributed to. */
    get actor(): Actor {
        return this.current().actor;
    }

    /** Emit a declared runtime event. Undeclared names are recorded but reported. */
    emit(name: string, data: Record<string, unknown> = {}): void {
        const descriptor = WebForgeEvents.get(name);
        if (!descriptor) {
            this.logger.warn(`[webforge-runtime] undeclared event '${name}' — declare it in the catalog`);
        }
        const event: RuntimeEvent = {
            name,
            plane: descriptor?.plane ?? 'act',
            provenance: this.current(),
            data
        };
        this.onEventEmitter.fire(event);
        this.sink?.record(event).then(undefined, () => { /* tape unavailable — the act still happened */ });
    }
}
