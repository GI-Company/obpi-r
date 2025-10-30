

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useOS } from '../contexts/OSContext';
import * as geminiService from '../services/geminiService';
import { logger } from '../services/loggingService';

interface BuildMessage {
    sender: 'user' | 'assistant' | 'system';
    text: string;
}

interface AIBuildAgentProps {
    projectPath?: string;
}

const AIBuildAgent: React.FC<AIBuildAgentProps> = ({ projectPath }) => {
    const { aiKernel, showNotification } = useOS();
    const [messages, setMessages] = useState<BuildMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [proposedPlan, setProposedPlan] = useState<{ steps: string[], outputFile: string } | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const addMessage = useCallback((sender: 'user' | 'assistant' | 'system', text: string) => {
        setMessages(prev => [...prev, { sender, text }]);
    }, []);

    const streamToLastMessage = useCallback((chunk: string) => {
         setMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.sender === 'assistant') {
                const updatedMessage = { ...lastMessage, text: lastMessage.text + chunk };
                return [...prev.slice(0, -1), updatedMessage];
            }
            return prev;
        });
    }, []);

    const runAgent = useCallback(async (prompt: string) => {
        setIsLoading(true);
        logger.log('Build Agent', `Starting with prompt: ${prompt.substring(0, 50)}...`);

        addMessage('assistant', '');
        let hasError = false;

        try {
            const onToolUse = (tool: string, args: any, result: any) => {
                if (result?.status === 'plan_proposed') {
                    setProposedPlan(result.plan);
                    addMessage('assistant', `I have a build plan for you. Please review and approve.`);
                    setIsLoading(false); // Stop loading to allow user interaction
                    return; 
                }

                const resultString = JSON.stringify(result, null, 2);
                addMessage('system', `Tool Used: ${tool}\nArgs: ${JSON.stringify(args)}\nResult: ${resultString}`);
                logger.log('Build Agent', `Used tool ${tool} with result.`);
                if (result?.success === false) hasError = true;
                addMessage('assistant', '');
            };

            await geminiService.runAiBuildAgentStream(prompt, aiKernel, streamToLastMessage, onToolUse);

        } catch (error) {
            hasError = true;
            const errorMessage = `An error occurred: ${error instanceof Error ? error.message : String(error)}`;
            streamToLastMessage(errorMessage);
            logger.log('Build Agent', `Error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            const projectName = projectPath?.split('/').pop() || 'Project';
            if (hasError) {
                showNotification({ icon: '❌', title: 'Build Failed', message: `The build for "${projectName}" failed. Check the agent log.` });
            } else {
                 showNotification({ icon: '✅', title: 'Build Successful', message: `The build for "${projectName}" completed.` });
            }
        }
    }, [aiKernel, addMessage, streamToLastMessage, projectPath, showNotification]);
    
    useEffect(() => {
        if (projectPath) {
            const initialPrompt = `Analyze the project at "${projectPath}". If a "build.os" file exists, parse it as JSON and use it as the primary build instruction. Otherwise, determine the build plan from the file structure. Propose the plan to me and await confirmation before executing the build.`;
            addMessage('system', `Project directory: ${projectPath}`);
            runAgent(initialPrompt);
        }
    }, [projectPath, addMessage, runAgent]);

    const handleSend = () => {
        if (!input.trim() || isLoading) return;
        addMessage('user', input);
        runAgent(input);
        setInput('');
    };
    
    const handleApprovePlan = () => {
        if (!proposedPlan) return;
        const approvalMessage = `The user has approved the build plan. Proceed with executing the following steps: ${proposedPlan.steps.join(', ')}. The final output should be at ${proposedPlan.outputFile}.`;
        addMessage('user', 'I approve the plan. Go ahead.');
        runAgent(approvalMessage);
        setProposedPlan(null); // Clear the plan so the button disappears
    };
    
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex flex-col h-full bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <div className="flex-grow p-4 space-y-4 overflow-y-auto font-mono text-sm">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-full px-4 py-2 rounded-lg whitespace-pre-wrap ${
                           msg.sender === 'user' ? 'bg-blue-600 text-white' : 
                           msg.sender === 'assistant' ? 'bg-white dark:bg-gray-700' : 
                           'bg-gray-300 dark:bg-gray-900 text-gray-500 text-xs italic'
                        }`}>
                           {msg.text}
                       </div>
                    </div>
                ))}

                {proposedPlan && (
                    <PlanDisplay plan={proposedPlan} onApprove={handleApprovePlan} />
                )}

                {isLoading && <div className="animate-pulse">Assistant is thinking...</div>}
                <div ref={chatEndRef} />
            </div>
             <div className="p-2 border-t border-gray-300 dark:border-gray-700">
                <div className="flex items-center bg-white dark:bg-gray-900 rounded-lg px-2">
                    <input 
                        type="text" 
                        value={input} 
                        onChange={e => setInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleSend()} 
                        placeholder="Type your command..." 
                        className="flex-grow bg-transparent border-none outline-none p-3 text-sm" 
                        disabled={isLoading || !!proposedPlan}
                    />
                    <button 
                        onClick={handleSend} 
                        disabled={isLoading || !input.trim() || !!proposedPlan}
                        className="p-2 rounded-full text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-400"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

const PlanDisplay: React.FC<{ plan: { steps: string[], outputFile: string }, onApprove: () => void }> = ({ plan, onApprove }) => (
    <div className="bg-white dark:bg-gray-700 p-3 rounded-lg my-2 border border-yellow-500 max-w-full">
        <h4 className="font-bold mb-2 text-base">Build Plan Proposed:</h4>
        <ul className="list-disc list-inside text-xs space-y-1">
            {plan.steps.map((step, i) => <li key={i}>{step}</li>)}
        </ul>
        <p className="text-xs mt-2">
            <strong>Output:</strong>
            <code className="bg-gray-200 dark:bg-gray-800 p-1 rounded ml-1">{plan.outputFile}</code>
        </p>
        <button
            onClick={onApprove}
            className="w-full mt-3 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-500"
        >
            Approve Plan & Build
        </button>
    </div>
);

export default AIBuildAgent;