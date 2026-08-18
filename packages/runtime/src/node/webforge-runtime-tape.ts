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
import { inject, injectable, named } from '@ogun/core/shared/inversify';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RuntimeEvent } from '../common/webforge-runtime-events';
import { WebForgeRuntimeSink } from '../common/webforge-runtime-protocol';

/**
 * The instance event tape: CloudEvents 1.0 rows, NDJSON, platform-scoped source.
 *
 * One append-only file per instance is the canonical, foldable record of the session.
 * The envelope is the same one the mesh carries later, so nothing has to be reshaped
 * when these events leave the machine — and `provenance` rides in the payload, which is
 * what turns a log into an account of who did what and why.
 */
@injectable()
export class WebForgeRuntimeTape implements WebForgeRuntimeSink {

    @inject(ILogger) @named('webforge-runtime')
    protected readonly logger: ILogger;

    get tapeFile(): string {
        const dir = process.env.WEBFORGE_DATA_DIR || path.join(os.homedir(), '.webforge');
        return path.join(dir, 'events.jsonl');
    }

    async record(event: RuntimeEvent): Promise<void> {
        this.append(event.name, {
            ...event.data,
            actor: event.provenance?.actor?.address,
            actorKind: event.provenance?.actor?.kind,
            chain: event.provenance?.chain,
            cause: event.provenance?.cause,
            reason: event.provenance?.reason
        }, event.plane);
    }

    /** Write a row directly. Used by the HTTP channel, which has no frontend provenance. */
    append(name: string, data: Record<string, unknown>, plane = 'act'): void {
        try {
            const row = {
                specversion: '1.0',
                id: randomUUID(),
                source: process.env.WEBFORGE_EVENT_SOURCE || 'io.shippin.webforge/local',
                type: `io.shippin.webforge.${name}`,
                time: new Date().toISOString(),
                webforgeplane: plane,
                data
            };
            fs.mkdirSync(path.dirname(this.tapeFile), { recursive: true });
            fs.appendFileSync(this.tapeFile, `${JSON.stringify(row)}\n`);
        } catch (error) {
            this.logger.warn('[webforge-runtime] tape append failed', error);
        }
    }

    async tail(limit: number): Promise<object[]> {
        return this.tailSync(limit);
    }

    tailSync(limit: number): object[] {
        const capped = Math.max(1, Math.min(500, limit || 50));
        if (!fs.existsSync(this.tapeFile)) {
            return [];
        }
        const text = fs.readFileSync(this.tapeFile, 'utf8').trim();
        if (!text) {
            return [];
        }
        return text.split('\n').slice(-capped).map(line => JSON.parse(line) as object);
    }
}
