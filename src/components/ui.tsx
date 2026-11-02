import { useState } from 'react';

interface ButtonProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export function Button({ label, onClick, variant = 'primary', disabled = false }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

interface DialogProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Dialog({ title, open, onClose, children }: DialogProps) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="dialog"
      >
        <div className="dialog-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface MenuItem {
  label: string;
  action: () => void;
}

export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="menu">
      <button
        type="button"
        className="btn btn-secondary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                item.action();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  actions
}: {
  title: string;
  message: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {actions && <div className="empty-state-actions">{actions}</div>}
    </div>
  );
}

export function Handoff({ message, actionLabel, onClick }: { message: string; actionLabel: string; onClick: () => void }) {
  return (
    <div className="handoff" role="note">
      <p>{message}</p>
      <Button label={actionLabel} variant="secondary" onClick={onClick} />
    </div>
  );
}
