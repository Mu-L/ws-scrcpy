import 'xterm/css/xterm.css';
import { ManagerClient } from '../../client/ManagerClient';
import { Terminal } from 'xterm';
import { AttachAddon } from 'xterm-addon-attach';
import { FitAddon } from 'xterm-addon-fit';
import { MessageXtermClient } from '../../../types/MessageXtermClient';
import { ACTION } from '../../../common/Action';
import { ParamsShell } from '../../../types/ParamsShell';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { BaseDeviceTracker } from '../../client/BaseDeviceTracker';
import Util from '../../Util';
import { ParamsDeviceTracker } from '../../../types/ParamsDeviceTracker';
import { ParsedUrlQuery } from 'querystring';

const TAG = '[ShellClient]';

export class ShellClient extends ManagerClient<ParamsShell, never> {
    public static ACTION = ACTION.SHELL;
    public static start(params: ParsedUrlQuery): ShellClient {
        return new ShellClient(params);
    }

    private readonly term: Terminal;
    private readonly fitAddon: FitAddon;
    private readonly escapedUdid: string;
    private readonly udid: string;

    constructor(params: ParsedUrlQuery) {
        super(params);
        this.udid = Util.parseStringEnv(params.udid);
        this.openNewWebSocket();
        const ws = this.ws as WebSocket;
        this.setTitle(`Shell ${this.udid}`);
        this.setBodyClass('shell');
        this.term = new Terminal();
        this.term.loadAddon(new AttachAddon(ws));
        this.fitAddon = new FitAddon();
        this.term.loadAddon(this.fitAddon);
        this.escapedUdid = Util.escapeUdid(this.udid);
        this.term.open(ShellClient.getOrCreateContainer(this.escapedUdid));
        this.updateTerminalSize();
    }

    public parseParameters(params: ParsedUrlQuery): ParamsShell {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== ACTION.SHELL) {
            throw Error('Incorrect action');
        }
        return { ...typedParams, action, udid: Util.parseStringEnv(params.udid) };
    }

    protected onSocketOpen = (): void => {
        this.startShell(this.udid);
    };

    protected onSocketClose(e: CloseEvent): void {
        console.log(TAG, `Connection closed: ${e.reason}`);
        this.term.dispose();
    }

    protected onSocketMessage(): void {
        // messages are processed by Attach Addon
    }

    public startShell(udid: string): void {
        if (!udid || !this.ws || this.ws.readyState !== this.ws.OPEN) {
            return;
        }
        const { rows, cols } = this.fitAddon.proposeDimensions();
        const message: MessageXtermClient = {
            id: 1,
            type: 'shell',
            data: {
                type: 'start',
                rows,
                cols,
                udid,
            },
        };
        this.ws.send(JSON.stringify(message));
    }

    private static getOrCreateContainer(udid: string): HTMLElement {
        let container = document.getElementById(udid);
        if (!container) {
            container = document.createElement('div');
            container.className = 'terminal-container';
            container.id = udid;
            document.body.appendChild(container);
        }
        return container;
    }

    private updateTerminalSize(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term: any = this.term;
        const terminalContainer: HTMLElement = ShellClient.getOrCreateContainer(this.escapedUdid);
        const { rows, cols } = this.fitAddon.proposeDimensions();
        const width =
            (cols * term._core._renderService.dimensions.actualCellWidth + term._core.viewport.scrollBarWidth).toFixed(
                2,
            ) + 'px';
        const height = (rows * term._core._renderService.dimensions.actualCellHeight).toFixed(2) + 'px';
        terminalContainer.style.width = width;
        terminalContainer.style.height = height;
        this.fitAddon.fit();
    }

    public static createEntryForDeviceList(
        descriptor: GoogDeviceDescriptor,
        blockClass: string,
        params: ParamsDeviceTracker,
    ): HTMLElement | DocumentFragment | undefined {
        if (descriptor.state !== 'device') {
            return;
        }
        const entry = document.createElement('div');
        entry.classList.add('shell', blockClass);
        entry.appendChild(
            BaseDeviceTracker.buildLink(
                {
                    action: ACTION.SHELL,
                    udid: descriptor.udid,
                },
                'shell',
                params,
            ),
        );
        return entry;
    }
}
