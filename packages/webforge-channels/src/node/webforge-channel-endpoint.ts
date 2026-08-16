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

import { ILogger } from '@theia/core';
import { inject, injectable, named } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import * as express from '@theia/core/shared/express';
import { WebForgeChannelServiceImpl } from './webforge-channel-service-impl';

/**
 * The HTTP face of the WebForge channels: `POST /webforge/channel`.
 *
 * Authorization is a bearer token from the `WEBFORGE_CHANNEL_TOKEN` environment
 * variable — minted per instance by the hosting plane (forgemaster), the same
 * mechanical-trust discipline as every other channel in the family. If the variable
 * is unset the endpoint stays dark (503) rather than open.
 *
 * Ops (typed in webforge-channel-protocol.ts):
 *   { op: 'app.open',      path, line? }
 *   { op: 'terminal.type', text, submit? }
 *   { op: 'notify',        text, kind? }
 *   { op: 'state.get' }
 */
@injectable()
export class WebForgeChannelEndpoint implements BackendApplicationContribution {

    @inject(WebForgeChannelServiceImpl)
    protected readonly service: WebForgeChannelServiceImpl;

    @inject(ILogger) @named('webforge-channels')
    protected readonly logger: ILogger;

    configure(app: express.Application): void {
        app.post('/webforge/channel', express.json(), async (req, res) => {
            const token = (process.env.WEBFORGE_CHANNEL_TOKEN || '').trim();
            if (!token || token.length < 16) {
                res.status(503).json({ error: 'channels dark: WEBFORGE_CHANNEL_TOKEN is not configured on this instance' });
                return;
            }
            if (req.headers.authorization !== `Bearer ${token}`) {
                res.status(401).json({ error: 'unauthorized' });
                return;
            }
            const client = this.service.getClient();
            if (!client) {
                res.status(409).json({ error: 'no frontend attached — open the WebForge tab in a browser' });
                return;
            }
            const body = req.body ?? {};
            try {
                switch (body.op) {
                    case 'app.open': {
                        const result = await client.openFile(String(body.path ?? ''), typeof body.line === 'number' ? body.line : undefined);
                        res.json(result);
                        return;
                    }
                    case 'terminal.type': {
                        const result = await client.terminalType(String(body.text ?? ''), body.submit === true);
                        res.json(result);
                        return;
                    }
                    case 'notify': {
                        const result = await client.notify(String(body.text ?? ''), body.kind === 'warn' ? 'warn' : 'info');
                        res.json(result);
                        return;
                    }
                    case 'state.get': {
                        res.json(await client.getState());
                        return;
                    }
                    default: {
                        res.status(400).json({ error: `unknown op '${body.op}' — legal: app.open, terminal.type, notify, state.get` });
                        return;
                    }
                }
            } catch (error) {
                this.logger.error('[webforge-channels] op failed', error);
                res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
            }
        });
    }
}
