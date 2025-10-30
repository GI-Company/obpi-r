
import React from 'react';

const WelcomeNote: React.FC = () => {
  return (
    <div className="p-4 h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex flex-col justify-center">
      <h2 className="text-2xl font-bold text-obpi-accent mb-3">Welcome to OBPI React!</h2>
      <p className="mb-2">This is a virtual desktop environment built entirely in React and TypeScript.</p>
      <ul className="list-disc list-inside mb-4 space-y-1 text-sm">
        <li>Drag windows by their headers.</li>
        <li>Resize windows from their edges and corners.</li>
        <li>Double-click a desktop icon to open an app.</li>
        <li>Use the Terminal for command-line operations.</li>
        <li>Explore the Gemini-powered AI Assistant.</li>
        <li>Right-click the desktop for more options.</li>
      </ul>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Session started: {new Date().toLocaleString()}
      </p>
    </div>
  );
};

export default WelcomeNote;
