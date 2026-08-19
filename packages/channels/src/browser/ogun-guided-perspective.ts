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

import { nls } from '@ogun/core';
import { injectable } from '@ogun/core/shared/inversify';
import { ApplicationShell } from '@ogun/core/lib/browser/shell/application-shell';
import { PerspectiveChromeOptions, PerspectiveContribution, PerspectiveService } from '@ogun/core/lib/browser/perspective-service';
import { ChatViewWidget } from '@ogun/ai-chat-ui/lib/browser/chat-view-widget';
import { EXPLORER_VIEW_CONTAINER_ID } from '@ogun/navigator/lib/browser';

export const OGUN_GUIDED_PERSPECTIVE_ID = 'ogun.guided';

/**
 * The Guided perspective: Ogun arranged for someone who has never opened an IDE.
 *
 * Nothing is removed — this is an arrangement, not an amputation. The work sits in the
 * middle, Clyffy sits beside it, and the machinery (explorer, terminal, panels) is
 * collapsed one click away rather than deleted. Everything advanced stays reachable
 * through the command palette and the panels, so a learner is never walled off from
 * the tool they are growing into.
 *
 * The active perspective is published as the `activePerspectiveId` context key, which
 * is what lets menus, commands and views be gated by `when` clauses instead of by
 * forking the workbench.
 */
@injectable()
export class OgunGuidedPerspectiveContribution implements PerspectiveContribution {

    registerPerspectives(service: PerspectiveService): void {
        const chromeOptions: PerspectiveChromeOptions = {
            // The terminal and the file tree appear when the lesson calls for them —
            // Clyffy opens them through the channels — not as a wall of chrome on boot.
            collapseAreas: ['bottom', 'left']
        };
        service.registerPerspective({
            id: OGUN_GUIDED_PERSPECTIVE_ID,
            label: nls.localize('ogun/perspective/guided', 'Guided'),
            viewPlacements: new Map<string, ApplicationShell.Area>([
                [ChatViewWidget.ID, 'right'],
                [EXPLORER_VIEW_CONTAINER_ID, 'left']
            ]),
            primaryViews: { right: ChatViewWidget.ID },
            chromeOptions
        });
    }
}
