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
import { WebForgeEvents } from '@theia/webforge-runtime/lib/common/webforge-runtime-events';
import { DANGER_ORDER, SURFACE_KINDS, SURFACE_ZONES } from '@theia/webforge-runtime/lib/common/webforge-surfaces';
import { WebForgeRuntimeTape } from '@theia/webforge-runtime/lib/node/webforge-runtime-tape';
import { WebForgeChannelServiceImpl } from './webforge-channel-service-impl';

/** How long an op waits on the attached frontend before it is declared lapsed. */
const FRONTEND_TIMEOUT_MS = 8000;

class FrontendTimeout extends Error {
    constructor() {
        super('the attached frontend did not answer — reload the WebForge tab');
    }
}

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
 *   { op: 'guide.type',    command, note?, threshold? }
 *   { op: 'state.get' }
 */
@injectable()
export class WebForgeChannelEndpoint implements BackendApplicationContribution {

    @inject(WebForgeChannelServiceImpl)
    protected readonly service: WebForgeChannelServiceImpl;

    @inject(ILogger) @named('webforge-channels')
    protected readonly logger: ILogger;

    @inject(WebForgeRuntimeTape)
    protected readonly tape: WebForgeRuntimeTape;

    /**
     * A client proxy left behind by a tab that has since gone away never rejects — the RPC
     * call simply waits forever and the whole channel wedges. Every op is therefore bounded:
     * a lapsed frontend answers as a timeout instead of hanging the caller.
     */
    protected async withFrontend<T>(work: Promise<T>, timeoutMs = FRONTEND_TIMEOUT_MS): Promise<T> {
        let timer: NodeJS.Timeout | undefined;
        try {
            return await Promise.race([
                work,
                new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(() => reject(new FrontendTimeout()), timeoutMs);
                })
            ]);
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }

    /** Real typing is deliberately slow; the deadline has to allow for the whole phrase. */
    protected typingBudget(text: string): number {
        return Math.max(FRONTEND_TIMEOUT_MS, text.length * 220 + 5000);
    }

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
                        const result = await this.withFrontend(client.openFile(String(body.path ?? ''), typeof body.line === 'number' ? body.line : undefined));
                        res.json(result);
                        return;
                    }
                    case 'terminal.type': {
                        const result = await this.withFrontend(client.terminalType(String(body.text ?? ''), body.submit === true));
                        res.json(result);
                        return;
                    }
                    case 'notify': {
                        const result = await this.withFrontend(client.notify(String(body.text ?? ''), body.kind === 'warn' ? 'warn' : 'info'));
                        res.json(result);
                        return;
                    }
                    case 'guide.type': {
                        const command = String(body.command ?? '');
                        const note = typeof body.note === 'string' ? body.note : undefined;
                        const threshold = typeof body.threshold === 'number' ? body.threshold : undefined;
                        const result = await this.withFrontend(client.guideType(command, note, threshold));
                        res.json(result);
                        return;
                    }
                    case 'state.get': {
                        // Sensing never wakes its own tape — reads are not acts.
                        res.json(await this.withFrontend(client.getState()));
                        return;
                    }
                    case 'surface.list': {
                        res.json({ surfaces: await this.withFrontend(client.listSurfaces(body.query ?? body)) });
                        return;
                    }
                    case 'surface.read': {
                        res.json(await this.withFrontend(client.readSurface(String(body.surface ?? ''))));
                        return;
                    }
                    case 'surface.set': {
                        const result = await this.withFrontend(client.setSurface(String(body.surface ?? ''), String(body.value ?? '')));
                        res.json(result);
                        return;
                    }
                    case 'surface.focus': {
                        const result = await this.withFrontend(client.focusSurface(String(body.surface ?? '')));
                        res.json(result);
                        return;
                    }
                    case 'surface.invoke': {
                        const args = Array.isArray(body.args) ? body.args : undefined;
                        const result = await this.withFrontend(client.invokeSurface(String(body.surface ?? ''), args));
                        res.json(result);
                        return;
                    }
                    case 'type.real': {
                        const surface = String(body.surface ?? '');
                        const text = String(body.text ?? '');
                        const options = {
                            cadence: typeof body.cadence === 'number' ? body.cadence : undefined,
                            submit: body.submit === true
                        };
                        // Typing takes as long as typing takes; the pace is the lesson.
                        const result = await this.withFrontend(client.typeInto(surface, text, options), this.typingBudget(text));
                        res.json(result);
                        return;
                    }
                    default: {
                        res.status(400).json({
                            error: `unknown op '${body.op}'`,
                            legal: [
                                'app.open', 'terminal.type', 'notify', 'guide.type', 'state.get',
                                'surface.list', 'surface.read', 'surface.set', 'surface.focus', 'surface.invoke', 'type.real'
                            ]
                        });
                        return;
                    }
                }
            } catch (error) {
                if (error instanceof FrontendTimeout) {
                    res.status(504).json({ error: error.message });
                    return;
                }
                this.logger.error('[webforge-channels] op failed', error);
                res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
            }
        });

        // The declared event catalog: what this instance can emit, and what each row
        // means. An agent reads this instead of inferring semantics from names.
        app.get('/webforge/catalog', (req, res) => {
            const token = (process.env.WEBFORGE_CHANNEL_TOKEN || '').trim();
            if (!token || token.length < 16 || req.headers.authorization !== `Bearer ${token}`) {
                res.status(401).json({ error: 'unauthorized' });
                return;
            }
            res.json({
                events: WebForgeEvents.all(),
                // The vocabulary itself, so a client never has to hardcode ours: what an
                // address can start with, where a surface can live, and how much damage
                // each danger level admits to.
                surfaces: {
                    kinds: SURFACE_KINDS,
                    zones: SURFACE_ZONES,
                    danger: DANGER_ORDER,
                    addressing: '<kind>:<name> — list with surface.list, then use a declared capability'
                }
            });
        });

        // The tape, readable: last N CloudEvents rows (token-guarded like the channel).
        app.get('/webforge/events', (req, res) => {
            const token = (process.env.WEBFORGE_CHANNEL_TOKEN || '').trim();
            if (!token || token.length < 16 || req.headers.authorization !== `Bearer ${token}`) {
                res.status(401).json({ error: 'unauthorized' });
                return;
            }
            try {
                const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 50));
                res.json({ events: this.tape.tailSync(limit) });
            } catch (error) {
                res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
            }
        });
    }
}
