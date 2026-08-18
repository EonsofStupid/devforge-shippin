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

import { CommandRegistry, DisposableCollection, PreferenceChange, PreferenceService } from '@ogun/core';
import { FrontendApplicationContribution } from '@ogun/core/lib/browser';
import { FrontendApplicationStateService } from '@ogun/core/lib/browser/frontend-application-state';
import { PerspectiveService } from '@ogun/core/lib/browser/perspective-service';
import { inject, injectable } from '@ogun/core/shared/inversify';
import { EditorManager } from '@ogun/editor/lib/browser';
import { WebForgeLayerService } from './webforge-layers';
import { WebForgeRuntimeBus } from './webforge-runtime-bus';

/**
 * Instrumentation: the workbench reports itself.
 *
 * The engine's value comes from *everything* being on the tape, not just the acts our
 * own channel performs. Opening a file by clicking it and opening it through Clyffy
 * produce the same event — differing only in provenance — which is what makes the tape
 * a truthful account of the session rather than a log of one integration.
 *
 * Theia already emits the signals; nothing upstream needs patching to listen.
 */
@injectable()
export class WebForgeRuntimeObserver implements FrontendApplicationContribution {

    @inject(WebForgeRuntimeBus)
    protected readonly bus: WebForgeRuntimeBus;

    @inject(CommandRegistry)
    protected readonly commands: CommandRegistry;

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(EditorManager)
    protected readonly editors: EditorManager;

    @inject(PerspectiveService)
    protected readonly perspectives: PerspectiveService;

    @inject(WebForgeLayerService)
    protected readonly layers: WebForgeLayerService;

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    protected readonly toDispose = new DisposableCollection();

    /**
     * Plumbing that is not an act. Registering a schema default, echoing a line to the
     * output channel, deriving a per-language override — none of these are things anyone
     * *did*, and a tape that records them buries the ones that matter under hundreds of
     * rows. The rule is simple: if no one chose it, it is not an act.
     */
    protected isNoise(commandId: string): boolean {
        return commandId.startsWith('output:') || commandId.startsWith('monaco.editor.');
    }

    /** `[typescript].editor.fontSize` is derived from `editor.fontSize`; only the choice is an act. */
    protected isDerivedSetting(key: string): boolean {
        return key.startsWith('[');
    }

    onStart(): void {
        // Startup writes hundreds of defaults into the preference system. Listening only
        // once the workbench is ready keeps the tape a record of the session, not of boot.
        this.stateService.reachedState('ready').then(() => this.listen());
    }

    protected listen(): void {
        this.toDispose.push(this.commands.onDidExecuteCommand(event => {
            if (this.isNoise(event.commandId)) {
                return;
            }
            this.bus.emit('act.command.executed', { command: event.commandId, args: (event.args ?? []).length });
        }));

        this.toDispose.push(this.preferences.onPreferenceChanged((change: PreferenceChange) => {
            if (this.isDerivedSetting(change.preferenceName)) {
                return;
            }
            this.bus.emit('act.setting.changed', { key: change.preferenceName, scope: change.scope });
        }));

        this.toDispose.push(this.editors.onCreated(widget => {
            this.bus.emit('act.file.opened', { path: widget.editor.uri.path.fsPath() });
        }));

        this.toDispose.push(this.perspectives.onDidChangePerspective(id => {
            this.bus.emit('state.perspective.changed', { perspective: id });
        }));

        this.bus.emit('state.workbench.ready', { perspective: this.perspectives.getActivePerspectiveId() });
        this.bus.emit('state.layer.changed', { layer: this.layers.layer });
    }

    onStop(): void {
        this.toDispose.dispose();
    }
}
