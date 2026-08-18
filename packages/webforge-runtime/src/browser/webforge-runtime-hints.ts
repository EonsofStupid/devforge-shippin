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

import { nls } from '@theia/core';
import { injectable } from '@theia/core/shared/inversify';
import { CatalogHint } from '../common/webforge-catalog';
import { WebForgeCatalogContribution } from './webforge-catalog-hints';

/**
 * What the engine's own surfaces mean, in the operator's words.
 *
 * These sentences are written for the person, not for the machine — and the machine gets
 * them anyway. That is the test for every line here: if it reads like an API note rather
 * than something you would say to someone learning, it is wrong.
 */
@injectable()
export class WebForgeRuntimeHints implements WebForgeCatalogContribution {

    hints(): Record<string, CatalogHint> {
        return {
            'command:webforge.layer.simplified': {
                description: nls.localize('theia/webforge/layer/simplified',
                    'Hide the advanced controls and use larger, roomier text. Nothing is removed — everything is still reachable.'),
                zone: 'palette',
                danger: 'safe'
            },
            'command:webforge.layer.full': {
                description: nls.localize('theia/webforge/layer/full',
                    'Show every control the editor has. Use this once the simplified view starts getting in your way.'),
                zone: 'palette',
                danger: 'safe'
            },
            // The controls a newcomer meets in their first ten minutes. Theia's own
            // tooltips name the control ("Collapse All"); these say what it is FOR,
            // which is the difference between a label and an explanation.
            'button:files/file.newFile.toolbar': {
                description: nls.localize('theia/webforge/button/newFile',
                    'Make a new file inside the folder you have selected.'),
                zone: 'toolbar'
            },
            'button:files/file.newFolder.toolbar': {
                description: nls.localize('theia/webforge/button/newFolder',
                    'Make a new folder to group files together.'),
                zone: 'toolbar'
            },
            'button:files/navigator.collapse.all': {
                description: nls.localize('theia/webforge/button/collapseAll',
                    'Fold every folder shut, so you can see the shape of the whole project at once.'),
                zone: 'toolbar',
                danger: 'safe'
            },
            'button:files/navigator.refresh': {
                description: nls.localize('theia/webforge/button/refreshExplorer',
                    'Re-read the folder from disk. Use this if something changed outside the editor and the list looks stale.'),
                zone: 'toolbar',
                danger: 'safe'
            },
            'button:theia-open-editors-widget/navigator.save.all.editors.toolbar': {
                description: nls.localize('theia/webforge/button/saveAll',
                    'Save every file you have edited but not yet saved.'),
                zone: 'toolbar'
            },
            'button:theia-open-editors-widget/navigator.close.all.editors.toolbar': {
                description: nls.localize('theia/webforge/button/closeAll',
                    'Close every open tab. Your files are not deleted — you can reopen them from the explorer.'),
                zone: 'toolbar'
            },
            'preview:app': {
                description: nls.localize('theia/webforge/preview/app',
                    'Your app, running, right beside the code. It reloads by itself when you change something.'),
                zone: 'main',
                danger: 'safe'
            }
        };
    }
}
