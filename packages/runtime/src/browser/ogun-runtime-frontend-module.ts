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

import { bindContributionProvider, CommandContribution } from '@ogun/core';
import { FrontendApplicationContribution, RemoteConnectionProvider, ServiceConnectionProvider } from '@ogun/core/lib/browser';
import { ContainerModule } from '@ogun/core/shared/inversify';
import { OGUN_RUNTIME_SERVICE_PATH, OgunRuntimeSink } from '../common/ogun-runtime-protocol';
import { OgunCatalogContribution, OgunCatalogHints } from './ogun-catalog-hints';
import { OgunLayerService } from './ogun-layers';
import { ButtonSurfaceProvider, MenuSurfaceProvider } from './ogun-menu-surfaces';
import { OgunPreview } from './ogun-preview';
import { OgunRealTyping } from './ogun-real-typing';
import { OgunRuntimeBus } from './ogun-runtime-bus';
import { OgunRuntimeHints } from './ogun-runtime-hints';
import { OgunRuntimeObserver } from './ogun-runtime-observer';
import { OgunTooltips } from './ogun-tooltips';
import {
    CommandSurfaceProvider, EditorSurfaceProvider, InputSurfaceProvider,
    SettingSurfaceProvider, TerminalSurfaceProvider, ViewSurfaceProvider
} from './ogun-surface-providers';
import { OgunSurfaceProvider, OgunSurfaceRegistry } from './ogun-surface-registry';

export default new ContainerModule(bind => {
    bind(OgunRuntimeBus).toSelf().inSingletonScope();
    bind(OgunRealTyping).toSelf().inSingletonScope();

    bind(OgunLayerService).toSelf().inSingletonScope();
    bind(CommandContribution).toService(OgunLayerService);

    bindContributionProvider(bind, OgunCatalogContribution);
    bind(OgunCatalogHints).toSelf().inSingletonScope();
    bind(OgunRuntimeHints).toSelf().inSingletonScope();
    bind(OgunCatalogContribution).toService(OgunRuntimeHints);

    // The catalog explains itself to the operator as well as to Clyffy: same sentence.
    bind(OgunTooltips).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(OgunTooltips);

    bindContributionProvider(bind, OgunSurfaceProvider);
    bind(OgunSurfaceRegistry).toSelf().inSingletonScope();

    for (const provider of [
        SettingSurfaceProvider, CommandSurfaceProvider, ViewSurfaceProvider,
        EditorSurfaceProvider, TerminalSurfaceProvider, InputSurfaceProvider,
        MenuSurfaceProvider, ButtonSurfaceProvider
    ]) {
        bind(provider).toSelf().inSingletonScope();
        bind(OgunSurfaceProvider).toService(provider);
    }

    bind(OgunPreview).toSelf().inSingletonScope();
    bind(OgunSurfaceProvider).toService(OgunPreview);
    bind(FrontendApplicationContribution).toService(OgunPreview);

    bind(OgunRuntimeObserver).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(OgunRuntimeObserver);

    // The tape lives in the backend; the bus needs its proxy before anything is emitted.
    bind(FrontendApplicationContribution).toDynamicValue(ctx => ({
        initialize: () => {
            const connection = ctx.container.get<ServiceConnectionProvider>(RemoteConnectionProvider);
            const bus = ctx.container.get<OgunRuntimeBus>(OgunRuntimeBus);
            bus.sink = connection.createProxy<OgunRuntimeSink>(OGUN_RUNTIME_SERVICE_PATH);
        }
    })).inSingletonScope();
});
