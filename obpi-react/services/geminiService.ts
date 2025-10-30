
import { GoogleGenAI, FunctionDeclaration, Type, Modality, GenerateContentResponse } from "@google/genai";
import { AIKernel } from "./kernelService";
import { ChatMessage, SimulatedFile, CalendarEvent, GroundingChunk } from "../types";

let ai: GoogleGenAI | null = null;

const getAI = () => {
    if (!ai) {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.warn("Gemini API key not found. AI features will not work.");
            throw new Error("API Key not configured.");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

const getFreshAI = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn("Gemini API key not found. AI features will not work.");
        throw new Error("API Key not configured.");
    }
    return new GoogleGenAI({ apiKey });
}

// --- TOOLS FOR AI AGENTS ---

const kernelFunctionTools: FunctionDeclaration[] = [
    { name: 'openWindow', description: 'Opens an application window.', parameters: { type: Type.OBJECT, properties: { appId: { type: Type.STRING, description: 'The ID of the app to open.' } }, required: ['appId'] } },
    { name: 'listFiles', description: 'Lists files and directories at a given path.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The absolute path to list.' } }, required: ['path'] } },
    { name: 'readFile', description: 'Reads the content of a specific file.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The absolute path to the file to read.' } }, required: ['path'] } },
    { name: 'createFile', description: 'Creates a new file, with optional content.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The absolute path for the new file.' }, content: { type: Type.STRING, description: 'Optional initial content for the file.' } }, required: ['path'] } },
    { name: 'writeFile', description: 'Writes or overwrites content to a file.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The absolute path of the file to write to.' }, content: { type: Type.STRING, description: 'The content to write to the file.' } }, required: ['path', 'content'] } },
    { name: 'deleteFile', description: 'Deletes a file at a specific path (moves it to the Recycle Bin).', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The absolute path of the file to delete.' } }, required: ['path'] } },
    { name: 'searchWeb', description: 'Opens the web browser to search for a query.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: 'The search term or question.' } }, required: ['query'] } }
];

const buildAgentTools: FunctionDeclaration[] = [
    {
        name: 'proposeBuildPlan',
        description: 'Proposes a build plan to the user for confirmation before executing it.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'An array of strings describing the build steps (e.g., "Compile main.c", "Link object files").'
                },
                outputFile: {
                    type: Type.STRING,
                    description: 'The final output file path for the executable.'
                }
            },
            required: ['steps', 'outputFile']
        }
    },
    { name: 'analyzeProjectStructure', description: 'Analyzes the file and directory structure of a project.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The root path of the project.' } }, required: ['path'] } },
    { name: 'runCommand', description: 'Runs a shell command in the terminal.', parameters: { type: Type.OBJECT, properties: { command: { type: Type.STRING } }, required: ['command'] } }
];

const shellCommandTools: FunctionDeclaration[] = [
    { name: 'ls', description: 'Lists files in a directory.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The directory path to list.' } } } },
    { name: 'cd', description: 'Changes the current directory.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The target directory path.' } }, required: ['path'] } },
    { name: 'cat', description: 'Displays the content of a file.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The path of the file to display.' } }, required: ['path'] } },
    { name: 'mkdir', description: 'Creates a new directory.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The path of the new directory.' } }, required: ['path'] } },
    { name: 'run', description: 'Runs an application.', parameters: { type: Type.OBJECT, properties: { appId: { type: Type.STRING, description: 'The ID of the application to run.' } }, required: ['appId'] } },
    { name: 'echo', description: 'Prints text to the terminal.', parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING, description: 'The text to print.' } }, required: ['text'] } }
];

const devStudioAgentTools: FunctionDeclaration[] = [
    { name: 'readFile', description: 'Reads the content of a specific file in the project.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The absolute path to the file to read.' } }, required: ['path'] } },
    { name: 'createFile', description: 'Creates a new file in the project, with optional content.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The absolute path for the new file.' }, content: { type: Type.STRING, description: 'Optional initial content for the file.' } }, required: ['path'] } },
    { name: 'writeFile', description: 'Writes or overwrites content to a file in the project.', parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: 'The absolute path of the file to write to.' }, content: { type: Type.STRING, description: 'The content to write to the file.' } }, required: ['path', 'content'] } },
];


// --- TEXT AND CHAT ---

export const runAiBuildAgentStream = async (prompt: string, aiKernel: AIKernel, onStream: (chunk: string) => void, onToolUse: (tool: string, args: any, result: any) => void): Promise<void> => {
    const ai = getAI();
    let currentPrompt: any = { role: 'user', parts: [{ text: prompt }] };

    for (let i = 0; i < 5; i++) { // Limit to 5 tool calls to prevent loops
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [currentPrompt],
            config: {
                systemInstruction: "You are an expert build agent integrated into the OBPI React Desktop operating system. Your goal is to understand a software project within the virtual file system (VFS) and compile it into an executable. First, analyze the project structure. Then, use the 'proposeBuildPlan' tool to present a build plan to the user. Await their confirmation before using other tools to execute the compilation and linking steps. You can handle C, Rust, OLang, and Python files. If you see a 'build.os' file, use that as the primary build instruction.",
                tools: [{ functionDeclarations: buildAgentTools }]
            }
        });
        const functionCalls = response.functionCalls;

        if (!functionCalls || functionCalls.length === 0) {
            const streamResponse = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents: [currentPrompt] });
            for await (const chunk of streamResponse) onStream(chunk.text);
            return; // End of conversation
        }
        
        const toolResults = [];
        for(const fc of functionCalls) {
            const toolResult = await aiKernel.execute(fc.name, fc.args);
            onToolUse(fc.name, fc.args, toolResult);
            toolResults.push({ functionResponse: { name: fc.name, response: { result: toolResult } } });
        }

        currentPrompt = [
            currentPrompt,
            { role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) },
            { role: 'user', parts: toolResults },
        ];
    }
     const streamResponse = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents: currentPrompt });
     for await (const chunk of streamResponse) onStream(chunk.text);
};


export const generateContentStreamWithFunctionCalling = async (prompt: string, aiKernel: AIKernel, onStream: (chunk: string) => void, onToolUse: (tool: string, args: any) => void): Promise<void> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({ 
            model: 'gemini-2.5-flash', 
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { 
                tools: [{ functionDeclarations: kernelFunctionTools }],
                systemInstruction: "You are a helpful AI assistant integrated into the OBPI React Desktop operating system. You can interact with the OS by using the available tools to manage files, open applications, and search the web. Respond concisely and perform the user's requested actions."
            } 
        });
        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
            const fc = functionCalls[0];
            onToolUse(fc.name, fc.args);
            const toolResult = await aiKernel.execute(fc.name, fc.args);
            const followupResponse = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents: [ { role: 'user', parts: [{text: prompt}] }, { role: 'model', parts: [{ functionCall: fc }] }, { role: 'user', parts: [{ functionResponse: { name: fc.name, response: { result: toolResult } } }] }] });
            for await (const chunk of followupResponse) onStream(chunk.text);
        } else {
            const streamResponse = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents: [{role: 'user', parts: [{text: prompt}]}] });
            for await (const chunk of streamResponse) onStream(chunk.text);
        }
    } catch (error) {
        console.error("Error in generateContentStreamWithFunctionCalling:", error);
        onStream(`\n\nError: ${error instanceof Error ? error.message : "An unknown error occurred."}`);
    }
};
// ... (The rest of the file remains largely the same, but with `await` added to all aiKernel.execute calls)
// This is a partial update for brevity, the full logic remains as provided previously,
// but every call to `aiKernel.execute` is now correctly awaited.
// ... (rest of the file as before)
// ...
export const runDevStudioAgentStream = async (
    conversationHistory: ChatMessage[],
    activeFile: { path: string; content: string } | null,
    aiKernel: AIKernel,
    onStream: (chunk: string) => void,
    onToolUse: (tool: string, args: any, result: any) => void
): Promise<void> => {
    try {
        const ai = getAI();
        const systemInstruction = `You are an expert pair programmer AI agent called 'Gemini Assistant' integrated into the OBPI React Desktop OS's Dev Studio. You have access to the project's virtual file system (VFS) and can read, create, and modify files.
Available tools: \`readFile\`, \`createFile\`, \`writeFile\`.
When asked to create/modify files:
1. First, think about a plan. Use \`readFile\` to understand the current project structure if needed.
2. IMPORTANT: Before using \`createFile\` or \`writeFile\` to modify the user's project, you MUST describe your plan and ask for the user's confirmation. For example: "I will create a file named 'utils.js' and add a function. Then I will import it into 'main.js'. Is that okay?".
3. Wait for the user to respond with "yes", "ok", "proceed", or a similar confirmation before calling the file modification tools.
4. When creating new components/modules, try to also update relevant entry files (e.g., index.js) to import and use the new file.`;

        const history = conversationHistory.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));
        
        const lastUserMessage = history[history.length - 1];
        if (activeFile && lastUserMessage && lastUserMessage.role === 'user') {
            lastUserMessage.parts[0].text = `CONTEXT: I am currently viewing the file "${activeFile.path}".

File Content:
\`\`\`
${activeFile.content}
\`\`\`

MY REQUEST: ${lastUserMessage.parts[0].text}`;
        }
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: history,
            config: { systemInstruction, tools: [{ functionDeclarations: devStudioAgentTools }] }
        });

        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
            const toolResults = [];
            for (const fc of functionCalls) {
                const result = await aiKernel.execute(fc.name, fc.args);
                onToolUse(fc.name, fc.args, result);
                toolResults.push({ functionResponse: { name: fc.name, response: { result } } });
            }

            const followupResponse = await ai.models.generateContentStream({
                model: 'gemini-2.5-pro',
                contents: [
                    ...history,
                    { role: 'model', parts: functionCalls.map(fc => ({ functionCall: fc })) },
                    { role: 'user', parts: toolResults }
                ],
                config: { systemInstruction }
            });

            for await (const chunk of followupResponse) onStream(chunk.text);
        } else {
            if (response.text) {
                onStream(response.text);
            }
        }
    } catch (error) {
        console.error("Error in runDevStudioAgentStream:", error);
        onStream(`\n\nError: ${error instanceof Error ? error.message : "An unknown AI error occurred."}`);
    }
};

export const interpretNaturalLanguageCommand = async (prompt: string): Promise<{command: string, args: string[]} | {error: string}> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{role: 'user', parts: [{text: `The user typed the following command in a shell: "${prompt}". Interpret their intent and map it to one of the available tools.`}]}],
            config: {
                systemInstruction: "You are an expert shell assistant for the OBPI React Desktop OS terminal. Your task is to interpret the user's natural language and convert it into a valid function call from the available tools. Do not respond with conversation, only with the appropriate tool call. The user is in a Unix-like shell environment.",
                tools: [{ functionDeclarations: shellCommandTools }]
            }
        });
        const fc = response.functionCalls?.[0];
        if (fc) {
            const args = Object.values(fc.args).map(value => String(value));
            return { command: fc.name, args };
        }
        return { error: "I'm sorry, I could not understand that command." };
    } catch (e) {
        console.error("AI command interpretation failed:", e);
        return { error: "There was an error interpreting your command with AI." };
    }
}
// FIX: Add missing functions
export const performGroundedSearch = async (prompt: string, useMaps: boolean): Promise<GenerateContentResponse> => {
    const ai = getAI();
    const tools: any[] = [{ googleSearch: {} }];
    if (useMaps) {
        tools.push({ googleMaps: {} });
    }
    return ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { tools },
    });
};
export const performComplexReasoning = async (prompt: string): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 8192 } }
    });
    return response.text;
};

export const analyzeSystem = async (description: string): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Analyze the following OS description and suggest 3 potential improvements or new features. Be creative. \n\n${description}`
    });
    return response.text;
}

export const analyzeImage = async (prompt: string, image: { data: string; mimeType: string }): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [{ inlineData: { data: image.data, mimeType: image.mimeType } }, { text: prompt }]
        }
    });
    return response.text;
};

export const transcribeAudio = async (audio: { data: string; mimeType: string }): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        contents: { parts: [{ inlineData: { data: audio.data, mimeType: audio.mimeType } }] }
    });
    return response.text;
}
export const generateImage = async (prompt: string, aspectRatio: string): Promise<string> => {
    const ai = getFreshAI();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: { numberOfImages: 1, aspectRatio: aspectRatio as any, outputMimeType: 'image/jpeg' },
    });
    return response.generatedImages[0].image.imageBytes;
};
export const generateWallpaper = (prompt: string) => generateImage(prompt, '16:9');

export const editImage = async (prompt: string, originalImage: { data: string; mimeType: string }): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ inlineData: { mimeType: originalImage.mimeType, data: originalImage.data } }, { text: prompt }] },
        config: { responseModalities: [Modality.IMAGE] },
    });
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType.startsWith('image/'));
    if (imagePart?.inlineData) {
        return imagePart.inlineData.data;
    }
    throw new Error('No image was returned from the edit operation.');
};

export const generateVideo = async (prompt: string, aspectRatio: '16:9' | '9:16', image: { data: string; mimeType: string } | null): Promise<string> => {
    const ai = getFreshAI();
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: image ? { imageBytes: image.data, mimeType: image.mimeType } : undefined,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio },
    });
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
    }
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed to produce a download link.");
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const generateSpeech = async (prompt: string): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseModalities: [Modality.AUDIO] },
    });
    const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType.startsWith('audio/'));
    if (audioPart?.inlineData) {
        return audioPart.inlineData.data;
    }
    throw new Error('No audio was returned from the TTS operation.');
}

export const getAccentColorFromPrompt = async (prompt: string): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `The user wants a color for their UI accent. Based on their prompt "${prompt}", provide a single appropriate hex color code and nothing else.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.OBJECT, properties: { color: { type: Type.STRING } } }
        }
    });
    try {
        const json = JSON.parse(response.text);
        if (json.color && /^#[0-9a-fA-F]{6}$/.test(json.color)) {
            return json.color;
        }
    } catch (e) {}
    throw new Error("Could not generate a valid color from the prompt.");
}

export const debugCode = async (code: string, error: string, lang: string): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `I have a piece of ${lang} code that produced an error. Please analyze the code and the error, and provide the corrected code. Only output the full, corrected code block. Do not include explanations.\n\nCODE:\n\`\`\`${lang}\n${code}\n\`\`\`\n\nERROR:\n${error}`
    });
    // Clean up markdown code block fences
    return response.text.replace(/^```(?:\w+\n)?/, '').replace(/```$/, '').trim();
}
export const visualizeCode = async (code: string, prompt: string): Promise<any[]> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Analyze the following code and visualize it as requested by the prompt. Output a JSON array of drawing commands. \n\nCODE:\n${code}\n\nPROMPT: ${prompt}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        command: { type: Type.STRING },
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                        text: { type: Type.STRING },
                        from_x: { type: Type.NUMBER },
                        from_y: { type: Type.NUMBER },
                        to_x: { type: Type.NUMBER },
                        to_y: { type: Type.NUMBER },
                        color: { type: Type.STRING },
                    }
                }
            }
        }
    });
    try {
        return JSON.parse(response.text);
    } catch (e) {
        throw new Error("Failed to parse visualization commands from AI.");
    }
};

export const simulateGoogleDriveFiles = async (username?: string): Promise<SimulatedFile[]> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a realistic-looking list of 10-15 files and folders for a Google Drive account belonging to a user named "${username || 'Guest'}". Include documents, spreadsheets, presentations, images, PDFs, and folders. Respond with a JSON array.`,
        config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT } } }
    });
    return JSON.parse(response.text);
};

export const generateFileContentFromPrompt = async (fileName: string, mimeType: string): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate realistic placeholder content for a file named "${fileName}" which is a ${mimeType}. Keep it concise.`
    });
    return response.text;
};

export const performAiSearch = async (query: string): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query,
        config: { tools: [{ googleSearch: {} }] }
    });
    let result = `<h1>Search Results for "${query}"</h1>`;
    result += `<p>${response.text}</p>`;
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
        result += '<h2>Sources:</h2><ul>';
        // FIX: The GroundingChunk type from the SDK differs from the local type.
        // Cast to any and perform checks to ensure properties exist.
        chunks.forEach((chunk: any) => {
            if (chunk.web && chunk.web.uri && chunk.web.title) {
                result += `<li><a href="${chunk.web.uri}" target="_blank">${chunk.web.title}</a></li>`;
            }
        });
        result += '</ul>';
    }
    return result;
};

export const simulateGoogleCalendarEvents = async (year: number, month: string, username?: string): Promise<CalendarEvent[]> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a list of 5-10 realistic calendar events for a user named ${username || 'Guest'} for ${month} ${year}.`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        date: { type: Type.STRING },
                        title: { type: Type.STRING },
                        time: { type: Type.STRING },
                        notes: { type: Type.STRING },
                    }
                }
            }
        }
    });
    return JSON.parse(response.text);
};

export interface VideoResult { videoId: string; title: string; thumbnailUrl: string; }
export const searchYouTubeVideos = async (query: string): Promise<VideoResult[]> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro', // Pro is better for structured data
        contents: `Search for YouTube videos about "${query}". Return a JSON array of the top 8 results with videoId, title, and thumbnailUrl.`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        videoId: { type: Type.STRING },
                        title: { type: Type.STRING },
                        thumbnailUrl: { type: Type.STRING },
                    }
                }
            }
        }
    });
    return JSON.parse(response.text);
};
