import React, { useState, useRef } from 'react';
import { analyzeImage } from '../services/geminiService';

const VideoAnalyzer: React.FC = () => {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [frameSrc, setFrameSrc] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('Describe this frame from the video.');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleFileChange = (file: File | null) => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        setVideoSrc(url);
        setFrameSrc(null);
        setResult('');
        setError('');
    };

    const captureFrame = (): Promise<{ data: string; mimeType: string }> => {
        return new Promise((resolve, reject) => {
            if (!videoRef.current) return reject(new Error('Video element not found'));
            
            const video = videoRef.current;
            video.currentTime = 1; // Seek to 1 second to ensure frame is loaded

            video.onseeked = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Could not get canvas context'));
                
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const mimeType = 'image/jpeg';
                const dataUrl = canvas.toDataURL(mimeType, 0.9);
                setFrameSrc(dataUrl);
                const base64Data = dataUrl.split(',')[1];
                resolve({ data: base64Data, mimeType });
            };
        });
    };

    const handleAnalyze = async () => {
        if (!videoSrc || !prompt) return;
        setIsLoading(true);
        setError('');
        setResult('');
        try {
            const image = await captureFrame();
            const analysisResult = await analyzeImage(prompt, image);
            setResult(analysisResult);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred during analysis.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 flex flex-col h-full space-y-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <h3 className="text-xl font-bold">Video Analysis (Gemini Flash)</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload a video, and the AI will analyze the first frame based on your prompt.
            </p>
            <div>
                <label className="block text-sm mb-1">Upload Video File:</label>
                <input
                    type="file"
                    accept="video/*"
                    onChange={e => handleFileChange(e.target.files ? e.target.files[0] : null)}
                    className="block text-sm"
                />
            </div>
            
            {/* Hidden video element for processing */}
            {videoSrc && <video ref={videoRef} src={videoSrc} className="hidden" />}

            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 overflow-auto">
                {/* Left Panel: Frame & Prompt */}
                <div className="flex flex-col space-y-2">
                    <div className="flex-grow bg-gray-200 dark:bg-gray-900 rounded-md flex items-center justify-center min-h-[200px]">
                        {frameSrc ? (
                            <img src={frameSrc} alt="Captured frame" className="max-h-full max-w-full object-contain" />
                        ) : (
                            <span className="text-gray-500">Video frame will appear here</span>
                        )}
                    </div>
                     <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="e.g., Summarize this video"
                        className="w-full p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                        rows={2}
                        disabled={!videoSrc}
                    />
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !videoSrc || !prompt.trim()}
                        className="px-4 py-2 bg-obpi-accent text-white rounded disabled:bg-gray-500"
                    >
                        {isLoading ? 'Analyzing...' : 'Analyze Frame'}
                    </button>
                </div>

                {/* Right Panel: Results */}
                <div className="bg-white dark:bg-gray-700/50 rounded-md p-3 overflow-y-auto">
                    <h4 className="font-semibold mb-2">Analysis Result:</h4>
                    {error && <div className="p-2 bg-red-200 text-red-800 rounded text-sm">{error}</div>}
                    {result ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: result.replace(/\n/g, '<br/>') }} />
                    ) : (
                         <div className="text-gray-500">AI analysis will be displayed here.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoAnalyzer;