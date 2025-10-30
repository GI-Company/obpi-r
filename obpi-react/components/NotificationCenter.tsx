
import React from 'react';
import { useOS } from '../contexts/OSContext';

const NotificationCenter: React.FC = () => {
  const { notifications } = useOS();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-5 right-5 z-[19000] space-y-3">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className="w-80 max-w-sm p-4 bg-glass-light dark:bg-glass-dark backdrop-blur-xl border border-glass-border-light dark:border-glass-border-dark rounded-lg shadow-lg animate-fade-in-fast"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 text-2xl mr-3">{notification.icon}</div>
            <div className="flex-grow">
              <p className="font-bold text-gray-900 dark:text-gray-100">{notification.title}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{notification.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationCenter;
