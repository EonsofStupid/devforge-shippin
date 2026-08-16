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

import { Command, CommandContribution, CommandRegistry, Emitter, Event } from '@theia/core';
import { ContextKey, ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { WebForgeRuntimeBus } from './webforge-runtime-bus';

/**
 * The two layers.
 *
 * WebForge is one application wearing two faces. The **simplified** layer is what a
 * newcomer meets: larger type, fewer surfaces competing for attention, the machinery
 * folded away. The **full** layer is the professional workbench with nothing withheld.
 *
 * Crucially this is a presentation state, not two builds and not a feature gate: every
 * command, view and setting is reachable in both, and the layer is published as the
 * `webforge.layer` context key so any contribution — ours or upstream — can adapt with
 * a `when` clause instead of forking. Moving between them is one click and is recorded,
 * because when a person outgrows the simplified layer, that is the signal we care about.
 */
export type WebForgeLayer = 'simplified' | 'full';

export const WEBFORGE_LAYER_CONTEXT_KEY = 'webforge.layer';
export const WEBFORGE_LAYER_BODY_ATTRIBUTE = 'data-webforge-layer';

export const WebForgeLayerCommands = {
    SIMPLIFIED: Command.toLocalizedCommand({
        id: 'webforge.layer.simplified',
        category: 'WebForge',
        label: 'Use the Simplified Layer'
    }, 'webforge/commands/layerSimplified'),
    FULL: Command.toLocalizedCommand({
        id: 'webforge.layer.full',
        category: 'WebForge',
        label: 'Use the Full Workbench'
    }, 'webforge/commands/layerFull')
};

@injectable()
export class WebForgeLayerService implements CommandContribution {

    @inject(ContextKeyService)
    protected readonly contextKeys: ContextKeyService;

    @inject(WebForgeRuntimeBus)
    protected readonly bus: WebForgeRuntimeBus;

    protected layerKey: ContextKey<string>;
    protected current: WebForgeLayer = 'simplified';

    protected readonly onDidChangeEmitter = new Emitter<WebForgeLayer>();
    readonly onDidChangeLayer: Event<WebForgeLayer> = this.onDidChangeEmitter.event;

    @postConstruct()
    protected init(): void {
        this.layerKey = this.contextKeys.createKey<string>(WEBFORGE_LAYER_CONTEXT_KEY, this.current);
        this.apply(this.current);
    }

    get layer(): WebForgeLayer {
        return this.current;
    }

    set(layer: WebForgeLayer): void {
        if (layer === this.current) {
            return;
        }
        this.current = layer;
        this.apply(layer);
        this.bus.emit('state.layer.changed', { layer });
        this.onDidChangeEmitter.fire(layer);
    }

    protected apply(layer: WebForgeLayer): void {
        this.layerKey.set(layer);
        // One attribute on the document is what the whole simplified stylesheet hangs
        // off — type scale, density, chrome — so the layer costs nothing to switch.
        document.body.setAttribute(WEBFORGE_LAYER_BODY_ATTRIBUTE, layer);
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(WebForgeLayerCommands.SIMPLIFIED, { execute: () => this.set('simplified') });
        registry.registerCommand(WebForgeLayerCommands.FULL, { execute: () => this.set('full') });
    }
}
