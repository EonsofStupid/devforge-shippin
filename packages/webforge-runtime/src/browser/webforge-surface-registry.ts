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

import { ContributionProvider, ILogger } from '@theia/core';
import { inject, injectable, named } from '@theia/core/shared/inversify';
import { dangerExceeds, SURFACE_KINDS, SurfaceActionResult, SurfaceDescriptor, SurfaceKind, SurfaceQuery } from '../common/webforge-surfaces';
import { WebForgeRuntimeBus } from './webforge-runtime-bus';

export const WebForgeSurfaceProvider = Symbol('WebForgeSurfaceProvider');

/**
 * Contributes a family of surfaces. A feature that adds one becomes drivable by Clyffy
 * immediately — no new channel op, no new AI instruction.
 */
export interface WebForgeSurfaceProvider {
    readonly kind: SurfaceKind;
    list(query: SurfaceQuery): Promise<SurfaceDescriptor[]>;
    read?(id: string): Promise<string | undefined>;
    set?(id: string, value: string): Promise<void>;
    focus?(id: string): Promise<void>;
    invoke?(id: string, args?: unknown[]): Promise<void>;
    /** The element text should be typed into, when this surface accepts typing. */
    resolveTypeTarget?(id: string): Promise<HTMLElement | undefined>;
}

/** Surface addresses are `<kind>:<rest>`; the kind routes to its provider. */
export function surfaceKindOf(id: string): SurfaceKind | undefined {
    const kind = id.split(':', 1)[0];
    return (SURFACE_KINDS as readonly string[]).includes(kind) ? kind as SurfaceKind : undefined;
}

/**
 * The surface registry — the engine's map of everything touchable.
 *
 * The point is generality: Clyffy finds a thing by searching for it and then uses the
 * capability it declares, exactly as a person would. Reads are sensing and never
 * counted as acts; anything that changes the world is recorded with its provenance.
 */
@injectable()
export class WebForgeSurfaceRegistry {

    @inject(ContributionProvider) @named(WebForgeSurfaceProvider)
    protected readonly providers: ContributionProvider<WebForgeSurfaceProvider>;

    @inject(WebForgeRuntimeBus)
    protected readonly bus: WebForgeRuntimeBus;

    @inject(ILogger) @named('webforge-runtime')
    protected readonly logger: ILogger;

    protected provider(kind: SurfaceKind | undefined): WebForgeSurfaceProvider | undefined {
        return kind ? this.providers.getContributions().find(p => p.kind === kind) : undefined;
    }

    protected providerFor(id: string): WebForgeSurfaceProvider {
        const provider = this.provider(surfaceKindOf(id));
        if (!provider) {
            throw new Error(`no surface provider for '${id}' — addresses are '<kind>:<name>'`);
        }
        return provider;
    }

    async list(query: SurfaceQuery = {}): Promise<SurfaceDescriptor[]> {
        const providers = query.kind ? [this.provider(query.kind)] : this.providers.getContributions();
        const collected: SurfaceDescriptor[] = [];
        for (const provider of providers) {
            if (!provider) {
                continue;
            }
            try {
                collected.push(...await provider.list(query));
            } catch (error) {
                this.logger.warn(`[webforge-runtime] surface provider '${provider.kind}' failed to list`, error);
            }
        }
        const filtered = collected.filter(surface => this.matches(surface, query));
        const limited = filtered.slice(0, Math.max(1, Math.min(500, query.limit ?? 100)));
        this.bus.emit('sense.surface.listed', { count: limited.length, filter: query.match ?? '' });
        return limited;
    }

    /**
     * The catalog is large on purpose, so narrowing it is a first-class operation:
     * by words, by where it lives, and by how much damage it could do. `maxDanger` is
     * what lets the simplified layer offer a newcomer only the surfaces that cannot
     * bite, out of the same catalog the full layer serves.
     */
    protected matches(surface: SurfaceDescriptor, query: SurfaceQuery): boolean {
        const match = query.match?.toLowerCase();
        if (match && !surface.id.toLowerCase().includes(match)
            && !surface.label.toLowerCase().includes(match)
            && !surface.description?.toLowerCase().includes(match)) {
            return false;
        }
        if (query.zone && surface.zone !== query.zone) {
            return false;
        }
        if (query.maxDanger && dangerExceeds(surface.danger, query.maxDanger)) {
            return false;
        }
        return true;
    }

    /** Sensing. Never an act, never on the act plane. */
    async read(id: string): Promise<SurfaceActionResult> {
        const provider = this.providerFor(id);
        if (!provider.read) {
            return { surface: id, ok: false, detail: 'surface cannot be read' };
        }
        return { surface: id, ok: true, value: await provider.read(id) };
    }

    async set(id: string, value: string): Promise<SurfaceActionResult> {
        const provider = this.providerFor(id);
        if (!provider.set) {
            return { surface: id, ok: false, detail: 'surface cannot be set' };
        }
        await provider.set(id, value);
        this.bus.emit('act.surface.set', { surface: id, kind: provider.kind, chars: value.length });
        const readBack = provider.read ? await provider.read(id) : undefined;
        return { surface: id, ok: true, value: readBack };
    }

    async focus(id: string): Promise<SurfaceActionResult> {
        const provider = this.providerFor(id);
        if (!provider.focus) {
            return { surface: id, ok: false, detail: 'surface cannot be focused' };
        }
        await provider.focus(id);
        this.bus.emit('act.surface.focused', { surface: id, kind: provider.kind });
        return { surface: id, ok: true };
    }

    async invoke(id: string, args?: unknown[]): Promise<SurfaceActionResult> {
        const provider = this.providerFor(id);
        if (!provider.invoke) {
            return { surface: id, ok: false, detail: 'surface cannot be invoked' };
        }
        await provider.invoke(id, args);
        this.bus.emit('act.surface.invoked', { surface: id, kind: provider.kind });
        return { surface: id, ok: true };
    }

    /** The element to type into, if this surface takes typing. */
    async typeTarget(id: string): Promise<HTMLElement | undefined> {
        const provider = this.providerFor(id);
        await provider.focus?.(id);
        return provider.resolveTypeTarget?.(id);
    }
}
