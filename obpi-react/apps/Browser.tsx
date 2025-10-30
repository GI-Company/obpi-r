
import React, { useState, useEffect, KeyboardEvent } from 'react';
import * as geminiService from '../services/geminiService';

interface BrowserProps {
  initialUrl?: string;
  initialQuery?: string;
}

const Browser: React.FC<BrowserProps> = ({ initialUrl, initialQuery }) => {
  const effectiveInitialValue = initialQuery || initialUrl || 'http://obpi.local/';

  const [history, setHistory] = useState<string[]>([effectiveInitialValue]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [inputValue, setInputValue] = useState(effectiveInitialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);

  const currentUrl = history[historyIndex];

  const navigate = (urlOrQuery: string) => {
    if (!urlOrQuery.trim()) return;

    setIsLoading(true);
    setContent(null);
    const trimmedInput = urlOrQuery.trim();

    const isUrl = trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://') || (trimmedInput.includes('.') && !trimmedInput.includes(' '));
    
    // Update history before async operations
    const newHistory = [...history.slice(0, historyIndex + 1), trimmedInput];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setInputValue(trimmedInput);
    
    if (isUrl) {
      if (trimmedInput.startsWith('http://obpi.local')) {
        // The service worker will intercept this fetch call
        fetch(trimmedInput)
          .then(async (res) => {
              const text = await res.text();
              if (!res.ok) {
                  throw new Error(`HTTP error! status: ${res.status}, content: ${text}`);
              }
              return text;
          })
          .then(text => setContent(text))
          .catch(err => setContent(`<h1>Network Error</h1><p>${err.message}</p>`))
          .finally(() => setIsLoading(false));

      } else {
        // External URLs are not loaded for security, show a message instead.
        setContent(`<div class="p-4"><h1 class="text-lg font-bold">External Site</h1><p>Browsing external websites is simulated. You attempted to navigate to:</p><a href="${trimmedInput}" target="_blank" class="text-blue-500 hover:underline">${trimmedInput}</a></div>`);
        setIsLoading(false);
      }
    } else {
      // AI Search
      geminiService.performAiSearch(trimmedInput).then(result => {
        setContent(result);
      }).catch(err => {
        setContent(`<div class="p-2 bg-red-100 text-red-800 rounded"><h3>Error during AI search</h3><p>${err.message}</p></div>`);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  };
  
  useEffect(() => {
    if (effectiveInitialValue) {
      navigate(effectiveInitialValue);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigate(inputValue);
    }
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      navigate(history[newIndex]);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      navigate(history[newIndex]);
    }
  };

  const refresh = () => {
    navigate(history[historyIndex]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
      <div className="flex-shrink-0 p-2 border-b border-gray-300 dark:border-gray-700 flex items-center gap-2">
        <button onClick={goBack} disabled={historyIndex === 0} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">⬅️</button>
        <button onClick={goForward} disabled={historyIndex >= history.length - 1} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">➡️</button>
        <button onClick={refresh} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">🔄</button>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-grow p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
          placeholder="Enter URL or search with AI..."
        />
      </div>
      <div className="flex-grow relative bg-white dark:bg-gray-900">
        {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 z-10">Loading...</div>}
        <iframe
            srcDoc={content || ''}
            className="w-full h-full border-none"
            title="Browser"
            sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts"
        />
      </div>
       <div className="flex-shrink-0 p-1 border-t border-gray-300 dark:border-gray-700 text-center text-xs text-gray-500 dark:text-gray-400">
        ✨ Real in-browser server at http://obpi.local/. Other queries use AI Search.
      </div>
    </div>
  );
};

export default Browser;