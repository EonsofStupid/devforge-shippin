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

import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, nls, PreferenceService } from '@ogun/core';
import { CommonMenus, FrontendApplicationContribution } from '@ogun/core/lib/browser';
import { FrontendApplicationStateService } from '@ogun/core/lib/browser/frontend-application-state';
import { PerspectiveService } from '@ogun/core/lib/browser/perspective-service';
import { inject, injectable } from '@ogun/core/shared/inversify';
import { OGUN_GUIDED_PERSPECTIVE_ID } from './ogun-guided-perspective';
import { OGUN_WALKTHROUGH_AUTO_START } from './ogun-preferences';
import { OgunWalkthrough } from './ogun-walkthrough';

export const OgunWalkthroughCommands = {
    START: Command.toLocalizedCommand({
        id: 'ogun.walkthrough.start',
        category: 'Ogun',
        label: 'Start the Guided Walkthrough'
    }, 'ogun/commands/startWalkthrough'),
    RESET: Command.toLocalizedCommand({
        id: 'ogun.walkthrough.reset',
        category: 'Ogun',
        label: 'Show the Guided Walkthrough Again at Next Start'
    }, 'ogun/commands/resetWalkthrough')
};

/**
 * The front door.
 *
 * An operator who has never opened Ogun lands in the Guided arrangement with the
 * walkthrough offered over it; everyone else lands exactly where they left off. The
 * walkthrough is shown once and is always re-openable from the Help menu, so this is
 * an invitation rather than a gate.
 */
@injectable()
export class OgunWalkthroughContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    @inject(OgunWalkthrough)
    protected readonly walkthrough: OgunWalkthrough;

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
        if (!this.preferences.get<boolean>(OGUN_WALKTHROUGH_AUTO_START, true)) {
            return;
        }
        if (await this.walkthrough.hasBeenSeen()) {
            return;
        }
        await this.perspectives.switchPerspective(OGUN_GUIDED_PERSPECTIVE_ID);
        this.walkthrough.open();
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(OgunWalkthroughCommands.START, {
            execute: () => this.walkthrough.open()
        });
        registry.registerCommand(OgunWalkthroughCommands.RESET, {
            execute: () => this.walkthrough.forget()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: OgunWalkthroughCommands.START.id,
            label: nls.localize('ogun/menu/walkthrough', 'Guided Walkthrough'),
            order: 'a05'
        });
    }
}
