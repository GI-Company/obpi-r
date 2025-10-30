
import React, { useState, useEffect, useMemo } from 'react';
import { useOS } from '../contexts/OSContext';
import { FSNode } from '../types';

interface GalleryProps {
    filePath?: string;
}

const Gallery: React.FC<GalleryProps> = ({ filePath: initialFilePath }) => {
    const { readFile, listDirectory, currentUser, fsRevision } = useOS();
    const [images, setImages] = useState<{ path: string, url: string }[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const picturesPath = `/home/${currentUser?.username || 'guest'}/Pictures`;

    useEffect(() => {
        const imageList: { path: string, url: string }[] = [];
        const supportedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
        
        const traverse = async (path: string) => {
            const children = await listDirectory(path);
            if (!children) return;

            for (const [name, node] of Object.entries(children)) {
                const fullPath = `${path}/${name}`;
                if (node.type === 'dir') {
                    await traverse(fullPath);
                } else if (supportedExtensions.some(ext => name.toLowerCase().endsWith(ext))) {
                    const content = await readFile(fullPath);
                    if (content instanceof Uint8Array) {
                        const blob = new Blob([content]);
                        imageList.push({ path: fullPath, url: URL.createObjectURL(blob) });
                    }
                }
            }
        };
        
        const loadImages = async () => {
            await traverse(picturesPath);
            setImages(imageList);
        }
        
        loadImages();

        return () => {
            imageList.forEach(img => URL.revokeObjectURL(img.url));
        };
    }, [listDirectory, readFile, picturesPath, fsRevision]);

    const imageToView = useMemo(() => {
        if (initialFilePath) {
            const loadImage = async () => {
                const content = await readFile(initialFilePath);
                if (content instanceof Uint8Array) {
                    const blob = new Blob([content]);
                    setSelectedImage(URL.createObjectURL(blob));
                }
            }
            if(!selectedImage) loadImage();
            return selectedImage;
        }
        return selectedImage;
    }, [initialFilePath, selectedImage, readFile]);

    const closeViewer = () => {
        if (initialFilePath) {
            // Can't close if it was opened directly. Maybe close the window? For now, do nothing.
        } else {
            if (selectedImage) URL.revokeObjectURL(selectedImage);
            setSelectedImage(null);
        }
    };

    if (imageToView) {
        return (
            <div className="h-full bg-black/80 flex items-center justify-center p-4" onClick={closeViewer}>
                <img src={imageToView} alt="Full view" className="max-h-full max-w-full object-contain" onClick={e => e.stopPropagation()} />
                {!initialFilePath && <button onClick={closeViewer} className="absolute top-4 right-4 text-white text-2xl">×</button>}
            </div>
        );
    }

    return (
        <div className="h-full bg-gray-100 dark:bg-gray-800 p-4 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Gallery</h2>
            {images.length === 0 ? (
                <p className="text-gray-500">No images found in your Pictures folder.</p>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                    {images.map(img => (
                        <div key={img.path} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer group" onClick={() => setSelectedImage(img.url)}>
                            <img src={img.url} alt={img.path} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Gallery;
