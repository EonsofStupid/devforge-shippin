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

import { CommandRegistry, DisposableCollection, ILogger, nls, PreferenceChange, PreferenceService } from '@theia/core';
import { ApplicationShell, StorageService } from '@theia/core/lib/browser';
import { PerspectiveService, PerspectiveServiceImpl } from '@theia/core/lib/browser/perspective-service';
import { inject, injectable, named } from '@theia/core/shared/inversify';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { WebForgeRuntimeBus } from '@theia/webforge-runtime/lib/browser/webforge-runtime-bus';
import { WebForgeChannelClientImpl } from './webforge-channel-client-impl';
import { WEBFORGE_GUIDED_TYPING_THRESHOLD, WEBFORGE_WALKTHROUGH_LINEAGE, WebForgeLineage } from './webforge-preferences';
import { SceneAct, WalkthroughScene, walkthroughScenes } from './webforge-walkthrough-scenes';

/** Set once the operator has finished or dismissed the walkthrough for good. */
export const WALKTHROUGH_SEEN_KEY = 'webforge.walkthrough.seen';

const AI_CHAT_TOGGLE_COMMAND_ID = 'aiChat:toggle';
const CHAT_VIEW_WIDGET_ID = 'chat-view-widget';

/**
 * The guided walkthrough: Phosphor Flat art over the LIVE workbench.
 *
 * The overlay is deliberately not a wizard in a box. When a scene performs its act, the
 * scrim drops and the card retreats to a corner so the learner watches the real editor
 * open the real file, and the real terminal take the real command. That is the whole
 * design: the art is the invitation, the workbench is the classroom.
 *
 * Progress rides the event tape, so the competence ladder is measured rather than
 * assumed.
 */
@injectable()
export class WebForgeWalkthrough {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(StorageService)
    protected readonly storage: StorageService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(CommandRegistry)
    protected readonly commands: CommandRegistry;

    @inject(PerspectiveService)
    protected readonly perspectives: PerspectiveService;

    @inject(WebForgeChannelClientImpl)
    protected readonly acts: WebForgeChannelClientImpl;

    @inject(WebForgeRuntimeBus)
    protected readonly bus: WebForgeRuntimeBus;

    @inject(ILogger) @named('webforge-walkthrough')
    protected readonly logger: ILogger;

    protected scenes: WalkthroughScene[] = [];
    protected index = 0;
    protected root: HTMLElement | undefined;
    protected escListener: ((e: KeyboardEvent) => void) | undefined;
    protected readonly toDisposeOnClose = new DisposableCollection();

    get isOpen(): boolean {
        return !!this.root;
    }

    /** Has this operator already been through it (or dismissed it for good)? */
    async hasBeenSeen(): Promise<boolean> {
        return !!await this.storage.getData<boolean>(WALKTHROUGH_SEEN_KEY, false);
    }

    /** Forget that it was seen, so the next start shows it again. */
    async forget(): Promise<void> {
        await this.storage.setData(WALKTHROUGH_SEEN_KEY, false);
    }

    open(): void {
        if (this.root) {
            return;
        }
        this.scenes = walkthroughScenes();
        this.index = 0;
        this.build();
        this.report('started');
        this.render();
    }

    close(): void {
        if (this.escListener) {
            document.removeEventListener('keydown', this.escListener, true);
            this.escListener = undefined;
        }
        this.toDisposeOnClose.dispose();
        this.root?.remove();
        this.root = undefined;
    }

    protected get scene(): WalkthroughScene {
        return this.scenes[this.index];
    }

    protected build(): void {
        const root = document.createElement('div');
        root.className = 'webforge-walkthrough';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', nls.localize('webforge/walkthrough/label', 'WebForge guided walkthrough'));
        root.dataset.lineage = this.lineage();
        root.innerHTML = `
            <div class="wf-scrim"></div>
            <div class="wf-card">
                <div class="wf-art-slot"></div>
                <div class="wf-copy">
                    <div class="wf-step" aria-live="polite"></div>
                    <h3 class="wf-title"></h3>
                    <p class="wf-body"></p>
                    <div class="wf-actions">
                        <button type="button" class="wf-btn wf-btn-primary"></button>
                        <button type="button" class="wf-btn wf-btn-ghost"></button>
                    </div>
                    <div class="wf-dots" aria-hidden="true"></div>
                </div>
            </div>`;
        document.body.appendChild(root);
        this.root = root;

        this.query('.wf-btn-primary').addEventListener('click', () => this.advance());
        this.query('.wf-btn-ghost').addEventListener('click', () => this.leave());

        // Escape steps out without burning the walkthrough — it is offered again next
        // time. Only the explicit exit marks it as done.
        this.escListener = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.root) {
                e.stopPropagation();
                this.report('skipped');
                this.close();
            }
        };
        document.addEventListener('keydown', this.escListener, true);

        // Only lives as long as the overlay does — the walkthrough is opened and closed
        // repeatedly, so this must not accumulate on the service.
        this.toDisposeOnClose.push(this.preferences.onPreferenceChanged((change: PreferenceChange) => {
            if (change.preferenceName === WEBFORGE_WALKTHROUGH_LINEAGE && this.root) {
                // Tokens, not exports: the whole scene re-themes on one attribute.
                this.root.dataset.lineage = this.lineage();
            }
        }));
    }

    protected lineage(): WebForgeLineage {
        const value = this.preferences.get<string>(WEBFORGE_WALKTHROUGH_LINEAGE, 'amber');
        return value === 'green' || value === 'chroma' ? value : 'amber';
    }

    protected query(selector: string): HTMLElement {
        return this.root!.querySelector(selector) as HTMLElement;
    }

    protected render(): void {
        const scene = this.scene;
        const total = this.scenes.length;
        this.root!.classList.remove('wf-acting');
        this.query('.wf-art-slot').innerHTML = scene.art;
        this.query('.wf-step').textContent = nls.localizeByDefault('Step {0} of {1}', this.index + 1, total);
        this.query('.wf-title').textContent = scene.title;
        this.query('.wf-body').textContent = scene.body;

        const primary = this.query('.wf-btn-primary');
        primary.textContent = scene.actionLabel;
        const ghost = this.query('.wf-btn-ghost');
        ghost.textContent = this.index === total - 1
            ? nls.localizeByDefault('Close')
            : nls.localize('webforge/walkthrough/exit', 'Skip to the full IDE');

        this.query('.wf-dots').innerHTML = this.scenes
            .map((_, i) => `<i class="${i <= this.index ? 'on' : ''}"></i>`)
            .join('');

        // Replay the arrival on the beat; planes stagger, the focal plane settles last.
        const art = this.root!.querySelector('.wf-art');
        art?.classList.add('wf-playing');
        primary.focus();
        this.report('scene');
    }

    /** The primary button: perform this scene's act for real, then move on. */
    protected async advance(): Promise<void> {
        const scene = this.scene;
        const last = this.index === this.scenes.length - 1;

        if (scene.act !== 'none' && !this.root!.classList.contains('wf-acting')) {
            // Step aside so the learner sees the workbench do the thing.
            this.root!.classList.add('wf-acting');
            const primary = this.query('.wf-btn-primary');
            primary.textContent = nls.localize('webforge/walkthrough/next', 'Next →');
            try {
                await this.perform(scene.act);
            } catch (error) {
                this.logger.warn('[webforge-walkthrough] act failed', error);
                this.query('.wf-body').textContent = nls.localize(
                    'webforge/walkthrough/actFailed',
                    'That one did not work here — nothing is broken, and the rest of the tour still applies.'
                );
            }
            return;
        }

        if (last) {
            await this.finish();
            return;
        }
        this.index++;
        this.render();
    }

    protected async perform(act: SceneAct): Promise<void> {
        switch (act) {
            case 'open-house-rules': {
                const path = await this.houseRulesPath();
                if (path) {
                    await this.acts.openFile(path);
                }
                return;
            }
            case 'guide-list-files': {
                const threshold = this.preferences.get<number>(WEBFORGE_GUIDED_TYPING_THRESHOLD, 0.7);
                await this.acts.guideType(
                    'ls',
                    nls.localize('webforge/walkthrough/lsNote', 'this shows what is in the folder'),
                    threshold
                );
                return;
            }
            case 'reveal-clyffy': {
                const revealed = await this.shell.revealWidget(CHAT_VIEW_WIDGET_ID);
                if (!revealed) {
                    await this.commands.executeCommand(AI_CHAT_TOGGLE_COMMAND_ID);
                }
                return;
            }
            case 'none': {
                return;
            }
        }
    }

    /**
     * The house rules a workspace already carries — seeded on first layout. Falls back
     * to a README, then to the first readable file, so the scene has something honest to
     * open in any workspace.
     */
    protected async houseRulesPath(): Promise<string | undefined> {
        const roots = await this.workspaceService.roots;
        for (const root of roots) {
            try {
                const stat = await this.fileService.resolve(root.resource);
                const children = stat.children ?? [];
                const preferred = children.find(c => c.name === 'AGENTS.md')
                    ?? children.find(c => c.name.toLowerCase().startsWith('readme'))
                    ?? children.find(c => c.isFile);
                if (preferred) {
                    return preferred.resource.path.fsPath();
                }
            } catch (error) {
                this.logger.warn('[webforge-walkthrough] could not read workspace root', error);
            }
        }
        return undefined;
    }

    protected async finish(): Promise<void> {
        this.report('completed');
        await this.storage.setData(WALKTHROUGH_SEEN_KEY, true);
        this.close();
    }

    /** The explicit exit: done for good, and straight into the full workbench. */
    protected async leave(): Promise<void> {
        const last = this.index === this.scenes.length - 1;
        this.report(last ? 'completed' : 'skipped');
        await this.storage.setData(WALKTHROUGH_SEEN_KEY, true);
        this.close();
        if (!last) {
            await this.perspectives.switchPerspective(PerspectiveServiceImpl.DEFAULT_PERSPECTIVE_ID);
        }
    }

    protected report(type: 'started' | 'scene' | 'completed' | 'skipped'): void {
        this.bus.emit(`teach.walkthrough.${type}`, {
            scene: this.scene?.id ?? 'unknown',
            index: this.index,
            total: this.scenes.length
        });
    }
}
