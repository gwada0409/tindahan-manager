import * as React from "react"
import { Button } from "./Button"

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export function ConfirmModal({ 
  isOpen, onClose, onConfirm, title, message, description,
  confirmText = 'Confirm', cancelText = 'Cancel',
  variant = 'default'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const displayMessage = message || description || '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-[60] w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 text-center space-y-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{displayMessage}</p>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>{cancelText}</Button>
          <Button 
            variant={variant === 'destructive' ? 'destructive' : 'default'} 
            className="flex-1" 
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
