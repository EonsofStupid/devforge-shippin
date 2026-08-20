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

import { CommandRegistry, DisposableCollection, ILogger, nls, PreferenceChange, PreferenceService } from '@ogun/core';
import { ApplicationShell, StorageService } from '@ogun/core/lib/browser';
import { PerspectiveService, PerspectiveServiceImpl } from '@ogun/core/lib/browser/perspective-service';
import { inject, injectable, named } from '@ogun/core/shared/inversify';
import { FileService } from '@ogun/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@ogun/workspace/lib/browser';
import { OgunRuntimeBus } from '@ogun/runtime/lib/browser/ogun-runtime-bus';
import { VSXExtensionsModel } from '@ogun/vsx-registry/lib/browser/vsx-extensions-model';
import { OgunChannelClientImpl } from './ogun-channel-client-impl';
import { OgunDialogue } from '@ogun/clyffy/lib/browser/dialogue';
import { OGUN_GUIDED_TYPING_THRESHOLD, OGUN_WALKTHROUGH_LINEAGE, OgunLineage } from './ogun-preferences';
import { SceneAct, WalkthroughScene, walkthroughScenes } from './ogun-walkthrough-scenes';

/** Set once the operator has finished or dismissed the walkthrough for good. */
export const WALKTHROUGH_SEEN_KEY = 'ogun.walkthrough.seen';

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
/** One line that makes a real page, short enough to type without dread. */
const MAKE_COMMAND = 'echo hello > index.html';

/** Serving it is what the preview watches for; the port is arbitrary but must be stable. */
const SERVE_COMMAND = 'python3 -m http.server 5199';

/** A theme, because a changed editor is a benefit you can see from across the room. */
const WALKTHROUGH_THEME_ID = 'sdras.night-owl';

@injectable()
export class OgunWalkthrough {

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

    @inject(OgunChannelClientImpl)
    protected readonly acts: OgunChannelClientImpl;

    @inject(VSXExtensionsModel)
    protected readonly extensions: VSXExtensionsModel;

    @inject(OgunRuntimeBus)
    protected readonly bus: OgunRuntimeBus;

    @inject(ILogger) @named('ogun-walkthrough')
    protected readonly logger: ILogger;

    protected scenes: WalkthroughScene[] = [];
    protected index = 0;
    protected root: HTMLElement | undefined;
    protected dialogue?: OgunDialogue;
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
        root.className = 'ogun-walkthrough';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', nls.localize('ogun/walkthrough/label', 'Ogun guided walkthrough'));
        root.dataset.lineage = this.lineage();
        root.innerHTML = `
            <div class="og-scrim"></div>
            <div class="og-card">
                <div class="og-art-slot"></div>
                <div class="og-copy">
                    <div class="og-step" aria-live="polite"></div>
                    <h3 class="og-title"></h3>
                    <div class="og-dialogue-slot"></div>
                    <div class="og-actions">
                        <button type="button" class="og-btn og-btn-primary"></button>
                        <button type="button" class="og-btn og-btn-ghost"></button>
                    </div>
                    <div class="og-dots" aria-hidden="true"></div>
                </div>
            </div>`;
        document.body.appendChild(root);
        this.root = root;

        // One dialogue frame for the whole walkthrough: Clyffy is a character who changes
        // expression, not a component that is rebuilt per step.
        this.dialogue = new OgunDialogue({
            speaker: nls.localize('ogun/walkthrough/speaker', 'Clyffy'),
            role: nls.localize('ogun/walkthrough/speakerRole', 'your guide')
        });
        this.toDisposeOnClose.push(this.dialogue);
        this.query('.og-dialogue-slot').appendChild(this.dialogue.node);

        this.query('.og-btn-primary').addEventListener('click', () => this.advance());
        this.query('.og-btn-ghost').addEventListener('click', () => this.leave());

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
            if (change.preferenceName === OGUN_WALKTHROUGH_LINEAGE && this.root) {
                // Tokens, not exports: the whole scene re-themes on one attribute.
                this.root.dataset.lineage = this.lineage();
            }
        }));
    }

    protected lineage(): OgunLineage {
        const value = this.preferences.get<string>(OGUN_WALKTHROUGH_LINEAGE, 'amber');
        return value === 'green' || value === 'chroma' ? value : 'amber';
    }

    protected query(selector: string): HTMLElement {
        return this.root!.querySelector(selector) as HTMLElement;
    }

    protected render(): void {
        const scene = this.scene;
        const total = this.scenes.length;
        this.root!.classList.remove('og-acting');
        this.query('.og-art-slot').innerHTML = scene.art;
        this.query('.og-step').textContent = nls.localizeByDefault('Step {0} of {1}', this.index + 1, total);
        this.query('.og-title').textContent = scene.title;
        this.dialogue!.mood = scene.mood ?? 'idle';
        this.dialogue!.role = nls.localize('ogun/walkthrough/speakerStep', 'step {0} of {1}', this.index + 1, total);
        this.dialogue!.say(scene.body);

        const primary = this.query('.og-btn-primary');
        primary.textContent = scene.actionLabel;
        const ghost = this.query('.og-btn-ghost');
        ghost.textContent = this.index === total - 1
            ? nls.localizeByDefault('Close')
            : nls.localize('ogun/walkthrough/exit', 'Skip to the full IDE');

        this.query('.og-dots').innerHTML = this.scenes
            .map((_, i) => `<i class="${i <= this.index ? 'on' : ''}"></i>`)
            .join('');

        // Replay the arrival on the beat; planes stagger, the focal plane settles last.
        const art = this.root!.querySelector('.og-art');
        art?.classList.add('og-playing');
        primary.focus();
        this.report('scene');
    }

    /** The primary button: perform this scene's act for real, then move on. */
    protected async advance(): Promise<void> {
        const scene = this.scene;
        const last = this.index === this.scenes.length - 1;

        if (scene.act !== 'none' && !this.root!.classList.contains('og-acting')) {
            // Step aside so the learner sees the workbench do the thing.
            this.root!.classList.add('og-acting');
            const primary = this.query('.og-btn-primary');
            primary.textContent = nls.localize('ogun/walkthrough/next', 'Next →');
            try {
                await this.perform(scene.act);
            } catch (error) {
                this.logger.warn('[ogun-walkthrough] act failed', error);
                this.query('.og-body').textContent = nls.localize(
                    'ogun/walkthrough/actFailed',
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
                await this.acts.guideType(
                    'ls',
                    nls.localize('ogun/walkthrough/lsNote', 'this shows what is in the folder'),
                    this.threshold()
                );
                return;
            }
            case 'guide-make-file': {
                await this.acts.guideType(
                    MAKE_COMMAND,
                    nls.localize('ogun/walkthrough/makeNote', 'this writes a page and puts it in your folder'),
                    this.threshold()
                );
                return;
            }
            case 'guide-serve': {
                // The preview opens itself: the runtime watches terminal output for a
                // served URL and puts the running thing beside the code. Nothing here has
                // to know about ports, which is the point of having built that.
                await this.acts.guideType(
                    SERVE_COMMAND,
                    nls.localize('ogun/walkthrough/serveNote', 'this starts your page so it can be looked at'),
                    this.threshold()
                );
                return;
            }
            case 'install-theme': {
                await this.installTheme();
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

    protected threshold(): number {
        return this.preferences.get<number>(OGUN_GUIDED_TYPING_THRESHOLD, 0.7);
    }

    /**
     * Install an extension in front of the operator.
     *
     * A theme rather than a tool on purpose: the benefit of a formatter is invisible until
     * you format something, whereas a theme is a benefit you can see from across the room.
     *
     * It is installed but NOT applied. The scene promises to show them how installing
     * works, not to redecorate their editor, and changing how someone's screen looks
     * without being asked reads as an intrusion however pretty the result.
     *
     * Installing reaches the network, and the network is allowed to be down. A walkthrough
     * step that throws would strand the operator mid-tour, so a failure is reported as a
     * failure and the tour continues — the honest outcome lands on the tape either way.
     */
    protected async installTheme(): Promise<void> {
        try {
            const extension = await this.extensions.resolve(WALKTHROUGH_THEME_ID);
            await extension.install();
            this.bus.emit('act.extension.installed', { name: extension.displayName ?? WALKTHROUGH_THEME_ID });
        } catch (error) {
            this.acts.notify(nls.localize(
                'ogun/walkthrough/themeFailed',
                'I could not reach the extension shop just now — the Extensions panel on the left does the same job when you want it.'
            ));
            console.warn('[ogun-walkthrough] theme install failed', error);
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
                this.logger.warn('[ogun-walkthrough] could not read workspace root', error);
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
