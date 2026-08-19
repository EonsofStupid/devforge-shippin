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

import '../../src/browser/style/walkthrough.css';

import { CommandContribution, MenuContribution, PreferenceContribution } from '@ogun/core';
import { FrontendApplicationContribution, RemoteConnectionProvider, ServiceConnectionProvider } from '@ogun/core/lib/browser';
import { PerspectiveContribution } from '@ogun/core/lib/browser/perspective-service';
import { ContainerModule } from '@ogun/core/shared/inversify';
import { WEBFORGE_CHANNEL_SERVICE_PATH, WebForgeChannelClient, WebForgeChannelService } from '../common/webforge-channel-protocol';
import { WebForgeAgentsMdSeeder } from './webforge-agents-md-seeder';
import { WebForgeChannelClientImpl } from './webforge-channel-client-impl';
import { WebForgeGuidedPerspectiveContribution } from './webforge-guided-perspective';
import { WebForgeGuidedTyping } from './webforge-guided-typing';
import { WebForgePreferencesSchema } from './webforge-preferences';
import { WebForgeWalkthrough } from './webforge-walkthrough';
import { WebForgeWalkthroughContribution } from './webforge-walkthrough-contribution';

export default new ContainerModule(bind => {
    bind(PreferenceContribution).toConstantValue({ schema: WebForgePreferencesSchema });

    bind(WebForgeGuidedTyping).toSelf().inSingletonScope();

    bind(WebForgeGuidedPerspectiveContribution).toSelf().inSingletonScope();
    bind(PerspectiveContribution).toService(WebForgeGuidedPerspectiveContribution);

    bind(WebForgeChannelClientImpl).toSelf().inSingletonScope();
    bind(WebForgeChannelClient).toService(WebForgeChannelClientImpl);

    bind(WebForgeWalkthrough).toSelf().inSingletonScope();
    bind(WebForgeWalkthroughContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(WebForgeWalkthroughContribution);
    bind(MenuContribution).toService(WebForgeWalkthroughContribution);
    bind(FrontendApplicationContribution).toService(WebForgeWalkthroughContribution);

    bind(WebForgeAgentsMdSeeder).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(WebForgeAgentsMdSeeder);

    // Establish the RPC connection at startup so the backend endpoint always has a
    // client the moment a browser tab is attached — the channels light up with the UI.
    // The returned proxy is the backend service; the client keeps it to report guide
    // outcomes onto the event tape.
    bind(FrontendApplicationContribution).toDynamicValue(ctx => ({
        initialize: () => {
            const connection = ctx.container.get<ServiceConnectionProvider>(RemoteConnectionProvider);
            const client = ctx.container.get<WebForgeChannelClientImpl>(WebForgeChannelClientImpl);
            client.backendService = connection.createProxy<WebForgeChannelService>(WEBFORGE_CHANNEL_SERVICE_PATH, client);
        },
    })).inSingletonScope();
});
