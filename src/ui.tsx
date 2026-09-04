import React from 'react';

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary';
    size?: 'sm' | 'md';
    children: React.ReactNode;
    accentColor?: string;
  }
> = ({ variant = 'secondary', size = 'md', children, accentColor, className = '', style, ...props }) => (
  <button
    {...props}
    className={`btn-base focus:outline-none button-${variant}${size === 'sm' ? ' button-sm' : ''} ${className}`}
    style={variant === 'primary' && accentColor ? { backgroundColor: accentColor, ...style } : style}
  >
    {children}
  </button>
);

export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'ghost';
  }
> = ({ icon, size = 'md', variant = 'ghost', className = '', ...props }) => {
  const sizeClass = size === 'sm' ? 'icon-button-size-sm' : size === 'lg' ? 'icon-button-size-lg' : 'icon-button-size-md';
  return (
    <button
      {...props}
      className={`${sizeClass} icon-button-${variant} rounded-full transition-colors focus:outline-none ${className}`}
    >
      {icon}
    </button>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  showCloseButton?: boolean;
}> = ({ isOpen, onClose, title, children, size = 'md', showCloseButton = true }) => {
  if (!isOpen) return null;
  const showHeader = title || showCloseButton;
  const sizeClass = size === 'sm' ? 'modal-size-sm' : size === 'lg' ? 'modal-size-lg' : 'modal-size-md';

  return (
    <div className="modal-overlay">
      <div className={`modal-card-base shadow-2xl w-full ${sizeClass} modal-content-scrollable`}>
        {showHeader && (
          <div className="modal-header">
            {title && <h2 className="text-xl font-bold">{title}</h2>}
            <IconButton icon={<span className="text-2xl">✕</span>} onClick={onClose} className="ml-auto" />
          </div>
        )}
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
};

export const ConfirmModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  icon?: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  accentColor: string;
}> = ({ isOpen, onClose, icon, title, description, confirmLabel, onConfirm, accentColor }) => (
  <Modal isOpen={isOpen} onClose={onClose} size="md" showCloseButton={false}>
    <div className="confirm-modal-content">
      {icon && <div className="confirm-modal-icon">{icon}</div>}
      <h3 className="confirm-modal-title">{title}</h3>
      <p className="confirm-modal-description">{description}</p>
    </div>
    <div className="modal-footer">
      <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
      <Button variant="primary" onClick={onConfirm} accentColor={accentColor} className="flex-1">{confirmLabel}</Button>
    </div>
  </Modal>
);
