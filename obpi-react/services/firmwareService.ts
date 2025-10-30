
import { VirtualDevice, BiosSettings } from '../types';
import { LOCAL_STORAGE_KEYS, DEFAULT_BIOS_SETTINGS } from '../constants';

export class FirmwareService {
    private devices: VirtualDevice[] = [];
    private biosSettings: BiosSettings = DEFAULT_BIOS_SETTINGS;

    constructor() {
        this.loadBiosSettings();
    }

    private loadBiosSettings(): void {
        try {
            const settingsJson = localStorage.getItem(LOCAL_STORAGE_KEYS.BIOS_SETTINGS);
            if (settingsJson) {
                this.biosSettings = { ...DEFAULT_BIOS_SETTINGS, ...JSON.parse(settingsJson) };
            } else {
                this.biosSettings = DEFAULT_BIOS_SETTINGS;
            }
        } catch {
            this.biosSettings = DEFAULT_BIOS_SETTINGS;
        }
    }

    public probeDevices(): void {
        this.loadBiosSettings(); // Re-load settings on every probe
        this.devices = [];

        // Probe for Graphics Processor (vGPU) via WebGL
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                this.devices.push({
                    id: 'vgpu_0',
                    name: 'WebGL Graphics Adapter',
                    type: 'GPU',
                    status: 'OK',
                    driverVersion: '1.0.0-webgl'
                });
            } else {
                 throw new Error('WebGL context not available.');
            }
        } catch(e) {
            this.devices.push({
                id: 'vgpu_0',
                name: 'Standard Graphics Adapter',
                type: 'GPU',
                status: 'Error',
                driverVersion: '0.0.0'
            });
        }
        
        // Probe for Audio Chipset via AudioContext
        if (!this.biosSettings.virtualAudio) {
            this.devices.push({ id: 'vaudio_0', name: 'WebAudio Chipset', type: 'Audio', status: 'Disabled', driverVersion: 'N/A' });
        } else {
            try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContext) {
                     this.devices.push({
                        id: 'vaudio_0',
                        name: 'WebAudio Chipset',
                        type: 'Audio',
                        status: 'OK',
                        driverVersion: '2.1.0-webaudio'
                    });
                } else {
                    throw new Error('AudioContext not available.');
                }
            } catch(e) {
                 this.devices.push({
                    id: 'vaudio_0',
                    name: 'Generic Audio Device',
                    type: 'Audio',
                    status: 'Error',
                    driverVersion: '0.0.0'
                });
            }
        }
        
        // Probe for Network Interface Card (vNIC) via navigator.onLine
        if (!this.biosSettings.virtualNetwork) {
            this.devices.push({ id: 'vnic_0', name: 'Browser Network Interface', type: 'Network', status: 'Disabled', driverVersion: 'N/A' });
        } else {
            this.devices.push({
                id: 'vnic_0',
                name: 'Browser Network Interface',
                type: 'Network',
                status: navigator.onLine ? 'OK' : 'Disabled',
                driverVersion: '3.0.0-nav'
            });
        }

        // Probe for Storage Controller via localStorage
         try {
            localStorage.setItem('__test__', '__test__');
            localStorage.removeItem('__test__');
            this.devices.push({
                id: 'vstorage_0',
                name: 'LocalStorage Controller',
                type: 'Storage',
                status: 'OK',
                driverVersion: '1.2.0-ls'
            });
        } catch(e) {
             this.devices.push({
                id: 'vstorage_0',
                name: 'LocalStorage Controller',
                type: 'Storage',
                status: 'Error',
                driverVersion: '0.0.0'
            });
        }
    }

    public getDevices(): VirtualDevice[] {
        return this.devices;
    }
}