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

import '../../src/browser/style/layers.css';

import { bindContributionProvider, CommandContribution } from '@theia/core';
import { FrontendApplicationContribution, RemoteConnectionProvider, ServiceConnectionProvider } from '@theia/core/lib/browser';
import { ContainerModule } from '@theia/core/shared/inversify';
import { WEBFORGE_RUNTIME_SERVICE_PATH, WebForgeRuntimeSink } from '../common/webforge-runtime-protocol';
import { WebForgeCatalogContribution, WebForgeCatalogHints } from './webforge-catalog-hints';
import { WebForgeLayerService } from './webforge-layers';
import { ButtonSurfaceProvider, MenuSurfaceProvider } from './webforge-menu-surfaces';
import { WebForgePreview } from './webforge-preview';
import { WebForgeRealTyping } from './webforge-real-typing';
import { WebForgeRuntimeBus } from './webforge-runtime-bus';
import { WebForgeRuntimeObserver } from './webforge-runtime-observer';
import {
    CommandSurfaceProvider, EditorSurfaceProvider, InputSurfaceProvider,
    SettingSurfaceProvider, TerminalSurfaceProvider, ViewSurfaceProvider
} from './webforge-surface-providers';
import { WebForgeSurfaceProvider, WebForgeSurfaceRegistry } from './webforge-surface-registry';

export default new ContainerModule(bind => {
    bind(WebForgeRuntimeBus).toSelf().inSingletonScope();
    bind(WebForgeRealTyping).toSelf().inSingletonScope();

    bind(WebForgeLayerService).toSelf().inSingletonScope();
    bind(CommandContribution).toService(WebForgeLayerService);

    bindContributionProvider(bind, WebForgeCatalogContribution);
    bind(WebForgeCatalogHints).toSelf().inSingletonScope();

    bindContributionProvider(bind, WebForgeSurfaceProvider);
    bind(WebForgeSurfaceRegistry).toSelf().inSingletonScope();

    for (const provider of [
        SettingSurfaceProvider, CommandSurfaceProvider, ViewSurfaceProvider,
        EditorSurfaceProvider, TerminalSurfaceProvider, InputSurfaceProvider,
        MenuSurfaceProvider, ButtonSurfaceProvider
    ]) {
        bind(provider).toSelf().inSingletonScope();
        bind(WebForgeSurfaceProvider).toService(provider);
    }

    bind(WebForgePreview).toSelf().inSingletonScope();
    bind(WebForgeSurfaceProvider).toService(WebForgePreview);
    bind(FrontendApplicationContribution).toService(WebForgePreview);

    bind(WebForgeRuntimeObserver).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(WebForgeRuntimeObserver);

    // The tape lives in the backend; the bus needs its proxy before anything is emitted.
    bind(FrontendApplicationContribution).toDynamicValue(ctx => ({
        initialize: () => {
            const connection = ctx.container.get<ServiceConnectionProvider>(RemoteConnectionProvider);
            const bus = ctx.container.get<WebForgeRuntimeBus>(WebForgeRuntimeBus);
            bus.sink = connection.createProxy<WebForgeRuntimeSink>(WEBFORGE_RUNTIME_SERVICE_PATH);
        }
    })).inSingletonScope();
});
