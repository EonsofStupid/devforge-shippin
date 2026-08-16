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

import { FrontendApplicationContribution, RemoteConnectionProvider, ServiceConnectionProvider } from '@theia/core/lib/browser';
import { ContainerModule } from '@theia/core/shared/inversify';
import { WEBFORGE_CHANNEL_SERVICE_PATH, WebForgeChannelClient } from '../common/webforge-channel-protocol';
import { WebForgeChannelClientImpl } from './webforge-channel-client-impl';

export default new ContainerModule(bind => {
    bind(WebForgeChannelClientImpl).toSelf().inSingletonScope();
    bind(WebForgeChannelClient).toService(WebForgeChannelClientImpl);

    // Establish the RPC connection at startup so the backend endpoint always has a
    // client the moment a browser tab is attached — the channels light up with the UI.
    bind(FrontendApplicationContribution).toDynamicValue(ctx => ({
        initialize: () => {
            const connection = ctx.container.get<ServiceConnectionProvider>(RemoteConnectionProvider);
            const client = ctx.container.get<WebForgeChannelClientImpl>(WebForgeChannelClientImpl);
            connection.createProxy(WEBFORGE_CHANNEL_SERVICE_PATH, client);
        },
    })).inSingletonScope();
});
