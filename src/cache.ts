import { CacheStorage, DocCacheEntry, DocError, DocErrorCode } from './types.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Cache system for managing documentation build status and paths
 */
export class DocCache {
    private cachePath: string;
    private cache: CacheStorage = {};
    private static CACHE_FILE = 'docs-rs-mcp-cache.json';
    private static CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    constructor() {
        this.cachePath = path.join(os.tmpdir(), DocCache.CACHE_FILE);
    }

    /**
     * Initialize the cache from disk
     */
    public async initialize(): Promise<void> {
        try {
            const data = await fs.readFile(this.cachePath, 'utf-8');
            this.cache = JSON.parse(data);
            await this.cleanup();
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw new DocError(
                    DocErrorCode.CACHE_ERROR,
                    'Failed to initialize cache',
                    error
                );
            }
            // If file doesn't exist, start with empty cache
            this.cache = {};
        }
    }

    /**
     * Save the cache to disk
     */
    private async save(): Promise<void> {
        try {
            await fs.writeFile(this.cachePath, JSON.stringify(this.cache, null, 2));
        } catch (error) {
            throw new DocError(
                DocErrorCode.CACHE_ERROR,
                'Failed to save cache',
                error
            );
        }
    }

    /**
     * Get cache key for a project and crate
     */
    private getCacheKey(projectPath: string, crateName: string): string {
        return `${projectPath}:${crateName}`;
    }

    /**
     * Get cache entry for a project and crate
     */
    public async get(projectPath: string, crateName: string): Promise<DocCacheEntry | null> {
        const key = this.getCacheKey(projectPath, crateName);
        const entry = this.cache[key];

        if (!entry) {
            return null;
        }

        // Check if entry is expired
        if (Date.now() - entry.lastBuildTime > DocCache.CACHE_TTL) {
            delete this.cache[key];
            await this.save();
            return null;
        }

        return entry;
    }

    /**
     * Set cache entry for a project and crate
     */
    public async set(entry: DocCacheEntry): Promise<void> {
        const key = this.getCacheKey(entry.projectPath, entry.crateName);
        this.cache[key] = {
            ...entry,
            lastBuildTime: Date.now()
        };
        await this.save();
    }

    /**
     * Remove cache entry for a project and crate
     */
    public async remove(projectPath: string, crateName: string): Promise<void> {
        const key = this.getCacheKey(projectPath, crateName);
        delete this.cache[key];
        await this.save();
    }

    /**
     * Clean up expired cache entries
     */
    private async cleanup(): Promise<void> {
        const now = Date.now();
        let changed = false;

        for (const [key, entry] of Object.entries(this.cache)) {
            if (now - entry.lastBuildTime > DocCache.CACHE_TTL) {
                delete this.cache[key];
                changed = true;
            }
        }

        if (changed) {
            await this.save();
        }
    }
}