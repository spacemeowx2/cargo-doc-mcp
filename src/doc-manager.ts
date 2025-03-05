import { execa } from 'execa';
import { DocCache } from './cache.js';
import { DocError, DocErrorCode, SearchOptions, SearchResult, SymbolInfo, SymbolType } from './types.js';
import fs from 'fs/promises';
import path from 'path';
import { RustdocUrl } from './url-utils.js';

/**
 * Manages Rust documentation operations
 */
export class DocManager {
    private cache: DocCache;

    constructor() {
        this.cache = new DocCache();
    }

    /**
     * Initialize the document manager
     */
    public async initialize(): Promise<void> {
        await this.cache.initialize();
    }

    /**
     * Get documentation path for a crate
     */
    public async getDocPath(projectPath: string, crateName: string): Promise<{ docPath: string; isBuilt: boolean } | null> {
        const cached = await this.cache.get(projectPath, crateName);
        if (!cached) {
            return null;
        }
        return {
            docPath: cached.docPath,
            isBuilt: cached.isBuilt
        };
    }

    /**
     * Verify if a project path is valid
     */
    private async verifyProjectPath(projectPath: string): Promise<void> {
        try {
            const cargoToml = path.join(projectPath, 'Cargo.toml');
            await fs.access(cargoToml);
        } catch (error) {
            throw new DocError(
                DocErrorCode.INVALID_PATH,
                `Invalid project path: ${projectPath}. Cargo.toml not found.`
            );
        }
    }

    /**
     * Get the target directory for a project
     */
    private async getTargetDir(projectPath: string): Promise<string> {
        try {
            const { stdout } = await execa('cargo', ['metadata', '--format-version=1', '--no-deps'], {
                cwd: projectPath
            });
            const metadata = JSON.parse(stdout);
            return metadata.target_directory;
        } catch (error) {
            throw new DocError(
                DocErrorCode.CARGO_ERROR,
                'Failed to get target directory',
                error
            );
        }
    }

    /**
     * Check if documentation is built for a crate
     */
    public async checkDoc(projectPath: string, crateName: string): Promise<boolean> {
        await this.verifyProjectPath(projectPath);

        const cached = await this.cache.get(projectPath, crateName);
        if (cached) {
            return cached.isBuilt;
        }

        try {
            const targetDir = await this.getTargetDir(projectPath);
            const docPath = path.join(targetDir, 'doc', crateName, 'index.html');

            try {
                await fs.access(docPath);
                await this.cache.set({
                    crateName,
                    projectPath,
                    docPath,
                    lastBuildTime: Date.now(),
                    isBuilt: true
                });
                return true;
            } catch {
                await this.cache.set({
                    crateName,
                    projectPath,
                    docPath,
                    lastBuildTime: Date.now(),
                    isBuilt: false
                });
                return false;
            }
        } catch (error) {
            throw new DocError(
                DocErrorCode.CARGO_ERROR,
                'Failed to check documentation status',
                error
            );
        }
    }

    /**
     * Build documentation for a crate
     */
    public async buildDoc(projectPath: string, crateName: string, noDeps: boolean = false): Promise<string> {
        await this.verifyProjectPath(projectPath);

        try {
            const args = ['doc', '--no-deps'];
            if (noDeps) {
                args.push('--no-deps');
            }
            args.push('-p', crateName);

            const result = await execa('cargo', args, {
                cwd: projectPath
            });

            if (result.exitCode === 0) {
                const targetDir = await this.getTargetDir(projectPath);
                const docPath = path.join(targetDir, 'doc', crateName, 'index.html');

                await this.cache.set({
                    crateName,
                    projectPath,
                    docPath,
                    lastBuildTime: Date.now(),
                    isBuilt: true
                });

                return docPath;
            } else {
                throw new Error(result.stderr);
            }
        } catch (error) {
            throw new DocError(
                DocErrorCode.BUILD_FAILED,
                'Failed to build documentation',
                error
            );
        }
    }

    /**
     * Search within a crate's documentation
     */
    public async searchDoc(
        projectPath: string,
        crateName: string,
        query: string,
        options: SearchOptions = {}
    ): Promise<SearchResult[]> {
        const isBuilt = await this.checkDoc(projectPath, crateName);
        if (!isBuilt) {
            throw new DocError(
                DocErrorCode.SEARCH_FAILED,
                'Documentation not built. Please build the documentation first.'
            );
        }

        const cached = await this.cache.get(projectPath, crateName);
        if (!cached) {
            throw new DocError(
                DocErrorCode.CACHE_ERROR,
                'Cache error: Documentation entry not found'
            );
        }

        const { docPath } = cached;
        const docDir = path.dirname(docPath);

        const files = await fs.readdir(docDir);
        const results: SearchResult[] = [];

        for (const file of files) {
            if (file.endsWith('.html')) {
                const content = await fs.readFile(path.join(docDir, file), 'utf-8');
                if (content.includes(query)) {
                    const result: SearchResult = {
                        title: path.basename(file, '.html'),
                        url: RustdocUrl.create(path.join(docDir, file)),
                        snippet: '...' // Simple fallback without proper context
                    };
                    results.push(result);

                    if (options.limit && results.length >= options.limit) {
                        break;
                    }
                }
            }
        }

        return results;
    }

    /**
     * List all symbols in a crate's documentation
     */
    /**
     * Parse symbol information from a documentation file name
     */
    private parseSymbolFromFile(fileName: string, modulePath: string, crateName: string, docDir: string): SymbolInfo | null {
        const match = fileName.match(/^(struct|enum|trait|fn|const|type|macro|mod)\.(.+)\.html$/);
        if (!match) {
            return null;
        }

        const [, type, name] = match;
        const symbolName = name.replace(/-/g, '::');
        const fullPath = modulePath
            ? `${crateName}::${modulePath}::${symbolName}`
            : `${crateName}::${symbolName}`;

        return {
            name: symbolName,
            type: type as SymbolType,
            path: fullPath,
            url: RustdocUrl.create(path.join(docDir, fileName))
        };
    }

    /**
     * Recursively traverse directory to find all symbols
     */
    private async traverseDirectory(
        docDir: string,
        crateName: string,
        modulePath: string = '',
        symbols: SymbolInfo[] = []
    ): Promise<SymbolInfo[]> {
        const entries = await fs.readdir(docDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                // 跳过特殊目录
                if (entry.name === 'src' || entry.name === 'implementors') {
                    continue;
                }

                // 递归遍历子目录
                await this.traverseDirectory(
                    path.join(docDir, entry.name),
                    crateName,
                    modulePath ? `${modulePath}::${entry.name}` : entry.name,
                    symbols
                );
            } else if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
                const symbol = this.parseSymbolFromFile(entry.name, modulePath, crateName, docDir);
                if (symbol) {
                    symbols.push(symbol);
                }
            }
        }

        return symbols;
    }

    /**
     * List all symbols in a crate's documentation
     */
    public async listSymbols(projectPath: string, crateName: string): Promise<SymbolInfo[]> {
        const isBuilt = await this.checkDoc(projectPath, crateName);
        if (!isBuilt) {
            throw new DocError(
                DocErrorCode.SEARCH_FAILED,
                'Documentation not built. Please build the documentation first.'
            );
        }

        const cached = await this.cache.get(projectPath, crateName);
        if (!cached) {
            throw new DocError(
                DocErrorCode.CACHE_ERROR,
                'Cache error: Documentation entry not found'
            );
        }

        try {
            const { docPath } = cached;
            const docDir = path.dirname(docPath);

            // 使用递归遍历来收集所有符号
            const symbols = await this.traverseDirectory(docDir, crateName);

            return symbols.sort((a, b) => a.path.localeCompare(b.path));
        } catch (error) {
            throw new DocError(
                DocErrorCode.SEARCH_FAILED,
                'Failed to list symbols',
                error
            );
        }
    }
}
