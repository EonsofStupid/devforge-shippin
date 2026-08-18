// *****************************************************************************
// Copyright (C) 2020 Ericsson and others.
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

import { injectable, inject, postConstruct } from '@ogun/core/shared/inversify';
import { DebugSessionManager } from './debug-session-manager';
import { DebugWidget } from './view/debug-widget';
import { Emitter, Event } from '@ogun/core/lib/common/event';
import { TabBarDecorator } from '@ogun/core/lib/browser/shell/tab-bar-decorator';
import { Title, Widget } from '@ogun/core/lib/browser';
import { WidgetDecoration } from '@ogun/core/lib/browser/widget-decoration';
import { DisposableCollection } from '@ogun/core/lib/common';

@injectable()
export class DebugTabBarDecorator implements TabBarDecorator {
    readonly id = 'theia-debug-tabbar-decorator';

    protected readonly emitter = new Emitter<void>();
    protected toDispose = new DisposableCollection();

    @inject(DebugSessionManager)
    protected readonly debugSessionManager: DebugSessionManager;

    @postConstruct()
    protected init(): void {
        this.toDispose.pushAll([
            this.debugSessionManager.onDidStartDebugSession(() => this.fireDidChangeDecorations()),
            this.debugSessionManager.onDidDestroyDebugSession(() => this.fireDidChangeDecorations())
        ]);
    }

    decorate(title: Title<Widget>): WidgetDecoration.Data[] {
        return (title.owner.id === DebugWidget.ID)
            ? [{ badge: this.debugSessionManager.sessions.length }]
            : [];
    }

    get onDidChangeDecorations(): Event<void> {
        return this.emitter.event;
    }

    protected fireDidChangeDecorations(): void {
        this.emitter.fire(undefined);
    }
}
