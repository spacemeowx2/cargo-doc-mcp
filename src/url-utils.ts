import TurndownService from 'turndown';
import fs from 'fs/promises';

/**
 * Singleton Turndown service for markdown conversion
 */
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
});

/**
 * Utilities for handling rustdoc URLs and content
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

    /**
     * Read and convert doc content to markdown
     */
    static async readContent(filePath: string): Promise<string> {
        const content = await fs.readFile(filePath, 'utf-8');
        return turndownService.turndown(content);
    }
}