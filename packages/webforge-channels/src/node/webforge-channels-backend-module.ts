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

import { ConnectionHandler, RpcConnectionHandler } from '@theia/core';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { ContainerModule } from '@theia/core/shared/inversify';
import { WEBFORGE_CHANNEL_SERVICE_PATH, WebForgeChannelClient } from '../common/webforge-channel-protocol';
import { WebForgeChannelEndpoint } from './webforge-channel-endpoint';
import { WebForgeChannelServiceImpl } from './webforge-channel-service-impl';

export default new ContainerModule(bind => {
    // Singleton across connections: the HTTP endpoint needs the same instance the
    // RPC handler wires the frontend client into.
    bind(WebForgeChannelServiceImpl).toSelf().inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler<WebForgeChannelClient>(WEBFORGE_CHANNEL_SERVICE_PATH, client => {
            const service = ctx.container.get(WebForgeChannelServiceImpl);
            service.setClient(client);
            return service;
        })
    ).inSingletonScope();

    bind(WebForgeChannelEndpoint).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(WebForgeChannelEndpoint);
});
