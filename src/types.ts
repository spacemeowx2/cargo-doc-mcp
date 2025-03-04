/**
 * Interface for cache entry representing a built documentation
 */
export interface DocCacheEntry {
    crateName: string;
    projectPath: string;
    docPath: string;
    lastBuildTime: number;
    isBuilt: boolean;
}

/**
 * Interface for cache storage
 */
export interface CacheStorage {
    [key: string]: DocCacheEntry;
}

/**
 * Options for document search
 */
export interface SearchOptions {
    limit?: number;
}

/**
 * Search result item
 */
export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    crateVersion?: string;
}

/**
 * Symbol type in Rust documentation
 */
export enum SymbolType {
    STRUCT = 'struct',
    ENUM = 'enum',
    TRAIT = 'trait',
    FUNCTION = 'fn',
    CONST = 'const',
    TYPE = 'type',
    MACRO = 'macro',
    MODULE = 'mod',
}

/**
 * Symbol information from documentation
 */
export interface SymbolInfo {
    name: string;
    type: SymbolType;
    path: string;
    url: string;
}

/**
 * Error codes for documentation operations
 */
export enum DocErrorCode {
    INVALID_PATH = 'INVALID_PATH',
    BUILD_FAILED = 'BUILD_FAILED',
    SEARCH_FAILED = 'SEARCH_FAILED',
    CACHE_ERROR = 'CACHE_ERROR',
    CARGO_ERROR = 'CARGO_ERROR',
}

/**
 * Custom error class for documentation operations
 */
export class DocError extends Error {
    constructor(
        public code: DocErrorCode,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'DocError';
    }
}