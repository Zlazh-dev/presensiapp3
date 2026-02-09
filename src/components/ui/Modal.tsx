import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={cn(
                    "relative w-full max-w-lg rounded-lg border bg-surface bg-background p-6 shadow-lg animate-in zoom-in-95 duration-200 sm:rounded-xl",
                    className
                )}
            >
                <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
                    <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
