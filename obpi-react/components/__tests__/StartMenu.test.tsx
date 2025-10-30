import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StartMenu from '../StartMenu';
import { useOS } from '../../contexts/OSContext';
import { User } from '../../types';

// Mock the useOS hook and other external dependencies to isolate the component
jest.mock('../../contexts/OSContext');
jest.mock('../../constants', () => ({
    ...jest.requireActual('../../constants'),
    APPS: [{ id: 'terminal', name: 'Terminal', icon: '🖥️', component: () => <div /> }]
}));

const mockUseOS = useOS as jest.Mock;

describe('StartMenu Session Management', () => {
    const mockLock = jest.fn();
    const mockLogout = jest.fn();
    const mockCloseMenu = jest.fn();
    const mockCurrentUser: User = {
        id: 'user-guest',
        username: 'guest',
        role: 'Admin',
        avatar: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png'
    };

    beforeEach(() => {
        // Reset mocks before each test to ensure isolation
        jest.clearAllMocks();

        // Provide a standard mock return value for the useOS hook
        mockUseOS.mockReturnValue({
            openWindow: jest.fn(),
            currentUser: mockCurrentUser,
            lock: mockLock,
            logout: mockLogout,
        });
    });

    it('should call the lock function when the lock button is clicked', () => {
        render(<StartMenu isOpen={true} closeMenu={mockCloseMenu} />);
        
        const lockButton = screen.getByTitle('Lock Session');
        fireEvent.click(lockButton);
        
        expect(mockLock).toHaveBeenCalledTimes(1);
        expect(mockLogout).not.toHaveBeenCalled();
    });

    it('should call the logout function when the logout button is clicked', () => {
        render(<StartMenu isOpen={true} closeMenu={mockCloseMenu} />);
        
        const logoutButton = screen.getByTitle('Logout');
        fireEvent.click(logoutButton);
        
        expect(mockLogout).toHaveBeenCalledTimes(1);
        expect(mockLock).not.toHaveBeenCalled();
    });

    it('should render user information and session controls correctly', () => {
        render(<StartMenu isOpen={true} closeMenu={mockCloseMenu} />);

        expect(screen.getByText('guest')).toBeInTheDocument();
        expect(screen.getByTitle('Lock Session')).toBeVisible();
        expect(screen.getByTitle('Logout')).toBeVisible();
    });

    it('should not render session controls if there is no current user', () => {
        // Override the mock for this specific test
        mockUseOS.mockReturnValue({
            ...mockUseOS(),
            currentUser: null,
        });

        render(<StartMenu isOpen={true} closeMenu={mockCloseMenu} />);

        expect(screen.queryByText('guest')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Lock Session')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Logout')).not.toBeInTheDocument();
    });

    it('should not render if isOpen prop is false', () => {
        render(<StartMenu isOpen={false} closeMenu={mockCloseMenu} />);
        expect(screen.queryByTestId('start-menu-backdrop')).not.toBeInTheDocument();
    });
});