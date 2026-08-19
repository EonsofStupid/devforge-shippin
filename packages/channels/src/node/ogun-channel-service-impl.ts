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

import { injectable } from '@ogun/core/shared/inversify';
import { OgunChannelClient, OgunChannelService } from '../common/ogun-channel-protocol';

/**
 * Backend half of the channels: keeps the RPC client (the connected frontend) and
 * hands it to the HTTP endpoint. One frontend per backend process in Ogun's
 * per-operator instance model, so a single client reference is the honest shape.
 */
@injectable()
export class OgunChannelServiceImpl implements OgunChannelService {

    protected client: OgunChannelClient | undefined;

    setClient(client: OgunChannelClient | undefined): void {
        this.client = client;
    }

    getClient(): OgunChannelClient | undefined {
        return this.client;
    }

}
