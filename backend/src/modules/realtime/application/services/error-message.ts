/** Readable text of a caught value (for logs). */
export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
