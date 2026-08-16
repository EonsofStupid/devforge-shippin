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

import { inject, injectable } from '@theia/core/shared/inversify';
import { WebForgeChannelClient, WebForgeChannelService } from '../common/webforge-channel-protocol';
import { WebForgeEventTape } from './webforge-event-tape';

/**
 * Backend half of the channels: keeps the RPC client (the connected frontend) and
 * hands it to the HTTP endpoint. One frontend per backend process in WebForge's
 * per-operator instance model, so a single client reference is the honest shape.
 */
@injectable()
export class WebForgeChannelServiceImpl implements WebForgeChannelService {

    @inject(WebForgeEventTape)
    protected readonly tape: WebForgeEventTape;

    protected client: WebForgeChannelClient | undefined;

    setClient(client: WebForgeChannelClient | undefined): void {
        this.client = client;
    }

    getClient(): WebForgeChannelClient | undefined {
        return this.client;
    }

    async reportGuideEvent(type: 'guide.completed' | 'guide.abandoned', data: { command: string; typedRatio: number }): Promise<void> {
        const clamped = Math.max(0, Math.min(1, Number(data?.typedRatio) || 0));
        this.tape.emit(type, { command: String(data?.command ?? '').slice(0, 300), typedRatio: clamped });
    }
}
