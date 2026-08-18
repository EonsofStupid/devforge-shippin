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
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';
import { MiniBrowser } from '@theia/mini-browser/lib/browser/mini-browser';
import { MiniBrowserOpenHandler } from '@theia/mini-browser/lib/browser/mini-browser-open-handler';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { SurfaceDescriptor, SurfaceKind } from '../common/webforge-surfaces';
import { WebForgeRuntimeBus } from './webforge-runtime-bus';
import { WebForgeSurfaceProvider } from './webforge-surface-registry';

/**
 * Any loopback URL a dev server prints when it comes up.
 *
 * The path stops at punctuation on purpose: servers announce themselves inside prose
 * and brackets — python prints `(http://0.0.0.0:5199/)` — and a greedy match drags the
 * closing paren into the URL.
 */
const SERVED_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::\]):(\d{4,5})(\/[^\s"'<>)\]]*)?/i;

/** Marks a URL that already points at this instance's preview proxy. */
const PROXY_PATH = '/webforge/preview/';

/**
 * The preview — the running thing, beside the code.
 *
 * Lowering the barrier is mostly about shortening the distance between "I said what I
 * wanted" and "I can see it". A newcomer should never have to learn what a dev server
 * is, which port it chose, or why `localhost` in their browser is not the same
 * `localhost` as the instance's: they run the project and the app appears.
 *
 * So we watch what the terminals print, and the first time something starts serving we
 * open it — through the instance's own proxy, because the operator's browser cannot
 * reach the instance's loopback directly.
 */
@injectable()
export class WebForgePreview implements FrontendApplicationContribution, WebForgeSurfaceProvider {

    readonly kind: SurfaceKind = 'preview';

    @inject(MiniBrowserOpenHandler)
    protected readonly miniBrowser: MiniBrowserOpenHandler;

    @inject(TerminalService)
    protected readonly terminals: TerminalService;

    @inject(WebForgeRuntimeBus)
    protected readonly bus: WebForgeRuntimeBus;

    protected readonly toDispose = new DisposableCollection();
    protected widget: MiniBrowser | undefined;
    protected currentUrl: string | undefined;
    /** Ports already offered, so a chatty dev server does not reopen the pane each rebuild. */
    protected readonly seenPorts = new Set<number>();

    onStart(): void {
        for (const terminal of this.terminals.all) {
            this.watch(terminal.onOutput(data => this.sniff(data)));
        }
        this.toDispose.push(this.terminals.onDidCreateTerminal(terminal =>
            this.watch(terminal.onOutput(data => this.sniff(data)))
        ));
    }

    onStop(): void {
        this.toDispose.dispose();
    }

    protected watch(disposable: { dispose(): void }): void {
        this.toDispose.push(disposable);
    }

    /** Notice a dev server announcing itself and put it on screen. */
    protected sniff(output: string): void {
        if (output.includes(PROXY_PATH)) {
            // Our own proxy URL echoed back through a log line is not a new dev server.
            return;
        }
        const match = SERVED_URL.exec(output);
        if (!match) {
            return;
        }
        const port = Number(match[1]);
        // The instance's own port is not a preview, and neither is a port we already showed.
        if (this.seenPorts.has(port) || port === Number(window.location.port)) {
            return;
        }
        this.seenPorts.add(port);
        this.bus.emit('state.devserver.detected', { port });
        this.open(this.proxied(port, match[2] ?? '/')).catch(() => { /* the operator can open it by hand */ });
    }

    /**
     * Rewrite a loopback URL to the instance's preview proxy. The operator's browser is
     * not on the instance, so its own `localhost` is the wrong machine — this is the
     * translation that makes hosted preview work at all.
     */
    protected proxied(port: number, path = '/'): string {
        const base = `${window.location.origin}/webforge/preview/${port}`;
        return `${base}${path.startsWith('/') ? path : `/${path}`}`;
    }

    /** Open (or navigate) the preview pane. Accepts a loopback URL or an absolute one. */
    async open(url: string): Promise<string> {
        const target = this.rewriteIfLoopback(url);
        this.widget = await this.miniBrowser.open(MiniBrowserOpenHandler.PREVIEW_URI, {
            name: 'Preview',
            startPage: target,
            toolbar: 'read-only',
            widgetOptions: { area: 'main', mode: 'split-right' },
            openFor: 'preview'
        });
        this.currentUrl = target;
        this.bus.emit('act.preview.opened', { url: target });
        return target;
    }

    protected rewriteIfLoopback(url: string): string {
        // Already proxied — rewriting again would nest the instance's own port inside the
        // path and point the preview at itself.
        if (url.includes(PROXY_PATH)) {
            return url;
        }
        const match = SERVED_URL.exec(url);
        return match ? this.proxied(Number(match[1]), match[2] ?? '/') : url;
    }

    async reload(): Promise<void> {
        if (this.currentUrl) {
            await this.open(this.currentUrl);
        }
    }

    // ── surface plane ─────────────────────────────────────────────────────────
    // The preview is drivable like anything else: no new channel ops needed.

    async list(): Promise<SurfaceDescriptor[]> {
        return [{
            id: 'preview:app',
            kind: 'preview',
            label: 'Preview',
            zone: 'main',
            capabilities: ['read', 'set', 'focus', 'invoke'],
            description: 'The running application. Set it to a URL to navigate; invoke it to reload.',
            value: this.currentUrl
        }];
    }

    async read(): Promise<string | undefined> {
        return this.currentUrl;
    }

    async set(_id: string, value: string): Promise<void> {
        await this.open(value);
        this.bus.emit('act.preview.navigated', { url: this.currentUrl ?? value });
    }

    async focus(): Promise<void> {
        this.widget?.activate();
    }

    async invoke(): Promise<void> {
        await this.reload();
    }
}
