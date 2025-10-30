
import React, { useEffect, useState } from 'react';
import { useOS } from '../contexts/OSContext';
import { VirtualDevice } from '../types';

const DeviceManager: React.FC = () => {
    const { firmwareService } = useOS();
    const [devices, setDevices] = useState<VirtualDevice[]>([]);

    useEffect(() => {
        setDevices(firmwareService.getDevices());
    }, [firmwareService]);

    const getStatusIndicator = (status: VirtualDevice['status']) => {
        switch (status) {
            case 'OK': return <span className="text-green-500">●</span>;
            case 'Error': return <span className="text-red-500">●</span>;
            case 'Disabled': return <span className="text-gray-500">●</span>;
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm">
            <div className="flex-shrink-0 p-2 border-b border-gray-300 dark:border-gray-700">
                <h3 className="font-bold">Device Manager</h3>
            </div>
            <div className="flex-grow overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-200 dark:bg-gray-700/50 sticky top-0">
                        <tr>
                            <th className="p-2 w-8"></th>
                            <th className="p-2">Device Name</th>
                            <th className="p-2">Type</th>
                            <th className="p-2">Driver Version</th>
                        </tr>
                    </thead>
                    <tbody>
                        {devices.map(device => (
                            <tr key={device.id} className="border-b border-gray-200 dark:border-gray-700">
                                <td className="p-2 text-center" title={`Status: ${device.status}`}>
                                    {getStatusIndicator(device.status)}
                                </td>
                                <td className="p-2">{device.name}</td>
                                <td className="p-2">{device.type}</td>
                                <td className="p-2">{device.driverVersion}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {devices.length === 0 && <p className="p-4 text-center text-gray-500">No devices detected.</p>}
            </div>
             <div className="flex-shrink-0 p-1 border-t border-gray-300 dark:border-gray-700 text-xs text-center">
                {devices.length} devices found.
            </div>
        </div>
    );
};

export default DeviceManager;
