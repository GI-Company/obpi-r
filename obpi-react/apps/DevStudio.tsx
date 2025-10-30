

import React, { useState, useEffect, useCallback, useRef, FC } from 'react';
import { useOS } from '../contexts/OSContext';
import { FSNode, ChatMessage } from '../types';
import { runDevStudioAgentStream, debugCode } from '../services/geminiService';
import { logger } from '../services/loggingService';
import Terminal from './Terminal';

declare global {
    interface Window {
        prettier: any;
        prettierPlugins: any;
    }
}

// --- CONSTANTS ---
const LOCAL_STORAGE_KEY_LAST_PROJECT = 'obpi_react_devstudio_last_project_v1';

// --- TYPES ---
interface DevStudioProps {
    filePath?: string;
}

interface Tab {
    path: string;
    content: string;
    savedContent: string;
}

// --- UTILITY FUNCTIONS ---
const syntaxHighlight = (code: string, ext?: string): string => {
    let highlighted = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    highlighted = highlighted.replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g, '<span class="text-gray-500">$1</span>');
    highlighted = highlighted.replace(/\b(\d+)\b/g, '<span class="text-blue-400">$1</span>');
    switch (ext) {
        case 'js': case 'ts': return highlighted.replace(/\b(const|let|var|function|return|if|else|for|while|import|from|async|await|new|class|extends|super|this|document|window|console|true|false|defineEventHandler|event)\b/g, '<span class="text-pink-400">$1</span>');
        case 'py': return highlighted.replace(/\b(def|return|if|else|elif|for|while|import|from|as|class|True|False|None|print|in|is|and|or|not)\b/g, '<span class="text-yellow-400">$1</span>');
        case 'olic': return highlighted.replace(/\b(let|func|if|else|while|return|import|true|false|null)\b/g, '<span class="text-sky-400">$1</span>');
        case 'c': case 'cpp': return highlighted.replace(/\b(int|char|void|if|else|while|for|return|#include|printf|main|struct|typedef)\b/g, '<span class="text-indigo-400">$1</span>');
        case 'rs': return highlighted.replace(/\b(fn|let|mut|if|else|while|for|return|mod|use|struct|enum|impl|pub|crate|self|true|false)\b/g, '<span class="text-orange-400">$1</span>');
        case 'html': return highlighted.replace(/(&lt;[a-zA-Z0-9]+|&gt;|\/&gt;|&lt;\/[a-zA-Z0-9]+&gt;)/g, '<span class="text-red-400">$1</span>');
        default: return highlighted;
    }
};

const renderMarkdown = (text: string): string => {
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/```(\w*)\n([\s\S]+?)\n```/g, (_match, lang, code) => {
        const safeCode = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/>/g, '>');
        const highlightedCode = syntaxHighlight(safeCode, lang);
        return `<pre class="bg-black/80 rounded-md p-2 my-2 text-white font-mono text-xs overflow-x-auto"><code>${highlightedCode}</code></pre>`;
    });
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code class="bg-gray-200 dark:bg-gray-700/80 px-1 rounded text-xs">$1</code>');
    const parts = html.split(/(<pre[\s\S]*?<\/pre>)/g);
    for (let i = 0; i < parts.length; i++) { if (i % 2 === 0) { parts[i] = parts[i].replace(/\n/g, '<br />'); } }
    return parts.join('');
};


// --- MAIN DEV STUDIO COMPONENT ---

const DevStudio: React.FC<DevStudioProps> = ({ filePath: initialFilePath }) => {
    // FIX: Destructure listDirectory to check for project existence
    const { listDirectory } = useOS();
    const [projectPath, setProjectPath] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // FIX: Asynchronously check if the last project directory exists
        const checkLastProject = async () => {
            const lastProject = localStorage.getItem(LOCAL_STORAGE_KEY_LAST_PROJECT);
            if (lastProject) {
                const node = await listDirectory(lastProject);
                if (node) { // If listDirectory doesn't fail/return null, it's a directory
                    setProjectPath(lastProject);
                }
            }
            setIsLoading(false);
        };
        checkLastProject();
    }, [listDirectory]);
    
    useEffect(() => {
        if (projectPath) {
            localStorage.setItem(LOCAL_STORAGE_KEY_LAST_PROJECT, projectPath);
        } else {
            localStorage.removeItem(LOCAL_STORAGE_KEY_LAST_PROJECT);
        }
    }, [projectPath]);
    
    const handleProjectOpened = (path: string) => {
        setProjectPath(path);
    };

    const handleProjectClosed = () => {
        setProjectPath(null);
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-full bg-[#1E1E1E] text-gray-400">Loading Dev Studio...</div>;
    }

    if (!projectPath) {
        return <WelcomeScreen onProjectOpened={handleProjectOpened} />;
    }

    return (
        <ProjectIDE
            key={projectPath} // Force re-mount on project change
            projectPath={projectPath}
            onCloseProject={handleProjectClosed}
            initialFilePath={initialFilePath}
        />
    );
};


// --- WELCOME SCREEN & PROJECT MANAGEMENT ---

const WelcomeScreen: FC<{ onProjectOpened: (path: string) => void }> = ({ onProjectOpened }) => {
    // FIX: Use async listDirectory
    const { showModal, listDirectory, currentUser, fsRevision, showNotification } = useOS();
    const [projects, setProjects] = useState<string[]>([]);
    
    const projectsDir = `/home/${currentUser?.username || 'guest'}/projects`;

    useEffect(() => {
        // FIX: Fetch projects asynchronously
        const fetchProjects = async () => {
            const projectNodes = await listDirectory(projectsDir);
            if (projectNodes) {
                setProjects(Object.keys(projectNodes).filter(key => projectNodes[key].type === 'dir'));
            }
        };
        fetchProjects();
    }, [listDirectory, projectsDir, fsRevision]);

    const handleCreateProject = () => {
        showModal(
            "Create New Project",
            <ProjectCreator onProjectCreated={onProjectOpened} />,
            [] // Actions are handled within the component
        );
    };

    return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1E1E1E] text-gray-300 p-8">
            <h1 className="text-4xl font-bold mb-2">🧑‍💻 Dev Studio</h1>
            <p className="text-gray-400 mb-8">Your integrated development environment.</p>

            <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#252526] p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Start</h2>
                    <div className="space-y-3">
                        <button onClick={handleCreateProject} className="w-full text-left p-3 bg-gray-700/50 hover:bg-gray-600/50 rounded-md">➕ Create New Project...</button>
                        <button disabled className="w-full text-left p-3 bg-gray-700/50 hover:bg-gray-600/50 rounded-md opacity-50 cursor-not-allowed">📂 Open a Folder...</button>
                    </div>
                </div>

                <div className="bg-[#252526] p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Recent Projects</h2>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {projects.length > 0 ? (
                            projects.map(p => <button key={p} onClick={() => onProjectOpened(`${projectsDir}/${p}`)} className="w-full text-left p-2 text-sm text-sky-400 hover:bg-gray-700/50 rounded">{p}</button>)
                        ) : (
                            <p className="text-sm text-gray-500">No recent projects found.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProjectCreator: FC<{ onProjectCreated: (path: string) => void }> = ({ onProjectCreated }) => {
    // FIX: Use async methods from context
    const { listDirectory, createDirectory, currentUser, hideModal, showNotification, fsRevision, createFile, writeFile } = useOS();
    const [projectName, setProjectName] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('nitro');
    const projectsDir = `/home/${currentUser?.username || 'guest'}/projects`;
    
    const templates = [
        { id: 'nitro', name: 'NitroJS Web Server', description: 'A basic Nitro server with a sample API route.', files: { 'package.json': JSON.stringify({ name: "nitro-app", private: true, scripts: { dev: "nitro dev" }, devDependencies: { "nitropack": "latest" } }, null, 2), 'api/hello.ts': `export default defineEventHandler((event) => {\n  return 'Hello from your simulated Nitro server!'\n})` } },
        { id: 'olang', name: 'OLang Console App', description: 'A simple "Hello World" in OLang.', files: { 'main.olic': 'func main() {\n    print("Hello, OLang!");\n}', 'README.md': '# OLang Project' } },
        { id: 'python', name: 'Python Script', description: 'A basic Python script.', files: { 'main.py': 'print("Hello, Python!")' } },
        { id: 'web', name: 'Static Web Page', description: 'A basic HTML, CSS, and JS setup.', files: { 'index.html': '<!DOCTYPE html>\n<html>\n<head>\n  <title>My App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <script src="script.js"></script>\n</body>\n</html>', 'style.css': 'body { font-family: sans-serif; }', 'script.js': 'console.log("Hello from script!");' } },
        { id: 'c', name: 'C Program', description: 'A simple "Hello World" in C.', files: { 'main.c': '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}' } },
        { id: 'rust', name: 'Rust Program', description: 'A simple "Hello World" in Rust.', files: { 'main.rs': 'fn main() {\n    println!("Hello, world!");\n}' } },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = projectName.trim();
        if (!name) {
            showNotification({ icon: '❌', title: 'Error', message: 'Project name cannot be empty.'});
            return;
        }
        
        const newProjectPath = `${projectsDir}/${name}`;
        // FIX: Check for existing project asynchronously
        const existingProjects = await listDirectory(projectsDir);
        if (existingProjects && existingProjects[name]) {
            showNotification({ icon: '❌', title: 'Error', message: 'A project with that name already exists.'});
            return;
        }
        
        await createDirectory(newProjectPath); 

        const template = templates.find(t => t.id === selectedTemplate);
        if (template) {
            // FIX: Use separate createFile and writeFile calls
            for (const [fileName, content] of Object.entries(template.files)) {
                const fullPath = `${newProjectPath}/${fileName}`;
                const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
                if (dir !== newProjectPath) {
                    await createDirectory(dir);
                }
                if(await createFile(fullPath)) {
                    await writeFile(fullPath, content);
                }
            }
        }
        
        showNotification({ icon: '✅', title: 'Success', message: `Project "${name}" created.`});
        hideModal();
        onProjectCreated(newProjectPath);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name..."
                className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700 font-mono"
                autoFocus
            />
            <div className="space-y-2">
                {templates.map(t => (
                    <label key={t.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer">
                        <input type="radio" name="template" value={t.id} checked={selectedTemplate === t.id} onChange={() => setSelectedTemplate(t.id)} />
                        <div>
                            <p className="font-semibold">{t.name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{t.description}</p>
                        </div>
                    </label>
                ))}
            </div>
            <div className="flex justify-end gap-2">
                <button type="button" onClick={hideModal} className="px-4 py-2 rounded bg-gray-500 text-white">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-obpi-accent text-white">Create</button>
            </div>
        </form>
    );
};


// --- PROJECT IDE VIEW & SUB-COMPONENTS ---

interface ProjectIDEProps {
    projectPath: string;
    onCloseProject: () => void;
    initialFilePath?: string;
}

const ProjectIDE: FC<ProjectIDEProps> = ({ projectPath, onCloseProject, initialFilePath }) => {
    // FIX: Use async methods from context
    const { readFile, writeFile, commandInterpreter, showModal, showNotification } = useOS();
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
    const [output, setOutput] = useState<string>(`> Project loaded: ${projectPath}`);
    const [bottomTab, setBottomTab] = useState<'terminal' | 'output'>('terminal');
    const [rightPanelTab, setRightPanelTab] = useState<'ai' | 'preview'>('ai');
    const [debugState, setDebugState] = useState<{ error: string; file: Tab } | null>(null);
    const [isDebugging, setIsDebugging] = useState(false);

    const activeTab = tabs.find(t => t.path === activeTabPath);

    const openFileInTab = useCallback(async (path: string) => {
        if (tabs.find(t => t.path === path)) {
            setActiveTabPath(path);
            return;
        }
        // FIX: Use async readFile and handle binary/text content
        const content = await readFile(path);
        const contentString = content instanceof Uint8Array ? new TextDecoder().decode(content) : content;
        
        if (typeof contentString === 'string') {
            const newTab: Tab = { path, content: contentString, savedContent: contentString };
            setTabs(prev => [...prev, newTab]);
            setActiveTabPath(path);
        } else {
            setOutput(prev => prev + `\n> Error: Cannot open binary file ${path.split('/').pop()}`);
        }
    }, [tabs, readFile]);
    
    useEffect(() => {
        // FIX: Asynchronously find and open an initial file
        const openInitialFile = async () => {
            if (tabs.length > 0) return; // Only run once
            
            const filesToCheck = [
                initialFilePath,
                `${projectPath}/main.olic`,
                `${projectPath}/main.py`,
                `${projectPath}/index.html`,
                `${projectPath}/main.c`,
                `${projectPath}/main.rs`,
                `${projectPath}/api/hello.ts`,
            ].filter(Boolean) as string[];

            for (const file of filesToCheck) {
                try {
                    const content = await readFile(file);
                    if (content !== null) {
                        await openFileInTab(file);
                        return; // Stop after opening the first valid file
                    }
                } catch (e) { /* Ignore and try next file */ }
            }
        };
        openInitialFile();
    }, [initialFilePath, projectPath, readFile, openFileInTab, tabs.length]);

    const handleCodeChange = useCallback((newCode: string) => {
        if (!activeTabPath) return;
        setTabs(tabs.map(tab => tab.path === activeTabPath ? { ...tab, content: newCode } : tab));
    }, [activeTabPath, tabs]);

    const handleSave = async () => {
        if (!activeTab) return;
        if (await writeFile(activeTab.path, activeTab.content)) {
            setTabs(tabs.map(t => t.path === activeTabPath ? { ...t, savedContent: t.content } : t));
            setOutput(prev => prev + `\n> Saved ${activeTab.path}`);
        }
    };
    
    const closeTab = (path: string) => {
        const tabToClose = tabs.find(t => t.path === path);
        if (tabToClose && tabToClose.content !== tabToClose.savedContent) {
            if (!window.confirm("You have unsaved changes. Are you sure?")) return;
        }
        const newTabs = tabs.filter(t => t.path !== path);
        setTabs(newTabs);
        if (activeTabPath === path) {
            setActiveTabPath(newTabs[newTabs.length - 1]?.path || null);
        }
    };

    const handleRun = async () => {
        if (!activeTab) return;
        setBottomTab('output');
        setDebugState(null);
        setOutput(prev => prev + `\n\n[RUN] ${new Date().toLocaleTimeString()} > Executing ${activeTab.path}...\n`);

        try {
            const result = await commandInterpreter.execute(activeTab.path);
            const outputResult = result ? String(result).trim() : 'Execution finished with no output.';
            setOutput(prev => prev + outputResult + '\n');
        } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            const errorHtml = `<span class="text-red-400">${error.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
            setOutput(prev => prev + `\n${errorHtml}\n`);
            setDebugState({ error, file: activeTab });
        }
    };

    const handleDebugRequest = async () => {
        if (!debugState) return;
        setIsDebugging(true);
        try {
            const lang = debugState.file.path.split('.').pop() || 'text';
            const fixedCode = await debugCode(debugState.file.content, debugState.error, lang);

            const diffModalContent = (
                <div className="h-[60vh] overflow-y-auto font-mono text-xs">
                    <h3 className="text-lg font-bold mb-2">AI Debugger Suggestion</h3>
                    <p className="mb-4 text-sm">Gemini has analyzed the error and proposed a fix. Review the changes and apply them if you approve.</p>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-200 dark:bg-gray-700">
                                <th className="p-2 border border-gray-300 dark:border-gray-600 w-1/2">Original Code</th>
                                <th className="p-2 border border-gray-300 dark:border-gray-600 w-1/2">Suggested Fix</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-2 border border-gray-300 dark:border-gray-600 align-top"><pre className="whitespace-pre-wrap">{debugState.file.content}</pre></td>
                                <td className="p-2 border border-gray-300 dark:border-gray-600 align-top bg-green-900/20"><pre className="whitespace-pre-wrap">{fixedCode}</pre></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            );

            showModal("Debug with AI", diffModalContent, [
                { text: 'Cancel', type: 'secondary', onClick: () => {} },
                { text: 'Accept Fix', type: 'primary', onClick: () => {
                    handleCodeChange(fixedCode);
                    showNotification({ icon: '✅', title: 'Fix Applied', message: 'The AI-suggested fix has been applied to the editor.' });
                }}
            ]);

        } catch (e) {
            showNotification({ icon: '❌', title: 'Debug Failed', message: e instanceof Error ? e.message : "The AI could not generate a fix." });
        } finally {
            setIsDebugging(false);
            setDebugState(null);
        }
    };
    
    return (
        <div className="flex h-full font-mono bg-[#1E1E1E] text-gray-200">
            <ScopedFileTree rootPath={projectPath} onFileSelect={openFileInTab} />

            <div className="flex-grow flex flex-col min-h-0">
                <ActionToolbar
                    onSave={handleSave}
                    onRun={handleRun}
                    onToggleAIPanel={() => setRightPanelTab(p => p === 'ai' ? 'preview' : 'ai')}
                    onCloseProject={onCloseProject}
                    activeTab={activeTab}
                />
                
                <div className="flex-grow flex min-h-0">
                    <div className="flex-grow flex flex-col min-h-0">
                        <TabBar tabs={tabs} activeTabPath={activeTabPath} onSelectTab={setActiveTabPath} onCloseTab={closeTab} />
                        <Editor activeTab={activeTab} onCodeChange={handleCodeChange} />
                        <BottomPanel
                            bottomTab={bottomTab}
                            setBottomTab={setBottomTab}
                            output={output}
                            debugState={debugState}
                            onDebugRequest={handleDebugRequest}
                            isDebugging={isDebugging}
                        />
                    </div>
                    <RightPanel activeTab={activeTab} onOpenFileInEditor={openFileInTab} activeRightPanelTab={rightPanelTab} />
                </div>
            </div>
        </div>
    );
};

const ScopedFileTree: FC<{ rootPath: string, onFileSelect: (path: string) => void }> = ({ rootPath, onFileSelect }) => {
    const { listDirectory, fsRevision } = useOS();
    const [tree, setTree] = useState<FSNode | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // FIX: Refactored to recursively build the file tree asynchronously
    useEffect(() => {
        const buildTree = async (path: string): Promise<FSNode | null> => {
            const children = await listDirectory(path);
            if (!children) return { type: 'dir', children: {} };

            const dirNode: FSNode = { type: 'dir', children: {} };

            for (const [name, node] of Object.entries(children)) {
                if (node.type === 'dir') {
                    dirNode.children[name] = await buildTree(`${path}/${name}`) || { type: 'dir', children: {} };
                } else {
                    dirNode.children[name] = node;
                }
            }
            return dirNode;
        };

        const fetchTree = async () => {
            setIsLoading(true);
            const result = await buildTree(rootPath);
            setTree(result);
            setIsLoading(false);
        };
        fetchTree();
    }, [rootPath, listDirectory, fsRevision]);
    
    const renderNode = (name: string, node: FSNode, currentPath: string) => {
        const fullPath = `${currentPath}/${name}`;
        
        if (node.type === 'dir') {
            return (
                <details key={fullPath} open className="pl-2 text-gray-400">
                    <summary className="cursor-pointer hover:text-white list-item">📁 {name}</summary>
                    {Object.entries(node.children)
                        .sort(([aName, aNode], [bName, bNode]) => {
                             if(aNode.type !== bNode.type) return aNode.type === 'dir' ? -1 : 1;
                             return aName.localeCompare(bName)
                        })
                        .map(([childName, childNode]) => renderNode(childName, childNode as FSNode, fullPath))}
                </details>
            );
        } else {
            return (
                <div key={fullPath} className="pl-5 cursor-pointer hover:bg-gray-700/50 text-gray-300" onClick={() => onFileSelect(fullPath)}>
                    📄 {name}
                </div>
            );
        }
    };
    
    if (isLoading) return <div className="p-2 text-gray-500 w-1/4 min-w-[200px] max-w-[300px]">Loading project...</div>;
    if (!tree || tree.type !== 'dir') return <div className="p-2 text-red-500">Error: Project path not found.</div>;
    
    return (
         <div className="w-1/4 h-full min-w-[200px] max-w-[300px] bg-[#252526] p-2 overflow-y-auto no-scrollbar text-sm">
            <h3 className="font-bold text-white mb-2 truncate">{rootPath.split('/').pop()}</h3>
            {Object.entries(tree.children).map(([name, node]) => renderNode(name, node, rootPath))}
         </div>
    );
};

const ActionToolbar: FC<{ onSave: () => void, onRun: () => void, onToggleAIPanel: () => void, onCloseProject: () => void, activeTab: Tab | undefined }> = 
({ onSave, onRun, onToggleAIPanel, onCloseProject, activeTab }) => {
    return (
        <div className="flex-shrink-0 p-1 border-b border-l border-gray-700 flex items-center flex-wrap gap-2">
            <button onClick={onCloseProject} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Close Project</button>
            <button onClick={onSave} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs" disabled={!activeTab}>Save</button>
            <div className="border-l border-gray-600 h-5 mx-1" />
            <button onClick={onRun} className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs text-white" disabled={!activeTab}>▶️ Run</button>
            <button onClick={onToggleAIPanel} className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-xs text-white">AI / Preview</button>
            <span className="text-xs text-gray-400 italic ml-auto truncate">{activeTab?.path || 'No file open'}</span>
        </div>
    );
};

const TabBar: FC<{ tabs: Tab[], activeTabPath: string | null, onSelectTab: (path: string) => void, onCloseTab: (path: string) => void }> = ({ tabs, activeTabPath, onSelectTab, onCloseTab }) => {
    if (!tabs.length) return null;
    return (
        <div className="flex-shrink-0 flex items-center bg-[#252526] overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
                <div key={tab.path} onClick={() => onSelectTab(tab.path)} className={`flex items-center gap-2 pl-3 pr-1 py-1.5 text-xs cursor-pointer border-r border-t ${activeTabPath === tab.path ? 'bg-[#1E1E1E] border-t-obpi-accent text-white' : 'bg-transparent border-t-transparent text-gray-400 hover:bg-gray-700/50'}`}>
                    <span>📄 {tab.path.split('/').pop()}</span>
                    {tab.content !== tab.savedContent && <span className="w-2 h-2 rounded-full bg-white" title="Unsaved"></span>}
                    <button onClick={(e) => { e.stopPropagation(); onCloseTab(tab.path); }} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/80">×</button>
                </div>
            ))}
        </div>
    );
};

const Editor: FC<{ activeTab: Tab | undefined, onCodeChange: (code: string) => void }> = ({ activeTab, onCodeChange }) => {
    const fileExtension = activeTab?.path?.split('.').pop()?.toLowerCase();
    
    return (
        <div className="relative flex-grow h-3/5 min-h-0">
            {activeTab ? (
                <>
                    <textarea value={activeTab.content} onChange={(e) => onCodeChange(e.target.value)} className="absolute inset-0 w-full h-full p-3 bg-transparent text-transparent caret-white outline-none resize-none leading-relaxed no-scrollbar" spellCheck="false" />
                    <pre className="absolute inset-0 w-full h-full p-3 pointer-events-none overflow-auto leading-relaxed no-scrollbar" aria-hidden="true">
                        <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(activeTab.content, fileExtension) + '\n' }} />
                    </pre>
                </>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-500">Select a file to start editing.</div>
            )}
        </div>
    );
};

const BottomPanel: FC<{ bottomTab: string, setBottomTab: (tab: 'output' | 'terminal') => void, output: string, debugState: any, onDebugRequest: () => void, isDebugging: boolean }> = 
({ bottomTab, setBottomTab, output, debugState, onDebugRequest, isDebugging }) => (
    <div className="flex-shrink-0 flex flex-col h-2/5 border-t-2 border-gray-700 min-h-[100px]">
        <div className="flex-shrink-0 flex items-center bg-[#252526]">
            <button onClick={() => setBottomTab('output')} className={`px-3 py-1 text-xs ${bottomTab === 'output' ? 'bg-[#1E1E1E]' : 'text-gray-400'}`}>Output</button>
            <button onClick={() => setBottomTab('terminal')} className={`px-3 py-1 text-xs ${bottomTab === 'terminal' ? 'bg-[#1E1E1E]' : 'text-gray-400'}`}>Terminal</button>
        </div>
        <div className="flex-grow min-h-0 bg-[#1E1E1E] relative">
            {bottomTab === 'output' && (
                <>
                    <pre className="w-full h-full p-2 text-gray-400 overflow-y-auto whitespace-pre-wrap text-xs" dangerouslySetInnerHTML={{ __html: output }} />
                    {debugState && (
                        <div className="absolute bottom-2 right-2">
                            <button onClick={onDebugRequest} disabled={isDebugging} className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded disabled:bg-gray-500">
                                {isDebugging ? 'Debugging...' : '🤖 Debug with AI'}
                            </button>
                        </div>
                    )}
                </>
            )}
            {bottomTab === 'terminal' && <Terminal />}
        </div>
    </div>
);

const RightPanel: FC<{ activeTab: Tab | undefined, onOpenFileInEditor: (path: string) => void, activeRightPanelTab: 'ai' | 'preview' }> = ({ activeTab, onOpenFileInEditor, activeRightPanelTab }) => (
    <div className="w-1/3 min-w-[300px] max-w-[500px] h-full flex flex-col border-l-2 border-gray-700">
        {activeRightPanelTab === 'ai' && <AiAssistantPanel activeTab={activeTab} onOpenFileInEditor={onOpenFileInEditor} />}
        {activeRightPanelTab === 'preview' && <PreviewPanel activeTab={activeTab} />}
    </div>
);

const PreviewPanel: FC<{ activeTab: Tab | undefined }> = ({ activeTab }) => {
    const isHtml = activeTab?.path.endsWith('.html');
    return (
        <div className="h-full flex flex-col bg-[#252526]">
            <div className="flex-shrink-0 p-2 border-b border-gray-700 text-sm font-bold text-center">👁️ Live Preview</div>
            <div className="flex-grow bg-white">
                {isHtml && activeTab ? (
                    <iframe srcDoc={activeTab.content} className="w-full h-full border-none" title="Live Preview" sandbox="allow-scripts" />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 text-center p-4">
                        <p>Live preview is available for HTML files. Open an HTML file to see it here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AiAssistantPanel: FC<{ activeTab: Tab | undefined, onOpenFileInEditor: (path: string) => void }> = ({ activeTab, onOpenFileInEditor }) => {
    const { aiKernel } = useOS();
    const [messages, setMessages] = useState<ChatMessage[]>([{ sender: 'assistant', text: "Ask me to explain, refactor, or add to the current file." }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isLoading || !activeTab) return;

        const userMessage: ChatMessage = { sender: 'user', text: input };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        const assistantPlaceholder: ChatMessage = { sender: 'assistant', text: '' };
        setMessages(prev => [...prev, assistantPlaceholder]);

        try {
            await runDevStudioAgentStream(
                newMessages,
                activeTab ? { path: activeTab.path, content: activeTab.content } : null,
                aiKernel,
                (chunk) => { // onStream
                    setMessages(prev => {
                        const last = prev[prev.length - 1];
                        if (last?.sender === 'assistant') {
                            return [...prev.slice(0, -1), { ...last, text: last.text + chunk }];
                        }
                        return prev;
                    });
                },
                (tool, args, result) => { // onToolUse
                    const resultText = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
                    logger.log('Dev Studio', `Agent used tool ${tool} with result: ${resultText}`);
                    const toolMessage: ChatMessage = { sender: 'assistant', text: `*Using tool: \`${tool}\`...*` };
                    
                    setMessages(prev => [...prev.slice(0, -1), toolMessage, { sender: 'assistant', text: '' }]);
                    
                    if ((tool === 'createFile' || tool === 'writeFile') && result?.success === true) {
                        onOpenFileInEditor(args.path);
                    }
                }
            );
        } catch (error) {
            const errorMessage = `Error: ${error instanceof Error ? error.message : "Unknown"}`;
            setMessages(prev => {
                const last = prev[prev.length - 1];
                return last?.sender === 'assistant' ? [...prev.slice(0, -1), { ...last, text: errorMessage }] : prev;
            });
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, activeTab, messages, aiKernel, onOpenFileInEditor]);

    return (
        <div className="h-full flex flex-col bg-[#252526]">
            <div className="flex-shrink-0 p-2 border-b border-gray-700 text-sm font-bold text-center">👨‍🏫 AI Code Assistant</div>
            <div className="flex-grow p-2 space-y-3 overflow-y-auto no-scrollbar">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-full px-3 py-2 rounded-xl text-xs ${msg.sender === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-800'}`}>
                            <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                        </div>
                    </div>
                ))}
                {isLoading && <div className="text-xs text-gray-400 italic">Thinking...</div>}
                <div ref={chatEndRef} />
            </div>
            <div className="flex-shrink-0 p-2 border-t border-gray-700">
                <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={activeTab ? "Ask about this code..." : "Open a file to chat..."}
                    className="w-full p-2 text-xs bg-gray-800 border border-gray-600 rounded-md resize-none outline-none"
                    rows={3}
                    disabled={isLoading || !activeTab}
                />
            </div>
        </div>
    );
};

export default DevStudio;
