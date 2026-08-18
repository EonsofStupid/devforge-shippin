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

import { DisposableCollection } from '@theia/core';
import { ApplicationShell, FrontendApplicationContribution, HoverService, Widget } from '@theia/core/lib/browser';
import { TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { inject, injectable } from '@theia/core/shared/inversify';
import { WebForgeCatalogHints } from './webforge-catalog-hints';

/**
 * Mark any element with the address of the surface it represents, and it explains itself.
 *
 *     <button data-webforge-surface="command:webforge.layer.full">…</button>
 */
export const SURFACE_ATTRIBUTE = 'data-webforge-surface';

/** Theia's toolbar container; its item divs carry the action id as their DOM id. */
const TOOLBAR = '.lm-TabBar-toolbar';

/**
 * Tooltips, from the catalog.
 *
 * This is the visible half of the bargain the catalog makes. Clyffy needs a sentence
 * explaining what a surface is for; so does a person who has never used an IDE. Writing
 * that sentence twice guarantees the two drift, and the operator ends up with a tooltip
 * that says something different from what the assistant believes — so there is one
 * sentence, stored once, and this renders it.
 *
 * Delegated from the document rather than attached per element: the workbench builds and
 * discards controls constantly, and a listener per control is a leak waiting to happen.
 */
@injectable()
export class WebForgeTooltips implements FrontendApplicationContribution {

    @inject(HoverService)
    protected readonly hovers: HoverService;

    @inject(WebForgeCatalogHints)
    protected readonly hints: WebForgeCatalogHints;

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(TabBarToolbarRegistry)
    protected readonly toolbars: TabBarToolbarRegistry;

    protected readonly toDispose = new DisposableCollection();
    protected showing: HTMLElement | undefined;

    onStart(): void {
        const over = (event: MouseEvent) => this.consider(event.target);
        const out = () => this.hide();
        document.addEventListener('mouseover', over, true);
        document.addEventListener('mouseleave', out, true);
        this.toDispose.push({
            dispose: () => {
                document.removeEventListener('mouseover', over, true);
                document.removeEventListener('mouseleave', out, true);
            }
        });
    }

    onStop(): void {
        this.toDispose.dispose();
    }

    protected consider(target: EventTarget | null): void {
        if (!(target instanceof HTMLElement)) {
            this.hide();
            return;
        }
        const element = target.closest<HTMLElement>(`[${SURFACE_ATTRIBUTE}]`);
        if (!element) {
            this.improveToolbarTitle(target);
            this.hide();
            return;
        }
        if (element === this.showing) {
            return;
        }
        const surface = element.getAttribute(SURFACE_ATTRIBUTE)!;
        const description = this.hints.for(surface)?.description;
        if (!description) {
            // Nobody has written this one yet. A missing sentence is a gap in the catalog,
            // not a reason to invent one at render time.
            this.hide();
            return;
        }
        this.showing = element;
        this.hovers.requestHover({ content: description, target: element, position: 'bottom' });
    }

    /**
     * Toolbar buttons already carry the tooltip their author wrote, and Theia already
     * renders it. Where the catalog has a friendlier sentence we swap it in place rather
     * than opening a second tooltip beside the first — one control, one explanation.
     */
    protected improveToolbarTitle(target: HTMLElement): void {
        const item = target.closest<HTMLElement>(`${TOOLBAR} [id]`);
        const widget = item && this.ownerOf(item.id);
        if (!item || !widget) {
            return;
        }
        const description = this.hints.for(`button:${widget.id}/${item.id}`)?.description;
        if (description && item.title !== description) {
            item.title = description;
        }
    }

    /**
     * Which view does this button belong to?
     *
     * Not the DOM's answer: a view's toolbar is rendered on the *tab bar*, outside the
     * widget's own node, so containment never finds it. The registry knows, because it is
     * what decided the button should be shown for that widget at all — and preferring a
     * visible widget settles the case where two views contribute the same action id.
     */
    protected ownerOf(itemId: string): Widget | undefined {
        let fallback: Widget | undefined;
        for (const widget of this.shell.widgets) {
            let owns = false;
            try {
                owns = this.toolbars.visibleItems(widget).some(item => item.id === itemId);
            } catch {
                continue;
            }
            if (!owns) {
                continue;
            }
            if (widget.isVisible) {
                return widget;
            }
            fallback ??= widget;
        }
        return fallback;
    }

    protected hide(): void {
        if (this.showing) {
            this.showing = undefined;
            this.hovers.cancelHover();
        }
    }
}
