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
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The instance event tape: CloudEvents 1.0 rows, NDJSON, platform-scoped source —
 * the canonical, foldable record of everything the channels DID (never what they
 * sensed). NATS/Zuul consume this same envelope later; consumers read the tail via
 * GET /webforge/events today.
 */
@injectable()
export class WebForgeEventTape {

    @inject(ILogger) @named('webforge-channels')
    protected readonly logger: ILogger;

    get tapeFile(): string {
        const dir = process.env.WEBFORGE_DATA_DIR || path.join(os.homedir(), '.webforge');
        return path.join(dir, 'events.jsonl');
    }

    emit(type: string, data: Record<string, unknown>): void {
        try {
            const event = {
                specversion: '1.0',
                id: randomUUID(),
                source: process.env.WEBFORGE_EVENT_SOURCE || 'io.shippin.webforge/local',
                type: `io.shippin.webforge.channel.${type}`,
                time: new Date().toISOString(),
                data,
            };
            fs.mkdirSync(path.dirname(this.tapeFile), { recursive: true });
            fs.appendFileSync(this.tapeFile, `${JSON.stringify(event)}\n`);
        } catch (error) {
            this.logger.warn('[webforge-channels] tape append failed', error);
        }
    }

    tail(limit: number): unknown[] {
        const capped = Math.max(1, Math.min(500, limit || 50));
        if (!fs.existsSync(this.tapeFile)) {
            return [];
        }
        return fs.readFileSync(this.tapeFile, 'utf8').trim().split('\n').slice(-capped).map(l => JSON.parse(l));
    }
}
