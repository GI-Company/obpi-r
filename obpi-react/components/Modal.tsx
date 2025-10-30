
import React from 'react';
import { useOS } from '../contexts/OSContext';

const Modal: React.FC = () => {
  const { modal, hideModal } = useOS();

  if (!modal.isOpen) return null;

  const getButtonClass = (type?: 'primary' | 'secondary' | 'danger') => {
    switch (type) {
      case 'primary':
        return 'bg-obpi-accent hover:bg-obpi-accent-darker text-white';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'secondary':
      default:
        return 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[15000]">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full text-gray-800 dark:text-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">{modal.title}</h3>
          <button onClick={hideModal} className="text-2xl hover:text-red-500">&times;</button>
        </div>
        <div className="mb-6">{modal.content}</div>
        <div className="flex justify-end space-x-3">
          {modal.actions.map((action, index) => (
            <button
              key={index}
              className={`px-4 py-2 rounded-md text-sm font-medium ${getButtonClass(action.type)}`}
              onClick={() => {
                action.onClick();
                hideModal();
              }}
            >
              {action.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Modal;
