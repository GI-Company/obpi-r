import React, { useState, FormEvent } from 'react';
import { useOS } from '../contexts/OSContext';
import WebGLBackground from './WebGLBackground';

const LoginScreen: React.FC = () => {
    const { login, wallpaper } = useOS();
    const [username, setUsername] = useState('guest');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!username) {
            setError('Username is required.');
            return;
        }
        setIsLoading(true);
        setError('');
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const success = await login(username, password);
        if (!success) {
            setError('Login failed. Please check your username and password.');
            setIsLoading(false);
        }
        // On success, the App component will handle the re-render.
    };

    return (
        <main className="w-screen h-screen overflow-hidden dark">
            <div 
                className="absolute inset-0 bg-cover bg-center transition-all duration-500"
                style={{ backgroundImage: `url(${wallpaper})` }}
            />
            <WebGLBackground />
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center animate-fade-in-fast">
                <div className="w-80 p-8 bg-glass-dark/80 backdrop-blur-xl border border-glass-border-dark rounded-2xl shadow-lg text-white text-center">
                    <img
                        src="https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png"
                        alt="User Avatar"
                        className="w-24 h-24 rounded-full mx-auto mb-4 border-2 border-white/50"
                    />
                    <h2 className="text-xl font-semibold mb-4">Welcome</h2>
                    <form onSubmit={handleSubmit}>
                         <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            className="w-full px-3 py-2 mb-3 bg-black/30 rounded-lg border border-white/20 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-obpi-accent"
                            autoFocus
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password (optional for guest)"
                            className="w-full px-3 py-2 mb-4 bg-black/30 rounded-lg border border-white/20 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-obpi-accent"
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2 bg-obpi-accent hover:bg-obpi-accent-darker rounded-lg font-semibold transition-all disabled:bg-gray-500 disabled:cursor-wait"
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </form>
                    {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
                </div>
                <div className="absolute bottom-4 text-white/50 text-xs">
                    OBPI React Desktop Environment
                </div>
            </div>
        </main>
    );
};

export default LoginScreen;