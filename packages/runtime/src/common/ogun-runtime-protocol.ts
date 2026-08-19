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

import { RuntimeEvent } from './ogun-runtime-events';

export const OGUN_RUNTIME_SERVICE_PATH = '/services/ogun-runtime';

export const OgunRuntimeSink = Symbol('OgunRuntimeSink');

/**
 * Backend half of the runtime: the tape. Frontend planes hand it declared events; it
 * writes them as CloudEvents rows under the instance's platform-scoped source.
 */
export interface OgunRuntimeSink {
    record(event: RuntimeEvent): Promise<void>;
    /** Last N rows, newest last. */
    tail(limit: number): Promise<object[]>;
}
