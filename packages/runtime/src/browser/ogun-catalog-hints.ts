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

import { ContributionProvider } from '@ogun/core';
import { inject, injectable, named, postConstruct } from '@ogun/core/shared/inversify';
import { CatalogHint } from '../common/ogun-catalog';

export const OgunCatalogContribution = Symbol('OgunCatalogContribution');

/**
 * Adds plain-language knowledge about surfaces.
 *
 * A feature that wants to be understandable — by a newcomer or by Clyffy, which are the
 * same problem — contributes hints for its own surfaces here rather than writing tooltip
 * strings in one place and AI instructions in another.
 */
export interface OgunCatalogContribution {
    /** Surface address → what a person should be told about it. */
    hints(): Record<string, CatalogHint>;
}

/**
 * The catalog's memory.
 *
 * One sentence per surface, resolved once and read by both audiences: the tooltip layer
 * renders it for the operator, the surface providers hand it to Clyffy. If those two ever
 * disagree it is because someone wrote the sentence twice, which is exactly what having a
 * single store prevents.
 */
@injectable()
export class OgunCatalogHints {

    @inject(ContributionProvider) @named(OgunCatalogContribution)
    protected readonly contributions: ContributionProvider<OgunCatalogContribution>;

    protected readonly hints = new Map<string, CatalogHint>();

    @postConstruct()
    protected init(): void {
        for (const contribution of this.contributions.getContributions()) {
            for (const [id, hint] of Object.entries(contribution.hints())) {
                this.hints.set(id, { ...this.hints.get(id), ...hint });
            }
        }
    }

    for(id: string): CatalogHint | undefined {
        return this.hints.get(id);
    }

    /** Every address we can explain — the tooltip layer walks this rather than the DOM. */
    get known(): ReadonlyMap<string, CatalogHint> {
        return this.hints;
    }
}
