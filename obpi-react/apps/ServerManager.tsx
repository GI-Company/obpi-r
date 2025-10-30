
import React from 'react';
import { useOS } from '../contexts/OSContext';

const ServerManager: React.FC = () => {
  const { apiStatus, apiService } = useOS();

  const handleToggle = () => {
      if (apiStatus === 'connected') {
          apiService.disconnect();
      } else {
          apiService.connect();
      }
  };
  
  const getStatusColor = () => {
      switch(apiStatus) {
          case 'connected': return 'bg-green-500 animate-pulse';
          case 'connecting': return 'bg-yellow-500 animate-pulse';
          case 'error': return 'bg-red-500';
          default: return 'bg-gray-500';
      }
  }

  return (
    <div className="p-4 h-full flex flex-col justify-center items-center gap-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
      <h3 className="text-lg font-semibold">Cloud Kernel Connection</h3>
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full ${getStatusColor()}`}></div>
        <span className="font-mono text-sm">{apiStatus.toUpperCase()}</span>
      </div>
      <div className="text-center text-xs text-gray-600 dark:text-gray-400">
        <p>This service manages the WebSocket connection to the remote backend environment.</p>
        <p className="mt-2">
            Status: {apiStatus === 'connected' ? 'Live connection to server.' : 'No connection to server.'}
        </p>
      </div>
      <button
        onClick={handleToggle}
        className={`px-6 py-2 rounded-md font-semibold text-white ${apiStatus === 'connected' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
        disabled={apiStatus === 'connecting'}
      >
        {apiStatus === 'connected' ? 'Disconnect' : 'Connect'}
      </button>
       <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
        All terminal commands and file system operations are now routed through this connection.
      </p>
    </div>
  );
};

export default ServerManager;
