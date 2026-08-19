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

import '../../src/browser/style/guided-typing.css';
import '../../src/browser/style/walkthrough.css';

import { CommandContribution, MenuContribution, PreferenceContribution } from '@ogun/core';
import { FrontendApplicationContribution, RemoteConnectionProvider, ServiceConnectionProvider } from '@ogun/core/lib/browser';
import { PerspectiveContribution } from '@ogun/core/lib/browser/perspective-service';
import { ContainerModule } from '@ogun/core/shared/inversify';
import { OGUN_CHANNEL_SERVICE_PATH, OgunChannelClient, OgunChannelService } from '../common/ogun-channel-protocol';
import { OgunAgentsMdSeeder } from './ogun-agents-md-seeder';
import { OgunChannelClientImpl } from './ogun-channel-client-impl';
import { OgunGuidedPerspectiveContribution } from './ogun-guided-perspective';
import { OgunGuidedTyping } from './ogun-guided-typing';
import { OgunPreferencesSchema } from './ogun-preferences';
import { OgunWalkthrough } from './ogun-walkthrough';
import { OgunWalkthroughContribution } from './ogun-walkthrough-contribution';

export default new ContainerModule(bind => {
    bind(PreferenceContribution).toConstantValue({ schema: OgunPreferencesSchema });

    bind(OgunGuidedTyping).toSelf().inSingletonScope();

    bind(OgunGuidedPerspectiveContribution).toSelf().inSingletonScope();
    bind(PerspectiveContribution).toService(OgunGuidedPerspectiveContribution);

    bind(OgunChannelClientImpl).toSelf().inSingletonScope();
    bind(OgunChannelClient).toService(OgunChannelClientImpl);

    bind(OgunWalkthrough).toSelf().inSingletonScope();
    bind(OgunWalkthroughContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(OgunWalkthroughContribution);
    bind(MenuContribution).toService(OgunWalkthroughContribution);
    bind(FrontendApplicationContribution).toService(OgunWalkthroughContribution);

    bind(OgunAgentsMdSeeder).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(OgunAgentsMdSeeder);

    // Establish the RPC connection at startup so the backend endpoint always has a
    // client the moment a browser tab is attached — the channels light up with the UI.
    // The returned proxy is the backend service; the client keeps it to report guide
    // outcomes onto the event tape.
    bind(FrontendApplicationContribution).toDynamicValue(ctx => ({
        initialize: () => {
            const connection = ctx.container.get<ServiceConnectionProvider>(RemoteConnectionProvider);
            const client = ctx.container.get<OgunChannelClientImpl>(OgunChannelClientImpl);
            client.backendService = connection.createProxy<OgunChannelService>(OGUN_CHANNEL_SERVICE_PATH, client);
        },
    })).inSingletonScope();
});
