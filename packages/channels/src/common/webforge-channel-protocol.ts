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

/**
 * WebForge direct channels — the Act plane.
 *
 * The backend exposes an HTTP endpoint (`/webforge/channel`) that ANY authorized
 * client can drive: Clyffy's seats today, the Shippin chat webapp tomorrow. Ops are
 * forwarded over Theia RPC to the frontend, which executes them VISIBLY — the point
 * is to show and teach, never to act invisibly. Every op returns a typed receipt.
 */

import { SurfaceActionResult, SurfaceDescriptor, SurfaceQuery } from '@ogun/runtime/lib/common/webforge-surfaces';

export const WEBFORGE_CHANNEL_SERVICE_PATH = '/services/webforge-channels';

export const WebForgeChannelService = Symbol('WebForgeChannelService');
export const WebForgeChannelClient = Symbol('WebForgeChannelClient');

export interface WebForgeStateSnapshot {
    /** Workspace root(s) as file-system paths. */
    workspaceRoots: string[];
    /** The active editor's file path, if any. */
    activeEditor?: string;
    /** Paths of all open editors. */
    openEditors: string[];
    /** Titles of terminals currently open. */
    terminals: string[];
}

/**
 * Implemented in the FRONTEND: executes channel ops in the live, visible workbench.
 */
export interface WebForgeChannelClient {
    /** Open a file in an editor (visible, focused). Returns the opened path. */
    openFile(path: string, line?: number): Promise<{ opened: string }>;
    /**
     * Type into the WebForge teaching terminal — visibly. Creates/reveals the terminal
     * if needed. When `submit` is true a newline is sent so the command executes.
     */
    terminalType(text: string, submit?: boolean): Promise<{ typed: number; submitted: boolean }>;
    /** Show a short teaching note to the user (non-blocking). */
    notify(text: string, kind?: 'info' | 'warn'): Promise<{ shown: boolean }>;
    /** The See plane: a typed snapshot of what the user currently sees. */
    getState(): Promise<WebForgeStateSnapshot>;
    /**
     * Guided typing — the teaching mechanic: the target command floats above the
     * teaching terminal; the learner types; correct characters go green live; at the
     * threshold (default 0.7) the remainder auto-fills and the learner confirms with
     * Enter. Never punishes a wrong key. Resolves when the guide is SHOWN (completion
     * arrives asynchronously on the event tape).
     */
    guideType(command: string, note?: string, threshold?: number): Promise<{ started: boolean }>;

    // ── The surface plane ─────────────────────────────────────────────────────
    // Everything the operator can touch is addressable, so Clyffy drives the
    // application the way a person does — find the thing, use it — instead of
    // needing a bespoke op per feature.

    /** Find surfaces: inputs, settings, commands, views, editors, terminals. */
    listSurfaces(query: SurfaceQuery): Promise<SurfaceDescriptor[]>;
    /** Read a surface's value. Sensing, never an act. */
    readSurface(id: string): Promise<SurfaceActionResult>;
    /** Replace a surface's value outright. */
    setSurface(id: string, value: string): Promise<SurfaceActionResult>;
    /** Bring a surface to the operator's attention. */
    focusSurface(id: string): Promise<SurfaceActionResult>;
    /** Trigger a surface: run a command, press a button, submit a field. */
    invokeSurface(id: string, args?: unknown[]): Promise<SurfaceActionResult>;
    /**
     * Type into a surface for real — character by character, at a human cadence, with
     * the surface marked so the operator can see Clyffy is at the keyboard.
     */
    typeInto(id: string, text: string, options?: { cadence?: number; submit?: boolean }): Promise<{ typed: number }>;
}

/**
 * Implemented in the BACKEND: holds the RPC client (the connected frontend) and is
 * driven by the HTTP endpoint. Outcomes are reported by the frontend straight onto the
 * runtime bus, which is what gives them provenance — this service only routes ops.
 */
export interface WebForgeChannelService {
    setClient(client: WebForgeChannelClient | undefined): void;
}
