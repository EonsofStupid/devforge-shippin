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

import { Command, CommandContribution, CommandRegistry, nls } from '@ogun/core';
import { AbstractViewContribution, FrontendApplication, FrontendApplicationContribution } from '@ogun/core/lib/browser';
import { injectable } from '@ogun/core/shared/inversify';
import { OgunChatWidget } from './ogun-chat-widget';

export const OGUN_CHAT_TOGGLE_COMMAND: Command = {
    id: 'ogun.chat.toggle',
    label: nls.localize('ogun/chat/toggle', 'Clyffy: Show Chat')
};

/** Theia's chat view. Kept as a class — five packages reference it — but not shown. */
const UPSTREAM_CHAT_VIEW_ID = 'chat-view-widget';

/**
 * Clyffy's chat takes the right-hand panel.
 *
 * The upstream chat view is not deleted: `ChatViewWidget` is referenced by history,
 * configuration, session-list and perspective code, and tearing the class out to win an
 * argument about ownership would break five packages to change one screen. It is simply
 * not put on the shelf — closed on first layout, so what the operator finds in that slot
 * is ours. The engine underneath (agents, tools, the Claude Code seat) is untouched and
 * still doing the work; only the face changes, which was always the point.
 */
@injectable()
export class OgunChatContribution extends AbstractViewContribution<OgunChatWidget>
    implements FrontendApplicationContribution, CommandContribution {

    constructor() {
        super({
            widgetId: OgunChatWidget.ID,
            widgetName: OgunChatWidget.LABEL,
            defaultWidgetOptions: { area: 'right', rank: 100 },
            toggleCommandId: OGUN_CHAT_TOGGLE_COMMAND.id
        });
    }

    async onDidInitializeLayout(app: FrontendApplication): Promise<void> {
        // Close the upstream panel before the operator ever sees it. Doing this on layout
        // rather than by unbinding keeps every other package's references valid.
        for (const widget of app.shell.widgets) {
            if (widget.id === UPSTREAM_CHAT_VIEW_ID) {
                widget.close();
            }
        }
        await this.openView({ activate: false, reveal: true });
    }

    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
    }
}
