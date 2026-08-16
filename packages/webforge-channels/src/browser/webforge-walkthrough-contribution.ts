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

import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, nls, PreferenceService } from '@theia/core';
import { CommonMenus, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { PerspectiveService } from '@theia/core/lib/browser/perspective-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import { WEBFORGE_GUIDED_PERSPECTIVE_ID } from './webforge-guided-perspective';
import { WEBFORGE_WALKTHROUGH_AUTO_START } from './webforge-preferences';
import { WebForgeWalkthrough } from './webforge-walkthrough';

export const WebForgeWalkthroughCommands = {
    START: Command.toLocalizedCommand({
        id: 'webforge.walkthrough.start',
        category: 'WebForge',
        label: 'Start the Guided Walkthrough'
    }, 'webforge/commands/startWalkthrough'),
    RESET: Command.toLocalizedCommand({
        id: 'webforge.walkthrough.reset',
        category: 'WebForge',
        label: 'Show the Guided Walkthrough Again at Next Start'
    }, 'webforge/commands/resetWalkthrough')
};

/**
 * The front door.
 *
 * An operator who has never opened WebForge lands in the Guided arrangement with the
 * walkthrough offered over it; everyone else lands exactly where they left off. The
 * walkthrough is shown once and is always re-openable from the Help menu, so this is
 * an invitation rather than a gate.
 */
@injectable()
export class WebForgeWalkthroughContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    @inject(WebForgeWalkthrough)
    protected readonly walkthrough: WebForgeWalkthrough;

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(PerspectiveService)
    protected readonly perspectives: PerspectiveService;

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    onStart(): void {
        this.stateService.reachedState('ready').then(() => this.offerOnFirstRun());
    }

    protected async offerOnFirstRun(): Promise<void> {
        await this.preferences.ready;
        if (!this.preferences.get<boolean>(WEBFORGE_WALKTHROUGH_AUTO_START, true)) {
            return;
        }
        if (await this.walkthrough.hasBeenSeen()) {
            return;
        }
        await this.perspectives.switchPerspective(WEBFORGE_GUIDED_PERSPECTIVE_ID);
        this.walkthrough.open();
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(WebForgeWalkthroughCommands.START, {
            execute: () => this.walkthrough.open()
        });
        registry.registerCommand(WebForgeWalkthroughCommands.RESET, {
            execute: () => this.walkthrough.forget()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: WebForgeWalkthroughCommands.START.id,
            label: nls.localize('webforge/menu/walkthrough', 'Guided Walkthrough'),
            order: 'a05'
        });
    }
}
