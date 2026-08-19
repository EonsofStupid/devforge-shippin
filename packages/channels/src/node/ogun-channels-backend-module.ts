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

import { ConnectionHandler, RpcConnectionHandler } from '@ogun/core';
import { BackendApplicationContribution } from '@ogun/core/lib/node';
import { ContainerModule } from '@ogun/core/shared/inversify';
import { OGUN_CHANNEL_SERVICE_PATH, OgunChannelClient } from '../common/ogun-channel-protocol';
import { OgunChannelEndpoint } from './ogun-channel-endpoint';
import { OgunChannelServiceImpl } from './ogun-channel-service-impl';

export default new ContainerModule(bind => {
    // Singleton across connections: the HTTP endpoint needs the same instance the
    // RPC handler wires the frontend client into.
    bind(OgunChannelServiceImpl).toSelf().inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler<OgunChannelClient>(OGUN_CHANNEL_SERVICE_PATH, client => {
            const service = ctx.container.get(OgunChannelServiceImpl);
            service.setClient(client);
            return service;
        })
    ).inSingletonScope();

    bind(OgunChannelEndpoint).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(OgunChannelEndpoint);
});
