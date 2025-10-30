import React, { useState, useRef, useEffect, useCallback, FC } from 'react';
import type { ChatMessage, GroundingChunk } from '../types';
import { useOS } from '../contexts/OSContext';
import * as geminiService from '../services/geminiService';

type Tab = 'chat' | 'generateImage' | 'editImage' | 'generateVideo' | 'tts';

interface GeminiStudioProps {
    initialTab?: Tab;
    initialPrompt?: string;
    filePath?: string;
}

const GeminiStudio: React.FC<GeminiStudioProps> = ({ initialTab = 'chat', initialPrompt, filePath }) => {
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    
    useEffect(() => {
        if(initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'chat':
                return <ChatTab initialPrompt={initialPrompt} />;
            case 'generateImage':
                return <GenerateImageTab />;
            case 'editImage':
                return <EditImageTab initialFilePath={filePath} />;
            case 'generateVideo':
                return <GenerateVideoTab />;
            case 'tts':
                return <TextToSpeechTab />;
            default:
                return null;
        }
    };

    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'chat', label: 'Chat', icon: '💬' },
        { id: 'generateImage', label: 'Image Gen', icon: '🎨' },
        { id: 'editImage', label: 'Image Edit', icon: '✏️' },
        { id: 'generateVideo', label: 'Video Gen', icon: '🎬' },
        { id: 'tts', label: 'TTS', icon: '🔊' },
    ];

    return (
        <div className="flex flex-col h-full bg-gray-200 dark:bg-gray-900">
            <div className="flex-shrink-0 flex items-center border-b border-gray-300 dark:border-gray-700">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 text-sm flex items-center gap-2 ${activeTab === tab.id ? 'bg-white dark:bg-gray-800' : 'bg-transparent'}`}
                        title={tab.label}
                    >
                        <span className="text-lg">{tab.icon}</span>
                        <span className="hidden md:inline">{tab.label}</span>
                    </button>
                ))}
            </div>
            <div className="flex-grow overflow-y-auto">
                {renderActiveTab()}
            </div>
        </div>
    );
};

const handleSave = (
    dataUrl: string | null,
    defaultName: string,
    os: ReturnType<typeof useOS>
) => {
    if (!dataUrl || !os.currentUser) return;

    os.showModal(
        'Save As',
        <input
            id="save-as-filename"
            type="text"
            defaultValue={defaultName}
            className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700 font-mono"
            autoFocus
        />,
        [
            { text: 'Cancel', type: 'secondary', onClick: () => {} },
            {
                text: 'Save',
                type: 'primary',
                onClick: async () => {
                    const filename = (document.getElementById('save-as-filename') as HTMLInputElement).value;
                    if (!filename) {
                        os.showNotification({ icon: '❌', title: 'Error', message: 'Filename cannot be empty.' });
                        return;
                    }
                    try {
                        const base64 = dataUrl.split(',')[1];
                        const byteChars = atob(base64);
                        const byteNumbers = new Array(byteChars.length);
                        for (let i = 0; i < byteChars.length; i++) {
                            byteNumbers[i] = byteChars.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const path = `/home/${os.currentUser?.username}/Downloads/${filename}`;

                        if (await os.writeFile(path, byteArray)) {
                            os.showNotification({ icon: '💾', title: 'File Saved', message: `Saved to Downloads/${filename}` });
                        } else {
                            throw new Error('VFS write operation failed.');
                        }
                    } catch (e) {
                        os.showNotification({ icon: '❌', title: 'Save Failed', message: e instanceof Error ? e.message : 'Could not save the file.' });
                    }
                },
            },
        ]
    );
};


// --- CHAT TAB ---
const ChatTab: FC<{initialPrompt?: string}> = ({ initialPrompt }) => {
    const { aiKernel } = useOS();
    const [messages, setMessages] = useState<ChatMessage[]>([{ sender: 'assistant', text: 'Hello! Ask me a question or give me a command.' }]);
    const [input, setInput] = useState(initialPrompt || '');
    const [isLoading, setIsLoading] = useState(false);
    const [useGrounding, setUseGrounding] = useState(true);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    const handleSend = useCallback(async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        const assistantMessage: ChatMessage = { sender: 'assistant', text: '', groundingChunks: [] };
        setMessages(prev => [...prev, assistantMessage]);

        try {
            if (useGrounding) {
                const response = await geminiService.performGroundedSearch(currentInput, true);
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    lastMsg.text = response.text;
                    // FIX: Map the SDK's GroundingChunk type to the local one, ensuring required properties exist.
                    const sdkChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                    lastMsg.groundingChunks = sdkChunks
                        .map((chunk: any): GroundingChunk | null => {
                            if (chunk.web && chunk.web.uri && chunk.web.title) {
                                return { web: { uri: chunk.web.uri, title: chunk.web.title } };
                            }
                            if (chunk.maps && chunk.maps.uri && chunk.maps.title) {
                                // Note: Not mapping reviewSnippets for simplicity as it's not used in the UI here.
                                return { maps: { uri: chunk.maps.uri, title: chunk.maps.title } };
                            }
                            return null;
                        })
                        .filter((c): c is GroundingChunk => c !== null);
                    return [...prev];
                });

            } else {
                const onStream = (chunk: string) => {
                    setMessages(prev => {
                        const lastMessage = prev[prev.length - 1];
                        if (lastMessage?.sender === 'assistant') {
                            return [...prev.slice(0, -1), { ...lastMessage, text: lastMessage.text + chunk }];
                        }
                        return prev;
                    });
                };
                const onToolUse = (tool: string, args: any) => {
                    const text = `Using tool: **${tool}** with arguments: \`${JSON.stringify(args)}\``;
                    setMessages(prev => {
                        const lastMessage = prev[prev.length - 1];
                        if (lastMessage?.sender === 'assistant') {
                            return [...prev.slice(0, -1), { ...lastMessage, text }];
                        }
                        return prev;
                    });
                };
                await geminiService.generateContentStreamWithFunctionCalling(currentInput, aiKernel, onStream, onToolUse);
            }
        } catch (error) {
             setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                lastMessage.text = `An error occurred: ${error instanceof Error ? error.message : String(error)}`;
                return [...prev];
            });
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, aiKernel, useGrounding]);
    
    useEffect(() => {
        if (initialPrompt) {
            handleSend();
        }
    }, []);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-xl ${msg.sender === 'user' ? 'bg-obpi-accent text-white' : 'bg-white dark:bg-gray-700'}`}>
                            <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
                             {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                                    <h4 className="text-xs font-bold mb-1">Sources:</h4>
                                    <ul className="text-xs space-y-1">
                                        {msg.groundingChunks.map((chunk, i) => {
                                            const source = chunk.web || chunk.maps;
                                            return source ? <li key={i}><a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{source.title}</a></li> : null;
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && <div className="flex justify-start"> <div className="max-w-xs px-4 py-2 rounded-xl bg-white dark:bg-gray-700"><div className="animate-pulse flex space-x-1"><div className="w-2 h-2 bg-gray-500 rounded-full"></div><div className="w-2 h-2 bg-gray-500 rounded-full"></div><div className="w-2 h-2 bg-gray-500 rounded-full"></div></div></div></div>}
                <div ref={chatEndRef} />
            </div>
             <div className="p-2 md:p-4 border-t border-gray-300 dark:border-gray-700">
                 <div className="flex items-center gap-2 mb-2">
                     <input type="checkbox" id="grounding-checkbox" checked={useGrounding} onChange={(e) => setUseGrounding(e.target.checked)} className="h-4 w-4 rounded" />
                     <label htmlFor="grounding-checkbox" className="text-sm text-gray-700 dark:text-gray-300">Use Google Search & Maps Grounding</label>
                 </div>
                <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg px-2">
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Ask anything..." className="flex-grow bg-transparent border-none outline-none p-3" disabled={isLoading} />
                    <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-2 rounded-full text-white bg-obpi-accent hover:bg-obpi-accent-darker disabled:bg-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- IMAGE GENERATION TAB ---
const GenerateImageTab: FC = () => {
    const os = useOS();
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError('');
        setGeneratedImage(null);
        try {
            const base64Bytes = await geminiService.generateImage(prompt, aspectRatio);
            setGeneratedImage(`data:image/jpeg;base64,${base64Bytes}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 space-y-4">
             <h3 className="text-xl font-bold">Image Generation (Imagen 4)</h3>
             <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A futuristic cityscape at sunset..." className="w-full p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600" rows={3}></textarea>
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 flex-wrap">
                <label className="text-sm flex-shrink-0">Aspect Ratio:</label>
                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                    <option value="1:1">1:1 (Square)</option><option value="16:9">16:9 (Landscape)</option><option value="9:16">9:16 (Portrait)</option><option value="4:3">4:3</option><option value="3:4">3:4</option>
                </select>
                <button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="px-4 py-2 bg-obpi-accent text-white rounded disabled:bg-gray-500">
                    {isLoading ? 'Generating...' : 'Generate'}
                </button>
                <button onClick={() => handleSave(generatedImage, 'generated-image.jpg', os)} disabled={!generatedImage} className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-500">
                    Save Image
                </button>
             </div>
             {error && <div className="p-2 bg-red-200 text-red-800 rounded">{error}</div>}
             {isLoading && <div className="text-center p-4">Generating image, this may take a moment...</div>}
             {generatedImage && <img src={generatedImage} alt="Generated" className="max-w-full mx-auto rounded-lg shadow-lg" />}
        </div>
    );
};

// --- IMAGE EDITING TAB ---
const EditImageTab: FC<{initialFilePath?: string}> = ({initialFilePath}) => {
    const os = useOS();
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [originalImage, setOriginalImage] = useState<{data: string; mimeType: string, url: string} | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);

    const handleFileChange = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setOriginalImage({ data: base64, mimeType: file.type, url: reader.result as string });
            setEditedImage(null);
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        const loadImage = async () => {
            if(initialFilePath) {
                // FIX: use async readFile from OS context instead of removed vfs property
                const fileContent = await os.readFile(initialFilePath);
                if (fileContent instanceof Uint8Array) {
                    const mimeType = `image/${initialFilePath.split('.').pop()}`;
                    const base64 = btoa(String.fromCharCode.apply(null, Array.from(fileContent)));
                    setOriginalImage({ data: base64, mimeType, url: `data:${mimeType};base64,${base64}` });
                }
            }
        };
        loadImage();
    }, [initialFilePath, os.readFile]);

    const handleEdit = async () => {
        if (!prompt.trim() || !originalImage) return;
        setIsLoading(true);
        setError('');
        setEditedImage(null);
        try {
            const base64Bytes = await geminiService.editImage(prompt, originalImage);
            setEditedImage(`data:image/png;base64,${base64Bytes}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 space-y-4">
             <h3 className="text-xl font-bold">Image Editing (Gemini Flash Image)</h3>
             {!originalImage && <input type="file" accept="image/*" onChange={e => e.target.files && handleFileChange(e.target.files[0])} className="block" />}
             {originalImage && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <h4 className="text-lg font-semibold mb-2">Original</h4>
                        <img src={originalImage.url} alt="Original" className="max-w-full rounded-lg shadow-md" />
                     </div>
                     <div>
                        <h4 className="text-lg font-semibold mb-2">Edited</h4>
                        {editedImage && <img src={editedImage} alt="Edited" className="max-w-full rounded-lg shadow-md" />}
                        {isLoading && <div className="flex items-center justify-center h-full">Editing...</div>}
                     </div>
                </div>
             )}
             {originalImage && (
                <>
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Add a retro filter..." className="w-full p-2 rounded bg-white dark:bg-gray-800 border" rows={2}></textarea>
                    <div className="flex items-center gap-2">
                        <button onClick={handleEdit} disabled={isLoading || !prompt.trim()} className="px-4 py-2 bg-obpi-accent text-white rounded disabled:bg-gray-500">
                            {isLoading ? 'Editing...' : 'Apply Edit'}
                        </button>
                        <button onClick={() => handleSave(editedImage, 'edited-image.png', os)} disabled={!editedImage} className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-500">
                            Save Edited Image
                        </button>
                    </div>
                </>
             )}
             {error && <div className="p-2 bg-red-200 text-red-800 rounded">{error}</div>}
        </div>
    );
};

// --- VIDEO GENERATION TAB ---
const GenerateVideoTab: FC = () => {
    const os = useOS();
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [image, setImage] = useState<{data: string; mimeType: string} | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
    const [isKeySelected, setIsKeySelected] = useState(false);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setIsKeySelected(true);
            }
        };
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setIsKeySelected(true); // Assume success to avoid race condition
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError('');
        setGeneratedVideo(null);
        try {
            const base64Bytes = await geminiService.generateVideo(prompt, aspectRatio, image);
            setGeneratedVideo(`data:video/mp4;base64,${base64Bytes}`);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
             if (errorMessage.includes("Requested entity was not found.")) {
                setError("API Key error. Please re-select your API key.");
                setIsKeySelected(false);
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isKeySelected) {
        return (
            <div className="p-4 text-center space-y-4">
                <h3 className="text-xl font-bold">Veo Video Generation</h3>
                <p>Veo requires you to select your own API key and enable billing.</p>
                <p><a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Learn about billing</a></p>
                <button onClick={handleSelectKey} className="px-4 py-2 bg-obpi-accent text-white rounded">Select API Key</button>
            </div>
        );
    }
    
    return (
        <div className="p-4 space-y-4">
             <h3 className="text-xl font-bold">Video Generation (Veo)</h3>
             <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A robot holding a red skateboard..." className="w-full p-2 rounded" rows={3}></textarea>
             <div>
                <label className="block text-sm mb-1">Optional starting image:</label>
                <input type="file" accept="image/*" onChange={e => {
                    if(e.target.files?.[0]){
                        const reader = new FileReader();
                        reader.onload = () => setImage({ data: (reader.result as string).split(',')[1], mimeType: e.target.files![0].type });
                        reader.readAsDataURL(e.target.files[0]);
                    }
                }} />
             </div>
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 flex-wrap">
                <label className="text-sm flex-shrink-0">Aspect Ratio:</label>
                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as '16:9' | '9:16')} className="p-2 rounded">
                    <option value="16:9">16:9 (Landscape)</option><option value="9:16">9:16 (Portrait)</option>
                </select>
                <button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="px-4 py-2 bg-obpi-accent text-white rounded disabled:bg-gray-500">
                    {isLoading ? 'Generating...' : 'Generate Video'}
                </button>
                 <button onClick={() => handleSave(generatedVideo, 'generated-video.mp4', os)} disabled={!generatedVideo} className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-500">
                    Save Video
                </button>
             </div>
             {error && <div className="p-2 bg-red-200 text-red-800 rounded">{error}</div>}
             {isLoading && <div className="text-center p-4">Generating video. This can take several minutes...</div>}
             {generatedVideo && <video src={generatedVideo} controls className="max-w-full mx-auto rounded-lg shadow-lg" />}
        </div>
    );
};

// --- TEXT TO SPEECH TAB ---
const TextToSpeechTab: FC = () => {
    const os = useOS();
    const [prompt, setPrompt] = useState('Hello, this is a test of the text-to-speech model.');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [audioSrc, setAudioSrc] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError('');
        setAudioSrc(null);
        try {
            const base64Bytes = await geminiService.generateSpeech(prompt);
            setAudioSrc(`data:audio/webm;base64,${base64Bytes}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 space-y-4">
             <h3 className="text-xl font-bold">Text-to-Speech</h3>
             <textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full p-2 rounded" rows={4}></textarea>
             <div className="flex items-center gap-2">
                <button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="px-4 py-2 bg-obpi-accent text-white rounded disabled:bg-gray-500">
                    {isLoading ? 'Generating...' : 'Generate Speech'}
                </button>
                <button onClick={() => handleSave(audioSrc, 'generated-speech.webm', os)} disabled={!audioSrc} className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-500">
                    Save Audio
                </button>
             </div>
             {error && <div className="p-2 bg-red-200 text-red-800 rounded">{error}</div>}
             {audioSrc && <audio src={audioSrc} controls className="w-full mt-4" />}
        </div>
    );
};

export default GeminiStudio;
