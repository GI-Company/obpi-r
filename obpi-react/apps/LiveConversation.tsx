
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAI_Blob } from '@google/genai';
import React, { useState, useRef, useEffect, useCallback } from 'react';

// --- Audio Utility Functions ---
function encode(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


const LiveConversation: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [transcriptions, setTranscriptions] = useState<{user: string, model: string}[]>([]);
    const [currentTranscription, setCurrentTranscription] = useState({user: '', model: ''});
    
    // FIX: The 'LiveSession' type is not exported from @google/genai. Using 'any' as a workaround.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRefs = useRef<{ input: AudioContext | null, output: AudioContext | null }>({ input: null, output: null });
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const connect = useCallback(async () => {
        setStatus('connecting');
        if (!process.env.API_KEY) {
            setStatus('error');
            console.error('API key not found');
            return;
        }
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        audioContextRefs.current.input = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRefs.current.output = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const outputNode = audioContextRefs.current.output.createGain();
        outputNode.connect(audioContextRefs.current.output.destination);

        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: async () => {
                    setStatus('connected');
                    streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const source = audioContextRefs.current.input!.createMediaStreamSource(streamRef.current);
                    scriptProcessorRef.current = audioContextRefs.current.input!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current.onaudioprocess = (event) => {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const int16 = new Int16Array(inputData.length);
                        for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                        const pcmBlob: GenAI_Blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                        sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
                    };
                    source.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(audioContextRefs.current.input!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                     if (message.serverContent?.inputTranscription) {
                        setCurrentTranscription(prev => ({...prev, user: prev.user + message.serverContent!.inputTranscription!.text}));
                     }
                     if (message.serverContent?.outputTranscription) {
                        setCurrentTranscription(prev => ({...prev, model: prev.model + message.serverContent!.outputTranscription!.text}));
                     }
                     if (message.serverContent?.turnComplete) {
                         setTranscriptions(prev => [...prev, currentTranscription]);
                         setCurrentTranscription({user: '', model: ''});
                     }

                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                    if (audioData && audioContextRefs.current.output) {
                        const ctx = audioContextRefs.current.output;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                        const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                        const source = ctx.createBufferSource();
                        source.buffer = buffer;
                        source.connect(outputNode);
                        source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += buffer.duration;
                        audioSourcesRef.current.add(source);
                    }
                    if (message.serverContent?.interrupted) {
                        for (const source of audioSourcesRef.current.values()) source.stop();
                        audioSourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
                    }
                },
                onerror: (e: ErrorEvent) => { setStatus('error'); console.error('LiveSession error:', e); },
                onclose: () => { setStatus('idle'); },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                inputAudioTranscription: {},
                outputAudioTranscription: {}
            },
        });
    }, [currentTranscription]);

    const disconnect = useCallback(() => {
        sessionPromiseRef.current?.then(session => session.close());
        streamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        audioContextRefs.current.input?.close();
        audioContextRefs.current.output?.close();
        sessionPromiseRef.current = null;
        setStatus('idle');
    }, []);

    useEffect(() => {
        return () => { disconnect(); };
    }, [disconnect]);

    return (
        <div className="p-4 flex flex-col h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <div className="flex-shrink-0 flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Live Conversation</h3>
                <div className={`text-sm font-mono p-1 rounded ${status === 'connected' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>{status}</div>
            </div>
            <div className="flex-grow bg-white dark:bg-gray-900 rounded-md p-2 overflow-y-auto text-sm space-y-2">
                {transcriptions.map((t, i) => (
                    <div key={i}>
                        <p><strong className="text-blue-500">You:</strong> {t.user}</p>
                        <p><strong className="text-purple-500">Gemini:</strong> {t.model}</p>
                    </div>
                ))}
                {currentTranscription.user && <p><strong className="text-blue-500">You:</strong> {currentTranscription.user}</p>}
                {currentTranscription.model && <p><strong className="text-purple-500">Gemini:</strong> {currentTranscription.model}</p>}
            </div>
            <div className="flex-shrink-0 pt-4">
                <button
                    onClick={status === 'connected' ? disconnect : connect}
                    className={`w-full py-2 rounded text-white font-bold ${status === 'connected' ? 'bg-red-500' : 'bg-green-500'}`}
                >
                    {status === 'connected' ? 'Disconnect' : 'Start Conversation'}
                </button>
            </div>
        </div>
    );
};

export default LiveConversation;
