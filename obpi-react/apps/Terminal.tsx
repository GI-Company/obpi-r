
import React, { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { useOS } from '../contexts/OSContext';

interface OutputLine {
  id: number;
  type: 'command' | 'output';
  text: string | React.ReactNode;
  prompt?: React.ReactNode;
  originalText?: string;
}

interface TerminalProps {
    initialCommand?: string;
}

const syntaxHighlight = (code: string, ext?: string): string => {
    let highlighted = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Generic
    highlighted = highlighted.replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/g, '<span class="text-gray-500">$1</span>');
    highlighted = highlighted.replace(/\b(\d+)\b/g, '<span class="text-blue-400">$1</span>');

    switch (ext) {
        case 'js': case 'ts':
            return highlighted.replace(/\b(const|let|var|function|return|if|else|for|while|import|from|async|await|new|class|extends|super|this|document|window|console|true|false)\b/g, '<span class="text-pink-400">$1</span>');
        case 'py':
            return highlighted.replace(/\b(def|return|if|else|elif|for|while|import|from|as|class|True|False|None|print|in|is|and|or|not)\b/g, '<span class="text-yellow-400">$1</span>');
        case 'olic':
            return highlighted.replace(/\b(let|func|if|else|while|return|import|true|false|null)\b/g, '<span class="text-sky-400">$1</span>');
        case 'c': case 'cpp':
            return highlighted.replace(/\b(int|char|void|if|else|while|for|return|#include|printf|main|struct|typedef)\b/g, '<span class="text-indigo-400">$1</span>');
        case 'rs':
             return highlighted.replace(/\b(fn|let|mut|if|else|while|for|return|mod|use|struct|enum|impl|pub|crate|self|true|false)\b/g, '<span class="text-orange-400">$1</span>');
        case 'html':
            return highlighted.replace(/(&lt;[a-zA-Z0-9]+|&gt;|\/&gt;|&lt;\/[a-zA-Z0-9]+&gt;)/g, '<span class="text-red-400">$1</span>');
        default:
            return highlighted;
    }
};


const Terminal: React.FC<TerminalProps> = ({ initialCommand }) => {
  const { cwd, commandInterpreter, currentUser, apiService } = useOS();
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isInitialCommandRun = useRef(false);

  useEffect(() => {
    containerRef.current?.scrollTo(0, containerRef.current.scrollHeight);
  }, [output]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusInput();
  },[focusInput]);
  
  const addOutput = useCallback((text: string | React.ReactNode, type: 'command' | 'output', prompt?: React.ReactNode, originalText?: string) => {
    if (type === 'output' && (text === null || text === undefined || text === '')) return;

    const newOutput: OutputLine = { 
        id: Date.now() + Math.random(), 
        type, 
        text,
        prompt,
        originalText: originalText !== undefined ? originalText : (typeof text === 'string' ? text : undefined),
    };
    setOutput(prev => [...prev.slice(-200), newOutput]);
  }, []);

  // Subscribe to real-time terminal output from the ApiService
  useEffect(() => {
    const handleTerminalOutput = (data: string) => {
      // The backend sends raw output, including prompts. We just display it.
      setOutput(prev => {
        const lastLine = prev[prev.length - 1];
        // If the last line was also output, append to it to simulate a stream
        if (lastLine && lastLine.type === 'output') {
          const newText = (lastLine.text as string) + data;
          const newOriginalText = (lastLine.originalText || '') + data;
          return [...prev.slice(0, -1), { ...lastLine, text: newText, originalText: newOriginalText }];
        }
        // Otherwise, add a new output line
        return [...prev, { id: Date.now() + Math.random(), type: 'output', text: data, originalText: data }];
      });
    };

    apiService.on('terminalOutput', handleTerminalOutput);
    return () => {
      apiService.off('terminalOutput', handleTerminalOutput);
    };
  }, [apiService]);

  useEffect(() => {
    // Auto-resize textarea
    if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  const getPrompt = useCallback(() => {
    const username = currentUser?.username || 'guest';
    const homeDir = username === 'root' ? '/root' : `/home/${username}`;
    const path = cwd.startsWith(homeDir) && homeDir !== '/' ? `~${cwd.substring(homeDir.length)}` : cwd;
    const terminator = username === 'root' ? '# ' : '$ ';
    return (
        <>
            <span className={username === 'root' ? 'text-red-500' : 'text-cyan-400'}>{username}@obpi</span>
            <span>:</span>
            <span className="text-yellow-400">{path}</span>
            <span>{terminator}</span>
        </>
    );
}, [cwd, currentUser]);
  
  const updateLastOutput = useCallback((text: string | React.ReactNode) => {
      setOutput(prev => {
          if (prev.length === 0) return prev;
          const newOutput = [...prev];
          newOutput[newOutput.length - 1].text = text;
          if (typeof text === 'string') {
            newOutput[newOutput.length - 1].originalText = text;
          }
          return newOutput;
      })
  }, []);

  const processInput = useCallback(async (command: string) => {
    const currentPrompt = getPrompt();
    const [commandName, ...args] = command.trim().split(/\s+/);
    
    if (command.trim()) {
        addOutput(command, 'command', currentPrompt, command);
        if(command.trim() !== history[0]) {
            setHistory(prev => [command.trim(), ...prev.slice(0,49)]);
        }
    } else {
         addOutput('', 'command', currentPrompt, '');
    }
    
    setInput('');
    setHistoryIndex(-1);

    if (command.trim()) {
        // Execute command. For backend commands, this is fire-and-forget.
        // The output will be received via the 'terminalOutput' event.
        const localResult = await commandInterpreter.execute(
            command,
            (aiMessage: string) => { addOutput(aiMessage, 'output'); },
            (finalAiOutput: string) => { updateLastOutput(finalAiOutput); }
        );
        
        // Handle local commands that return immediate output
        if (localResult) {
             if (commandName === 'cat' && typeof localResult === 'string' && args[0]) {
                const extension = args[0].split('.').pop()?.toLowerCase();
                const highlightedCode = syntaxHighlight(localResult, extension);
                const outputElement = <pre className="font-mono whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: highlightedCode }} />;
                addOutput(outputElement, 'output', undefined, localResult);
            } else {
                addOutput(localResult, 'output');
            }
        }
    }
  }, [commandInterpreter, addOutput, updateLastOutput, history, getPrompt]);

  useEffect(() => {
      if (initialCommand && !isInitialCommandRun.current) {
          isInitialCommandRun.current = true;
          setInput(initialCommand);
          processInput(initialCommand);
      }
  }, [initialCommand, processInput]);


  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        processInput(input);
    } else if (e.key === 'ArrowUp') {
        const isFirstLine = e.currentTarget.selectionStart === 0 || !input.slice(0, e.currentTarget.selectionStart).includes('\n');
        if(isFirstLine && history.length > 0) {
            e.preventDefault();
            const newIndex = Math.min(historyIndex + 1, history.length - 1);
            setHistoryIndex(newIndex);
            setInput(history[newIndex] || '');
        }
    } else if (e.key === 'ArrowDown') {
        const isLastLine = !input.slice(e.currentTarget.selectionStart).includes('\n');
        if(isLastLine) {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(history[newIndex] || '');
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    } else if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault();
        addOutput(input, 'command', getPrompt(), input);
        addOutput('^C', 'output');
        setHistoryIndex(-1);
        setInput('');
    } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        setOutput([]);
    }
  };
  
  const handleCopy = (e: React.MouseEvent, line: OutputLine) => {
    if (line.originalText) {
        navigator.clipboard.writeText(line.originalText);
        const target = e.currentTarget;
        target.classList.add('bg-green-900/80');
        setTimeout(() => {
            target.classList.remove('bg-green-900/80');
        }, 250);
    }
  };

  return (
    <div
      className="font-mono bg-black/90 text-white h-full p-2 flex flex-col text-sm focus:outline-none"
      onClick={focusInput}
    >
      <div ref={containerRef} className="flex-grow overflow-y-auto pr-2">
        {output.map(line => (
          <div key={line.id}>
            {line.type === 'command' ? (
              <div 
                className="flex cursor-pointer hover:bg-white/10 transition-colors rounded"
                onClick={(e) => handleCopy(e, line)}
                title={line.originalText ? 'Click to copy command' : undefined}
              >
                  <div className="flex-shrink-0">{line.prompt}</div>
                  <div className="whitespace-pre-wrap break-words">{line.text}</div>
              </div>
            ) : (
              <div 
                className="text-gray-300 break-words cursor-pointer hover:bg-white/10 transition-colors rounded"
                onClick={(e) => handleCopy(e, line)}
                title={line.originalText ? 'Click to copy output' : undefined}
              >
                {line.text}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex-shrink-0 flex items-start pt-1">
        <span>{getPrompt()}</span>
        <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-grow bg-transparent border-none outline-none resize-none p-0 ml-1 overflow-y-hidden"
            rows={1}
            spellCheck="false"
            autoFocus
        />
      </div>
    </div>
  );
};

export default Terminal;
