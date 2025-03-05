/**
 * Utilities for handling rustdoc URLs
 */
export class RustdocUrl {
    /**
     * Create a rustdoc URL from components
     */
    static create(docPath: string): string {
        return `rustdoc://${docPath}`;
    }

    /**
     * Parse a rustdoc URL into a file path
     */
    static parse(url: string): string {
        if (!url.startsWith('rustdoc://')) {
            throw new Error(`Invalid rustdoc URI format: ${url}. Expected format: rustdoc://path/to/doc`);
        }
        return url.replace('rustdoc://', '');
    }
}