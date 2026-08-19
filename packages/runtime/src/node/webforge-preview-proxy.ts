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

import { ILogger } from '@ogun/core';
import { BackendApplicationContribution } from '@ogun/core/lib/node';
import * as express from '@ogun/core/shared/express';
import { inject, injectable, named } from '@ogun/core/shared/inversify';
import * as http from 'http';
import * as net from 'net';

/**
 * The preview proxy — what makes "see it running" work on a hosted instance.
 *
 * A dev server started in the operator's terminal listens on the *instance's* loopback.
 * The operator's browser is somewhere else entirely, so `http://localhost:5173` in an
 * iframe would resolve to their own machine and show nothing. Every hosted IDE has to
 * solve this; we solve it by proxying the port through the instance the operator is
 * already authenticated to:
 *
 *     https://forge.shippin.ai/webforge/preview/5173/…  →  127.0.0.1:5173 on the instance
 *
 * WebSocket upgrades are forwarded too, so hot reload keeps working — without that the
 * preview is a screenshot, and the whole point is that it is the running thing.
 *
 * Only loopback ports on this instance are reachable, and only through the session the
 * gateway has already authorized: this is not an open proxy.
 */
@injectable()
export class WebForgePreviewProxy implements BackendApplicationContribution {

    @inject(ILogger) @named('webforge-runtime')
    protected readonly logger: ILogger;

    static readonly PREFIX = '/webforge/preview';

    protected parsePort(rawPort: string): number | undefined {
        const port = Number(rawPort);
        // Refuse anything that is not a plausible user-space port; the proxy must never
        // become a way to reach arbitrary services.
        return Number.isInteger(port) && port > 1024 && port < 65536 ? port : undefined;
    }

    configure(app: express.Application): void {
        app.use(`${WebForgePreviewProxy.PREFIX}/:port`, (req, res) => {
            const port = this.parsePort(req.params.port);
            if (!port) {
                res.status(400).send('preview: port must be between 1025 and 65535');
                return;
            }
            const upstream = http.request({
                host: '127.0.0.1',
                port,
                method: req.method,
                path: req.url || '/',
                headers: { ...req.headers, host: `127.0.0.1:${port}` }
            }, response => {
                res.writeHead(response.statusCode ?? 502, response.headers);
                response.pipe(res);
            });
            upstream.on('error', error => {
                // A dev server that is still booting is the common case, so say something
                // a person can act on rather than leaking a stack trace into the iframe.
                res.status(502).send(`preview: nothing is listening on port ${port} yet`);
                this.logger.debug(`[webforge-preview] port ${port} unreachable: ${error}`);
            });
            req.pipe(upstream);
        });
    }

    onStart(server: http.Server): void {
        // Hot reload rides a WebSocket; Express never sees an upgrade, so it is forwarded
        // at the server level or the preview silently stops updating.
        server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
            const match = (req.url ?? '').match(/^\/webforge\/preview\/(\d+)(\/.*)?$/);
            if (!match) {
                return;
            }
            const port = this.parsePort(match[1]);
            if (!port) {
                socket.destroy();
                return;
            }
            const upstream = http.request({
                host: '127.0.0.1',
                port,
                path: match[2] || '/',
                headers: { ...req.headers, host: `127.0.0.1:${port}` }
            });
            upstream.end();
            upstream.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
                const headers = Object.entries(upstreamRes.headers)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\r\n');
                socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n\r\n`);
                if (upstreamHead?.length) {
                    upstreamSocket.unshift(upstreamHead);
                }
                upstreamSocket.pipe(socket);
                socket.pipe(upstreamSocket);
            });
            upstream.on('error', () => socket.destroy());
            if (head?.length) {
                socket.unshift(head);
            }
        });
    }
}
