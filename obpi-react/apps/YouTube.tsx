import React, { useState, useEffect, KeyboardEvent, useCallback } from 'react';
import * as geminiService from '../services/geminiService';

interface VideoResult {
    videoId: string;
    title: string;
    thumbnailUrl: string;
}

interface YouTubeProps {
    initialQuery?: string;
}

const YouTube: React.FC<YouTubeProps> = ({ initialQuery }) => {
    const [searchQuery, setSearchQuery] = useState(initialQuery || 'OBPI React Desktop');
    const [results, setResults] = useState<VideoResult[]>([]);
    const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;
        setIsLoading(true);
        setError(null);
        setSelectedVideoId(null);
        setResults([]);
        try {
            const videoResults = await geminiService.searchYouTubeVideos(searchQuery);
            setResults(videoResults);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred during search.');
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery]);

    // Perform an initial search on load
    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const renderContent = () => {
        if (selectedVideoId) {
            return (
                <div className="w-full h-full flex flex-col bg-black">
                    <iframe
                        key={selectedVideoId} // Force re-render on video change
                        src={`https://www.youtube.com/embed/${selectedVideoId}?autoplay=1`}
                        className="w-full h-full border-none"
                        title="YouTube video player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
            );
        }

        if (isLoading) {
            return <div className="flex items-center justify-center h-full text-gray-500">Searching for videos...</div>;
        }
        
        if (error) {
            return <div className="p-4 text-red-500">Error: {error}</div>;
        }

        if (results.length === 0) {
            return <div className="flex items-center justify-center h-full text-gray-500">No results found for "{searchQuery}".</div>;
        }

        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 overflow-y-auto">
                {results.map(video => (
                    <div
                        key={video.videoId}
                        className="cursor-pointer group"
                        onClick={() => setSelectedVideoId(video.videoId)}
                    >
                        <div className="aspect-video bg-gray-300 dark:bg-gray-700 rounded-lg overflow-hidden">
                             <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover rounded-lg shadow-md group-hover:shadow-xl transition-shadow" />
                        </div>
                        <p className="text-sm mt-2 line-clamp-2 font-semibold">{video.title}</p>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-200 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <div className="flex-shrink-0 p-2 border-b border-gray-300 dark:border-gray-700 flex items-center gap-2 bg-white dark:bg-gray-800">
                {selectedVideoId && (
                    <button onClick={() => setSelectedVideoId(null)} className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-1">
                        <span>⬅️</span>
                        <span className="hidden sm:inline">Back to Search</span>
                    </button>
                )}
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-grow p-2 rounded bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
                    placeholder="Search YouTube..."
                />
                 <button onClick={handleSearch} disabled={isLoading} className="p-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-500">
                    Search
                 </button>
            </div>
            <div className="flex-grow relative bg-gray-100 dark:bg-gray-900">
                {renderContent()}
            </div>
        </div>
    );
};

export default YouTube;
