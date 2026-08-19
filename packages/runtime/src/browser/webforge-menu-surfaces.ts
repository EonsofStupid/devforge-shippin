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

import { CommandMenu, CompoundMenuNode, MenuModelRegistry, MenuNode, MenuPath, RenderedMenuNode } from '@ogun/core';
import { ApplicationShell, Widget } from '@ogun/core/lib/browser';
import { ContextKeyService } from '@ogun/core/lib/browser/context-key-service';
import { TabBarToolbarRegistry } from '@ogun/core/lib/browser/shell/tab-bar-toolbar';
import { TabBarToolbarItem } from '@ogun/core/lib/browser/shell/tab-bar-toolbar/tab-toolbar-item';
import { inject, injectable } from '@ogun/core/shared/inversify';
import { classifyDanger } from '../common/webforge-catalog';
import { SurfaceDescriptor, SurfaceKind, SurfaceQuery } from '../common/webforge-surfaces';
import { WebForgeCatalogHints } from './webforge-catalog-hints';
import { WebForgeSurfaceProvider } from './webforge-surface-registry';

/** Everything after the first `:` — the address minus its kind. */
function tail(id: string): string {
    return id.slice(id.indexOf(':') + 1);
}

/** Theia's toolbar container — a view's buttons live here, not inside the view. */
const TOOLBAR = '.lm-TabBar-toolbar';

/** Menus nest a few levels; a cycle would be a bug, but a bound makes it a harmless one. */
const MAX_MENU_DEPTH = 6;

/** The breadcrumb separator an operator reads: "File › Save All". */
const CRUMB = ' › ';

/**
 * Menus, addressable.
 *
 * This is the surface that removes the last reason to look at the screen. Until now
 * Clyffy could run a *command* if it already knew the id, but "what can I do from here"
 * meant a screenshot and a guess. A menu tree is exactly the answer to that question,
 * and the workbench has always had one — it was simply never exposed as data.
 *
 * Addresses are the real menu path (`menu:menubar/1_file/file.save`) so that they round
 * trip through {@link MenuModelRegistry.getMenuNode}; the human-readable breadcrumb rides
 * along in the label, where it belongs.
 */
@injectable()
export class MenuSurfaceProvider implements WebForgeSurfaceProvider {

    readonly kind: SurfaceKind = 'menu';

    @inject(MenuModelRegistry)
    protected readonly menus: MenuModelRegistry;

    @inject(ContextKeyService)
    protected readonly contextKeys: ContextKeyService;

    @inject(WebForgeCatalogHints)
    protected readonly hints: WebForgeCatalogHints;

    async list(query: SurfaceQuery = {}): Promise<SurfaceDescriptor[]> {
        const from = query.parent ? tail(query.parent).split('/') : [];
        const root = this.menus.getMenuNode(from);
        if (!root || !CompoundMenuNode.is(root)) {
            return [];
        }
        const collected: SurfaceDescriptor[] = [];
        // With an explicit parent the caller is walking the tree a level at a time, so
        // stop there; otherwise flatten the whole thing, which is what a client that
        // wants "everything I could do" is really asking for.
        this.walk(root, from, [], collected, query.parent ? 1 : MAX_MENU_DEPTH);
        return collected;
    }

    protected walk(node: CompoundMenuNode, path: string[], crumbs: string[], into: SurfaceDescriptor[], depth: number): void {
        if (depth <= 0) {
            return;
        }
        for (const child of node.children) {
            if (!this.isVisible(child, path)) {
                continue;
            }
            const childPath = [...path, child.id];
            const label = RenderedMenuNode.is(child) ? child.label : undefined;
            // Groups are structure, not choices: they carry no label and an operator never
            // sees them, so they widen the walk without appearing in the catalog.
            const childCrumbs = label ? [...crumbs, label] : crumbs;
            if (CommandMenu.is(child)) {
                into.push(this.describe(child, childPath, childCrumbs, path));
            } else if (CompoundMenuNode.is(child)) {
                if (label) {
                    into.push(this.describeSubmenu(childPath, childCrumbs, path));
                }
                this.walk(child, childPath, childCrumbs, into, label ? depth - 1 : depth);
            }
        }
    }

    protected isVisible(node: MenuNode, path: MenuPath): boolean {
        try {
            return node.isVisible(path, this.contextKeys, undefined);
        } catch {
            // A `when` clause that throws is the contribution's bug, not a reason to drop
            // the whole menu out of the catalog.
            return true;
        }
    }

    protected describe(node: CommandMenu, path: string[], crumbs: string[], parentPath: string[]): SurfaceDescriptor {
        const id = `menu:${path.join('/')}`;
        const hint = this.hints.for(id) ?? this.hints.for(`command:${node.id}`);
        return {
            id,
            kind: 'menu',
            label: crumbs.join(CRUMB) || node.label,
            zone: hint?.zone ?? this.zoneOf(path),
            capabilities: ['invoke'],
            description: hint?.description,
            danger: hint?.danger ?? classifyDanger(node.id, node.label),
            enabled: this.isEnabled(node, path),
            parent: `menu:${parentPath.join('/')}`
        };
    }

    protected describeSubmenu(path: string[], crumbs: string[], parentPath: string[]): SurfaceDescriptor {
        const id = `menu:${path.join('/')}`;
        return {
            id,
            kind: 'menu',
            label: crumbs.join(CRUMB),
            zone: this.zoneOf(path),
            // A menu is not a thing you do — it is a thing you look inside. Listing with
            // `parent` set to this address is the whole interaction.
            capabilities: [],
            description: this.hints.for(id)?.description ?? `A menu. List its contents with parent='${id}'.`,
            danger: 'safe',
            parent: parentPath.length ? `menu:${parentPath.join('/')}` : undefined
        };
    }

    protected isEnabled(node: CommandMenu, path: MenuPath): boolean {
        try {
            return node.isEnabled(path);
        } catch {
            return true;
        }
    }

    protected zoneOf(path: string[]): SurfaceDescriptor['zone'] {
        return path[0] === 'menubar' ? 'menubar' : 'palette';
    }

    async invoke(id: string, args: unknown[] = []): Promise<void> {
        const path = tail(id).split('/');
        const node = this.menus.getMenuNode(path);
        if (!node) {
            throw new Error(`no such menu entry: '${id}'`);
        }
        if (!CommandMenu.is(node)) {
            throw new Error(`'${id}' is a menu, not an entry — list its contents with parent='${id}'`);
        }
        await node.run(path, ...args);
    }
}

/**
 * Toolbar buttons, addressable.
 *
 * The little icons in a view's title bar are the most-used controls in the workbench and
 * the least discoverable — they are icons with no text, contributed by whoever owns the
 * view. Catalogued, they stop being a visual puzzle: each one has an address, the tooltip
 * its author already wrote, and a widget it belongs to.
 */
@injectable()
export class ButtonSurfaceProvider implements WebForgeSurfaceProvider {

    readonly kind: SurfaceKind = 'button';

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(TabBarToolbarRegistry)
    protected readonly toolbars: TabBarToolbarRegistry;

    @inject(WebForgeCatalogHints)
    protected readonly hints: WebForgeCatalogHints;

    async list(): Promise<SurfaceDescriptor[]> {
        const collected: SurfaceDescriptor[] = [];
        for (const widget of this.shell.widgets) {
            for (const item of this.itemsFor(widget)) {
                const id = `button:${widget.id}/${item.id}`;
                const node = item.toMenuNode?.();
                const label = node && RenderedMenuNode.is(node) ? node.label : item.id;
                const hint = this.hints.for(id);
                collected.push({
                    id,
                    kind: 'button',
                    label,
                    zone: 'toolbar',
                    capabilities: ['invoke', 'focus'],
                    description: hint?.description ?? `${label} — in the title bar of '${widget.title.label || widget.id}'.`,
                    danger: hint?.danger ?? classifyDanger(node?.id ?? item.id, label),
                    enabled: this.isEnabled(item, widget),
                    parent: `view:${widget.id}`
                });
            }
        }
        return collected;
    }

    protected itemsFor(widget: Widget): TabBarToolbarItem[] {
        try {
            return this.toolbars.visibleItems(widget);
        } catch {
            // Toolbars evaluate `when` clauses against a widget that may be mid-teardown.
            return [];
        }
    }

    protected isEnabled(item: TabBarToolbarItem, widget: Widget): boolean {
        try {
            return item.isEnabled(widget);
        } catch {
            return true;
        }
    }

    /**
     * Widget ids can contain slashes (an editor's id carries its file URI), toolbar item
     * ids do not — so the last slash is the boundary.
     */
    protected split(id: string): { widgetId: string; itemId: string } {
        const rest = tail(id);
        const cut = rest.lastIndexOf('/');
        return { widgetId: rest.slice(0, cut), itemId: rest.slice(cut + 1) };
    }

    protected resolve(id: string): { widget: Widget; item: TabBarToolbarItem } {
        const { widgetId, itemId } = this.split(id);
        const widget = this.shell.widgets.find(candidate => candidate.id === widgetId);
        if (!widget) {
            throw new Error(`no open view '${widgetId}' for button '${id}'`);
        }
        const item = this.itemsFor(widget).find(candidate => candidate.id === itemId);
        if (!item) {
            throw new Error(`view '${widgetId}' has no visible button '${itemId}'`);
        }
        return { widget, item };
    }

    async invoke(id: string, args: unknown[] = []): Promise<void> {
        const { item } = this.resolve(id);
        const node = item.toMenuNode?.();
        if (!node || !CommandMenu.is(node)) {
            throw new Error(`button '${id}' renders its own control and cannot be invoked through the catalog`);
        }
        await node.run([], ...args);
    }

    /**
     * Point at it. Guided teaching needs "that button, there" as much as it needs the
     * click — the operator has to learn where the thing lives, or they never stop asking.
     */
    async focus(id: string): Promise<void> {
        const { widget } = this.resolve(id);
        await this.shell.activateWidget(widget.id);
        const { itemId } = this.split(id);
        // A view's toolbar is rendered on the tab bar, OUTSIDE the widget's own node, so
        // searching the widget finds nothing. Search the toolbars, and take the one that
        // is actually on screen: the same action id can be contributed to more than one.
        const candidates = document.querySelectorAll<HTMLElement>(`${TOOLBAR} [id="${CSS.escape(itemId)}"]`);
        const element = [...candidates].find(candidate => !!candidate.offsetParent) ?? candidates[0];
        if (!element) {
            return;
        }
        element.classList.add(POINTING_CLASS);
        setTimeout(() => element.classList.remove(POINTING_CLASS), POINTING_MS);
    }
}

/** Applied while Clyffy points at a control, and removed again — see layers.css. */
export const POINTING_CLASS = 'webforge-clyffy-pointing';
const POINTING_MS = 2400;
