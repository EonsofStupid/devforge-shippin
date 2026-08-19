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

import { ChatService } from '@ogun/ai-chat/lib/common';
import { CommandRegistry, nls } from '@ogun/core';
import { WorkspaceService } from '@ogun/workspace/lib/browser';
import { BaseWidget, Message } from '@ogun/core/lib/browser';
import { inject, injectable, postConstruct } from '@ogun/core/shared/inversify';
import { ClyffyMood, clyffyPortrait } from '@ogun/clyffy/lib/browser/portrait';
import { OgunEvents, RuntimeEvent } from '@ogun/runtime/lib/common/ogun-runtime-events';
import { OgunRuntimeBus } from '@ogun/runtime/lib/browser/ogun-runtime-bus';

/**
 * Clyffy's chat — ours, not the upstream one wearing our colours.
 *
 * The engine underneath is kept on purpose: {@link ChatService} carries the agents, the
 * tool calls and the Claude Code seat, and rewriting that would be vandalism dressed as
 * ownership. What is replaced is everything the operator actually meets — a panel that
 * told them to type `@AgentName` and `#context` at a robot, which is a sentence only a
 * developer can parse and precisely the barrier we exist to remove.
 *
 * The change that matters most is not cosmetic. **Clyffy's acts appear in the conversation
 * as plain sentences.** Every act already lands on the runtime tape with its provenance;
 * until now the operator could not see any of it, so an assistant that opened files and
 * ran commands did so invisibly. Here the transcript interleaves what he SAID with what he
 * DID — "Opened /index.html", "Typed 27 characters in the terminal" — drawn from the
 * declared catalog, which is why an event without a sentence shows nothing rather than
 * leaking a raw name at someone.
 */
@injectable()
export class OgunChatWidget extends BaseWidget {

    static readonly ID = 'ogun.chat';
    static readonly LABEL = nls.localize('ogun/chat/label', 'Clyffy');

    @inject(ChatService)
    protected readonly chatService: ChatService;

    @inject(OgunRuntimeBus)
    protected readonly bus: OgunRuntimeBus;

    @inject(CommandRegistry)
    protected readonly commands: CommandRegistry;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    protected transcript: HTMLElement;
    protected portrait: HTMLElement;
    protected presence: HTMLElement;
    protected input: HTMLTextAreaElement;
    protected sendButton: HTMLButtonElement;
    protected sessionId?: string;
    protected busy = false;
    /** Chains already reported, so one intent produces one receipt. */
    protected readonly reportedChains = new Set<string>();

    @postConstruct()
    protected init(): void {
        this.id = OgunChatWidget.ID;
        this.title.label = OgunChatWidget.LABEL;
        this.title.caption = OgunChatWidget.LABEL;
        this.title.iconClass = 'codicon codicon-flame';
        this.title.closable = true;
        this.addClass('ogun-chat');
        this.node.tabIndex = 0;

        this.build();

        // Acts land here the moment they happen, from anywhere in the workbench — the
        // walkthrough, a channel call, or Clyffy himself. One subscription, no per-feature
        // reporting, because everything already goes through the bus.
        this.toDispose.push(this.bus.onEvent(event => this.onRuntimeEvent(event)));
    }

    protected build(): void {
        const header = document.createElement('div');
        header.className = 'ogun-chat-header';
        this.portrait = document.createElement('div');
        this.portrait.className = 'ogun-chat-portrait';
        this.portrait.innerHTML = clyffyPortrait('idle', 'Clyffy');
        const plate = document.createElement('div');
        plate.className = 'ogun-chat-plate';
        const name = document.createElement('div');
        name.className = 'ogun-chat-name';
        name.textContent = 'Clyffy';
        this.presence = document.createElement('div');
        this.presence.className = 'ogun-chat-presence';
        this.presence.textContent = nls.localize('ogun/chat/presence/idle', 'here when you need me');
        plate.append(name, this.presence);
        header.append(this.portrait, plate);

        this.transcript = document.createElement('div');
        this.transcript.className = 'ogun-chat-transcript';
        this.transcript.setAttribute('role', 'log');
        this.transcript.setAttribute('aria-live', 'polite');

        const composer = document.createElement('div');
        composer.className = 'ogun-chat-composer';
        this.input = document.createElement('textarea');
        this.input.className = 'ogun-chat-input';
        this.input.rows = 3;
        // No @agent, no #context. If a person has to learn a syntax before they can ask
        // for help, the help has not started yet.
        this.input.placeholder = nls.localize('ogun/chat/placeholder', 'Tell Clyffy what you want to make…');
        this.input.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.send();
            }
        });
        this.sendButton = document.createElement('button');
        this.sendButton.className = 'ogun-chat-send';
        this.sendButton.type = 'button';
        this.sendButton.textContent = nls.localizeByDefault('Ask');
        this.sendButton.addEventListener('click', () => this.send());
        composer.append(this.input, this.sendButton);

        this.node.append(header, this.transcript, composer);
        this.greet();
    }

    /**
     * The empty state has one job: make the first message easy to write. A list of
     * capabilities is a menu the newcomer has to translate; an invitation is not.
     */
    protected greet(): void {
        const opener = this.say('clyffy', nls.localize(
            'ogun/chat/greeting',
            'Tell me what you want to make, in your own words — “a page about my band” is plenty to start with. '
            + 'I will do it in front of you, and everything I touch shows up here so you can see what happened.'
        ));
        opener.classList.add('is-greeting');
    }

    protected set mood(mood: ClyffyMood) {
        this.portrait.innerHTML = clyffyPortrait(mood, 'Clyffy');
    }

    protected say(who: 'operator' | 'clyffy', text: string): HTMLElement {
        const turn = document.createElement('div');
        turn.className = `ogun-turn ogun-turn-${who}`;
        const body = document.createElement('div');
        body.className = 'ogun-turn-body';
        body.textContent = text;
        turn.appendChild(body);
        this.transcript.appendChild(turn);
        this.scrollToEnd();
        return turn;
    }

    /**
     * An act, said out loud.
     *
     * Only acts are narrated. Sensing is not shown: an assistant that announced every time
     * it looked at something would bury the two lines that mattered, and reading is not
     * the thing an operator needs to be able to audit.
     */
    protected onRuntimeEvent(event: RuntimeEvent): void {
        if (event.plane !== 'act') {
            return;
        }
        // One action fans out into several acts as the stack unwinds — invoking a menu
        // item raises the invoke, the command execution, and the file open, all on one
        // provenance chain. To the operator that was ONE thing they asked for, so it gets
        // one line. The first to arrive is the deepest and most concrete ("Opened
        // /Untitled-1" rather than "Used New Text File"), which is also the most useful.
        const chain = event.provenance?.chain;
        if (chain) {
            if (this.reportedChains.has(chain)) {
                return;
            }
            this.reportedChains.add(chain);
        }
        const sentence = OgunEvents.humanize({ name: event.name, data: this.readable(event.data) });
        if (!sentence) {
            return;
        }
        const line = document.createElement('div');
        line.className = 'ogun-act';
        const dot = document.createElement('span');
        dot.className = 'ogun-act-dot';
        const text = document.createElement('span');
        text.className = 'ogun-act-text';
        text.textContent = sentence;
        // Who did it, in the operator's terms — "you" and "Clyffy", not actor addresses.
        const by = document.createElement('span');
        by.className = 'ogun-act-by';
        by.textContent = event.provenance?.actor.kind === 'operator'
            ? nls.localize('ogun/chat/by/you', 'you')
            : nls.localize('ogun/chat/by/clyffy', 'Clyffy');
        line.append(dot, text, by);
        this.transcript.appendChild(line);
        this.scrollToEnd();
        if (this.busy) {
            this.mood = 'acting';
        }
    }

    /**
     * Swap addresses for the words on the screen.
     *
     * "Used menu:menubar/1_file/1_new_text/workbench.action.files.newUntitledFile" is a
     * true sentence that helps nobody. The operator saw a menu item called "New Text
     * File", so that is what the receipt has to say, or the record is only auditable by
     * the person who wrote the code.
     */
    protected readable(data: Record<string, unknown> | undefined): Record<string, unknown> {
        const readable = { ...(data ?? {}) };
        for (const key of ['surface', 'command'] as const) {
            const value = readable[key];
            if (typeof value === 'string') {
                readable[key] = this.label(value);
            }
        }
        if (typeof readable.path === 'string') {
            readable.path = this.shorten(readable.path);
        }
        return readable;
    }

    /**
     * The operator knows their project by the names in the explorer, not by where the
     * server happens to keep it. Anything inside the workspace is said the way it is
     * shown; anything outside keeps its full path, because there the location IS the
     * information.
     */
    protected shorten(path: string): string {
        const root = this.workspaceService.tryGetRoots()[0]?.resource.path.toString();
        return root && path.startsWith(root) ? path.slice(root.length).replace(/^\//, '') : path;
    }

    /**
     * Surface addresses end in the id of the thing they drive — `menu:…/core.saveAll`,
     * `button:files/navigator.collapse.all` — so the last segment is usually a command the
     * registry can name. Where it cannot, the tail is still shorter and kinder than the
     * whole address.
     */
    protected label(address: string): string {
        const tail = address.slice(address.lastIndexOf('/') + 1).replace(/^[a-z]+:/, '');
        const command = this.commands.getCommand(tail);
        if (!command?.label) {
            return tail;
        }
        return command.category ? `${command.category}: ${command.label}` : command.label;
    }

    protected async send(): Promise<void> {
        const text = this.input.value.trim();
        if (!text || this.busy) {
            return;
        }
        this.input.value = '';
        this.say('operator', text);
        this.setBusy(true);

        try {
            if (!this.sessionId) {
                this.sessionId = this.chatService.createSession().id;
            }
            const invocation = await this.chatService.sendRequest(this.sessionId, { text });
            if (!invocation) {
                this.say('clyffy', nls.localize('ogun/chat/noAgent', 'I could not pick that up just now. Try asking again.'));
                return;
            }
            const response = await invocation.responseCreated;
            const turn = this.say('clyffy', '');
            const body = turn.querySelector('.ogun-turn-body') as HTMLElement;
            // Stream: the response model mutates in place and announces itself, so the
            // turn is rewritten rather than appended to.
            const render = () => {
                body.textContent = response.response.asDisplayString();
                this.scrollToEnd();
            };
            this.toDispose.push(response.onDidChange(render));
            render();
            await invocation.responseCompleted;
            render();
        } catch (error) {
            this.say('clyffy', nls.localize('ogun/chat/failed', 'That did not go through. The details are in the log.'));
            console.error('[ogun-chat] request failed', error);
        } finally {
            this.setBusy(false);
        }
    }

    protected setBusy(busy: boolean): void {
        this.busy = busy;
        this.sendButton.disabled = busy;
        this.mood = busy ? 'thinking' : 'idle';
        this.presence.textContent = busy
            ? nls.localize('ogun/chat/presence/working', 'working on it…')
            : nls.localize('ogun/chat/presence/idle', 'here when you need me');
    }

    protected scrollToEnd(): void {
        this.transcript.scrollTop = this.transcript.scrollHeight;
    }

    protected override onActivateRequest(message: Message): void {
        super.onActivateRequest(message);
        this.input.focus();
    }
}
