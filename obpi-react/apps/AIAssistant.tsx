
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '../types';
import { useOS } from '../contexts/OSContext';
import * as geminiService from '../services/geminiService';

// A more robust markdown renderer that handles code blocks
const renderMarkdown = (text: string): string => {
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks ```lang\n...\n```
    html = html.replace(/```(\w*)\n([\s\S]+?)\n```/g, (_match, _lang, code) => {
        const safeCode = code
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
        return `<pre class="bg-black/80 rounded-md p-2 my-2 text-white font-mono text-xs overflow-x-auto"><code>${safeCode}</code></pre>`;
    });

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italics *text*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Inline code `code`
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-200 dark:bg-gray-700/80 px-1 rounded text-xs">$1</code>');
    
    // Newlines to <br> but not inside <pre>
    const parts = html.split(/(<pre[\s\S]*?<\/pre>)/g);
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) { // It's not a <pre> block
            parts[i] = parts[i].replace(/\n/g, '<br />');
        }
    }
    html = parts.join('');

    return html;
};


const AIAssistant: React.FC = () => {
    const { aiKernel } = useOS();
    const [messages, setMessages] = useState<ChatMessage[]>([
        { sender: 'assistant', text: "Hello! I'm your AI assistant. I can help you with the OS. Try 'list desktop files', 'open the terminal', or 'search the web for OBPI React Desktop'." }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
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

        // Add an empty assistant message to stream into
        const assistantMessage: ChatMessage = { sender: 'assistant', text: '' };
        setMessages(prev => [...prev, assistantMessage]);

        try {
            const onStream = (chunk: string) => {
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage?.sender === 'assistant') {
                        // Create a new message object to ensure React re-renders
                        const updatedMessage = { ...lastMessage, text: lastMessage.text + chunk };
                        return [...prev.slice(0, -1), updatedMessage];
                    }
                    return prev;
                });
            };

            const onToolUse = (tool: string, args: any) => {
                 const text = `*Using tool: **${tool}** with arguments: \`${JSON.stringify(args)}\`*`;
                 setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage?.sender === 'assistant') {
                        const updatedMessage = { ...lastMessage, text: text };
                        return [...prev.slice(0, -1), updatedMessage];
                    }
                    return prev;
                });
            };

            await geminiService.generateContentStreamWithFunctionCalling(currentInput, aiKernel, onStream, onToolUse);

        } catch (error) {
             setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                const updatedMessage = { ...lastMessage, text: `An error occurred: ${error instanceof Error ? error.message : String(error)}` };
                return [...prev.slice(0, -1), updatedMessage];
            });
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, aiKernel]);

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-xl ${msg.sender === 'user' ? 'bg-obpi-accent text-white' : 'bg-white dark:bg-gray-700'}`}>
                            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="max-w-xs px-4 py-2 rounded-xl bg-white dark:bg-gray-700">
                            <div className="animate-pulse flex space-x-1">
                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
             <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center bg-white dark:bg-gray-900 rounded-lg px-2">
                    <input 
                        type="text" 
                        value={input} 
                        onChange={e => setInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleSend()} 
                        placeholder="Ask me to do something..." 
                        className="flex-grow bg-transparent border-none outline-none p-3 text-sm" 
                        disabled={isLoading} 
                    />
                    <button 
                        onClick={handleSend} 
                        disabled={isLoading || !input.trim()} 
                        className="p-2 rounded-full text-white bg-obpi-accent hover:bg-obpi-accent-darker disabled:bg-gray-400"
                        aria-label="Send message"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;