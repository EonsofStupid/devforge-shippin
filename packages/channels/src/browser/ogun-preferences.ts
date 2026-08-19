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

import { nls, PreferenceSchema } from '@ogun/core';

export const OGUN_WALKTHROUGH_AUTO_START = 'ogun.walkthrough.autoStart';
export const OGUN_WALKTHROUGH_LINEAGE = 'ogun.walkthrough.lineage';
export const OGUN_GUIDED_TYPING_THRESHOLD = 'ogun.guidedTyping.threshold';

/** The palette lineages the walkthrough art can be drawn in. See `docs/CLYFFY-ORCHESTRATION.md`. */
export type OgunLineage = 'amber' | 'green' | 'chroma';

export const OgunPreferencesSchema: PreferenceSchema = {
    properties: {
        [OGUN_WALKTHROUGH_AUTO_START]: {
            type: 'boolean',
            default: true,
            description: nls.localize(
                'ogun/preferences/walkthroughAutoStart',
                'Open the guided walkthrough the first time an operator opens Ogun. It is shown once; the operator can re-open it from the Help menu at any time.'
            )
        },
        [OGUN_WALKTHROUGH_LINEAGE]: {
            type: 'string',
            enum: ['amber', 'green', 'chroma'],
            enumDescriptions: [
                nls.localize('ogun/preferences/lineage/amber', 'Amber phosphor — guidance leads warm, machinery stays green.'),
                nls.localize('ogun/preferences/lineage/green', 'IBM 5151 green — the machine room.'),
                nls.localize('ogun/preferences/lineage/chroma', 'CGA / C64 — cyan and magenta, high chroma.')
            ],
            default: 'amber',
            description: nls.localize('ogun/preferences/lineage', 'Palette lineage for the walkthrough artwork.')
        },
        [OGUN_GUIDED_TYPING_THRESHOLD]: {
            type: 'number',
            minimum: 0.2,
            maximum: 1,
            default: 0.7,
            description: nls.localize(
                'ogun/preferences/guidedTypingThreshold',
                'How much of a guided command the learner types before Ogun fills in the rest. 1 means never fill in.'
            )
        }
    }
};
