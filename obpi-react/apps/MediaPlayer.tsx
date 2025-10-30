
import React, { useState, useEffect } from 'react';
import { useOS } from '../contexts/OSContext';

interface MediaPlayerProps {
    filePath: string;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ filePath }) => {
    const { readFile } = useOS();
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'audio' | 'video' | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadMedia = async () => {
            const fileContent = await readFile(filePath);
            if (fileContent instanceof Uint8Array) {
                const extension = filePath.split('.').pop()?.toLowerCase();
                let mimeType = '';
                if (['mp4', 'webm'].includes(extension || '')) {
                    setMediaType('video');
                    mimeType = `video/${extension}`;
                } else if (['mp3', 'wav', 'ogg'].includes(extension || '')) {
                    setMediaType('audio');
                    mimeType = `audio/${extension}`;
                } else {
                    setError('Unsupported media format.');
                    return;
                }

                const blob = new Blob([fileContent], { type: mimeType });
                const url = URL.createObjectURL(blob);
                setMediaUrl(url);

                return () => {
                    URL.revokeObjectURL(url);
                };
            } else {
                setError(`Could not read or decode file: ${filePath}`);
            }
        };

        const cleanupPromise = loadMedia();
        
        return () => {
            cleanupPromise.then(cleanup => cleanup && cleanup());
        };
    }, [filePath, readFile]);

    return (
        <div className="flex flex-col items-center justify-center h-full bg-black text-white p-4">
            {error && <p className="text-red-500">{error}</p>}
            {mediaUrl && mediaType === 'video' && (
                <video src={mediaUrl} controls autoPlay className="max-w-full max-h-full" />
            )}
            {mediaUrl && mediaType === 'audio' && (
                <div className="text-center">
                    <p className="mb-4">Now Playing:</p>
                    <p className="font-mono text-lg mb-8">{filePath.split('/').pop()}</p>
                    <audio src={mediaUrl} controls autoPlay />
                </div>
            )}
        </div>
    );
};

export default MediaPlayer;
