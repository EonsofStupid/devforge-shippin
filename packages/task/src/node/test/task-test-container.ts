// *****************************************************************************
// Copyright (C) 2017 Ericsson and others.
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
import { Container } from '@ogun/core/shared/inversify';
import { bindLogger } from '@ogun/core/lib/node/logger-backend-module';
import { backendApplicationModule } from '@ogun/core/lib/node/backend-application-module';
import processBackendModule from '@ogun/process/lib/node/process-backend-module';
import terminalBackendModule from '@ogun/terminal/lib/node/terminal-backend-module';
import taskBackendModule from '../task-backend-module';
import filesystemBackendModule from '@ogun/filesystem/lib/node/filesystem-backend-module';
import workspaceServer from '@ogun/workspace/lib/node/workspace-backend-module';
import { messagingBackendModule } from '@ogun/core/lib/node/messaging/messaging-backend-module';
import { HttpConnectionValidator } from '@ogun/core/lib/node';
import { ApplicationPackage } from '@ogun/core/shared/@ogun/application-package';
import { TerminalProcess } from '@ogun/process/lib/node';
import { ProcessUtils } from '@ogun/core/lib/node/process-utils';

export function createTaskTestContainer(): Container {
    const testContainer = new Container();

    testContainer.load(backendApplicationModule);
    testContainer.rebind(ApplicationPackage).toConstantValue({} as ApplicationPackage);

    bindLogger(testContainer.bind.bind(testContainer));
    testContainer.load(messagingBackendModule);
    testContainer.load(processBackendModule);
    testContainer.load(taskBackendModule);
    testContainer.load(filesystemBackendModule);
    testContainer.load(workspaceServer);
    testContainer.load(terminalBackendModule);

    // The filesystem backend contributions require an `HttpConnectionValidator` (bound by the browser/electron
    // hosting modules, which are not loaded here). Bind a no-op so those contributions can be constructed.
    const noopConnectionValidator: HttpConnectionValidator = {
        validateRequest: (_req, _res, next) => next()
    };
    testContainer.bind(HttpConnectionValidator).toConstantValue(noopConnectionValidator);

    // Make it easier to debug processes.
    testContainer.rebind(TerminalProcess).to(TestTerminalProcess);

    testContainer.rebind(ProcessUtils).toConstantValue(new class extends ProcessUtils {
        override terminateProcessTree(): void { } // don't actually kill the tree, it breaks the tests.
    });

    return testContainer;
}

class TestTerminalProcess extends TerminalProcess {

    protected override emitOnStarted(): void {
        if (process.env['THEIA_TASK_TEST_DEBUG']) {
            console.log(`START ${this.id} ${JSON.stringify([this.executable, this.options.commandLine, ...this.arguments])}`);
            this.outputStream.on('data', data => console.debug(`${this.id} OUTPUT: ${data.toString().trim()}`));
        }
        super.emitOnStarted();
    }

}
