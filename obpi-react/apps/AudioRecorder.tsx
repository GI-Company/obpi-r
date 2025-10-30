import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';

const AudioRecorder: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = handleStopRecording;
            audioChunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setTranscription('');
            setError('');
        } catch (err) {
            setError('Could not access microphone. Please grant permission.');
            console.error('Error accessing microphone:', err);
        }
    };

    const handleStopRecording = async () => {
        if (mediaRecorderRef.current) {
            setIsRecording(false);
            setIsLoading(true);

            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];
                try {
                    const result = await transcribeAudio({ data: base64Audio, mimeType: 'audio/webm' });
                    setTranscription(result);
                } catch (e) {
                    setError(e instanceof Error ? e.message : 'Transcription failed.');
                } finally {
                    setIsLoading(false);
                }
            };
        }
    };
    
    const toggleRecording = () => {
        if(isRecording && mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
        } else {
            handleStartRecording();
        }
    };

    return (
        <div className="p-4 h-full flex flex-col items-center justify-center gap-4 bg-gray-100 dark:bg-gray-800">
            <h3 className="text-lg font-semibold">Audio Transcription</h3>
            <button
                onClick={toggleRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-4xl ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}
            >
                {isRecording ? '■' : '⏺️'}
            </button>
            <div className="w-full p-2 min-h-[80px] bg-white dark:bg-gray-700 rounded-md text-sm">
                {isLoading && <p>Transcribing...</p>}
                {error && <p className="text-red-500">{error}</p>}
                <p>{transcription}</p>
            </div>
        </div>
    );
};

export default AudioRecorder;
