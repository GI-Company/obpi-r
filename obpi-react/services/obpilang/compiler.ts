
import { VFS } from '../VFS';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Program, Statement, ImportStatement } from './ast';
import pako from 'pako';

const textEncoder = new TextEncoder();
const OEXEC_MAGIC = 'OEXEC';

// FIX: Change vfs type to a generic object to satisfy type checks for this legacy module.
type VFS_LIKE = {
    readFile: (path: string) => string | Uint8Array | null;
    writeFile: (path: string, data: Uint8Array) => boolean;
}
export class Compiler {
    private vfs: VFS_LIKE;
    private processedFiles: Set<string> = new Set();

    constructor(vfs: VFS_LIKE) {
        this.vfs = vfs;
    }

    private parseFile(filePath: string): Program {
        // FIX: this.vfs.readFile is valid with the new type
        const source = this.vfs.readFile(filePath);
        if (typeof source !== 'string') {
            throw new Error(`Compiler Error: Could not read source file at ${filePath}`);
        }
        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        return parser.parse();
    }
    
    private resolveImports(program: Program, basePath: string): Statement[] {
        const body: Statement[] = [];
        const baseDir = basePath.substring(0, basePath.lastIndexOf('/'));

        for (const statement of program.body) {
            if (statement.type === 'ImportStatement') {
                // FIX: Use static VFS.resolvePath
                const importPath = VFS.resolvePath(statement.path.value, baseDir);
                
                if (this.processedFiles.has(importPath)) {
                    continue; // Avoid circular or duplicate imports
                }
                this.processedFiles.add(importPath);

                const importedProgram = this.parseFile(importPath);
                const resolvedSubProgram = this.resolveImports(importedProgram, importPath);
                body.push(...resolvedSubProgram);
            } else {
                body.push(statement);
            }
        }
        
        return body;
    }

    public compile(entryPoint: string, outputPath: string): { success: boolean, message: string } {
        this.processedFiles.clear();
        
        try {
            // 1. Parse the entry point file
            this.processedFiles.add(entryPoint);
            const mainProgram = this.parseFile(entryPoint);

            // 2. Recursively resolve imports and gather all statements
            const allStatements = this.resolveImports(mainProgram, entryPoint);
            
            // 3. Add the statements from the main file itself (excluding its imports)
            const mainStatements = mainProgram.body.filter(stmt => stmt.type !== 'ImportStatement');
            allStatements.push(...mainStatements);

            // 4. Create the final linked program AST
            const finalProgram: Program = {
                type: 'Program',
                body: allStatements
            };

            // 5. Serialize and compress the final AST
            const astJson = JSON.stringify(finalProgram);
            const compressedAst = pako.gzip(textEncoder.encode(astJson));

            // 6. Create the executable binary
            const magicBytes = textEncoder.encode(OEXEC_MAGIC);
            const executable = new Uint8Array(magicBytes.length + compressedAst.length);
            executable.set(magicBytes);
            executable.set(compressedAst, magicBytes.length);

            // 7. Write to VFS
            // FIX: this.vfs.writeFile is valid with the new type
            if (this.vfs.writeFile(outputPath, executable)) {
                 return { success: true, message: `Compilation successful! Executable created at ${outputPath}`};
            } else {
                 return { success: false, message: `Compilation failed. Could not write to ${outputPath}.`};
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown compilation error occurred.';
            return { success: false, message };
        }
    }
}
