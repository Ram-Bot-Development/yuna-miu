export interface Log {
    info(message: string): void;
    warn(message: string): void;
    error(message: string, error?: unknown): void;
}

export const silentLog: Log = {
    info() {},
    warn() {},
    error() {},
};
