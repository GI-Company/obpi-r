
import React, { useEffect, useRef, useState, FC } from 'react';
import { useOS } from '../contexts/OSContext';
import { ContextMenuItem } from '../types';

const MenuItem: FC<{ item: ContextMenuItem; hideRootMenu: () => void }> = ({ item, hideRootMenu }) => {
    const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
    const itemRef = useRef<HTMLDivElement>(null);

    if (item.separator) {
        return <div className="h-px bg-gray-300 dark:bg-gray-700 my-1" />;
    }
    
    if (!item.label) return null;

    const hasSubmenu = item.items && item.items.length > 0;

    return (
        <div
            ref={itemRef}
            className="relative"
            onMouseEnter={() => hasSubmenu && setIsSubmenuOpen(true)}
            onMouseLeave={() => hasSubmenu && setIsSubmenuOpen(false)}
        >
            <div
                className={`flex items-center justify-between gap-3 px-3 py-1.5 text-sm rounded ${item.disabled ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'text-gray-800 dark:text-gray-200 hover:bg-obpi-accent hover:text-white cursor-pointer'}`}
                onClick={() => {
                    if (item.disabled) return;
                    item.action?.();
                    hideRootMenu();
                }}
            >
                <div className="flex items-center gap-3">
                    <span className="w-4 text-center">{item.icon}</span>
                    <span>{item.label}</span>
                </div>
                {hasSubmenu && <span className="text-xs">▶</span>}
            </div>
            {isSubmenuOpen && hasSubmenu && (
                <SubMenu items={item.items} parentRef={itemRef} hideRootMenu={hideRootMenu} />
            )}
        </div>
    );
};

const SubMenu: FC<{ items: ContextMenuItem[]; parentRef: React.RefObject<HTMLDivElement>; hideRootMenu: () => void; }> = ({ items, parentRef, hideRootMenu }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (parentRef.current && menuRef.current) {
            const parentRect = parentRef.current.getBoundingClientRect();
            const menuRect = menuRef.current.getBoundingClientRect();
            
            let top = parentRect.top;
            let left = parentRect.right;
            
            if (left + menuRect.width > window.innerWidth) {
                left = parentRect.left - menuRect.width;
            }
            if (top + menuRect.height > window.innerHeight) {
                top = window.innerHeight - menuRect.height;
            }

            setPosition({ top, left });
        }
    }, [parentRef]);

    return (
        <div
            ref={menuRef}
            className="fixed z-[20001] bg-gray-200 dark:bg-gray-800 border border-gray-400 dark:border-gray-600 rounded-md shadow-xl min-w-[180px] p-1 animate-fade-in-fast"
            style={{ top: position.top, left: position.left }}
        >
            {items.map((subItem, index) => (
                <MenuItem key={index} item={subItem} hideRootMenu={hideRootMenu} />
            ))}
        </div>
    );
};


const ContextMenu: React.FC = () => {
    const { contextMenu, hideContextMenu } = useOS();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!contextMenu.isOpen) return;

        const menu = menuRef.current;
        if (!menu) return;

        // Adjust position to stay within viewport
        const { innerWidth, innerHeight } = window;
        const { offsetWidth, offsetHeight } = menu;
        let { x, y } = contextMenu;

        if (x + offsetWidth > innerWidth) {
            x = innerWidth - offsetWidth;
        }
        if (y + offsetHeight > innerHeight) {
            y = innerHeight - offsetHeight;
        }
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

    }, [contextMenu]);

    if (!contextMenu.isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-[20000] bg-gray-200/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-400 dark:border-gray-600 rounded-md shadow-xl min-w-[180px] p-1 animate-fade-in-fast"
        >
            {contextMenu.items.map((item, index) => (
                <MenuItem key={index} item={item} hideRootMenu={hideContextMenu} />
            ))}
        </div>
    );
};

export default ContextMenu;
