import {ExecuteLogger} from 'ram-api.js';
const execute = new ExecuteLogger('Yuna Miu');

function detail(error: unknown): string {
    if(!(error instanceof Error)) return '';
    const code = 'code' in error && error.code != null ? ` (${String(error.code)})` : '';
    return `: ${error.message}${code}`;
}

export const logger = {
    info(message: string): void {
        void execute.infoAsync(message);
    },
    warn(message: string): void {
        void execute.warnAsync(message);
    },
    error(message: string, error?: unknown): void {
        void execute.errorAsync(`${message}${detail(error)}`);
    },
    fatal(message: string, error?: unknown): void {
        void execute.fatalAsync(`${message}${detail(error)}`);
    }
}