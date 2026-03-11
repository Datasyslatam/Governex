import React from "react";
import "./Modal.css";

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ open, title, onClose, children }) => {
  if (!open) return null;

  return (
    <div className="ui-modal">
      <div className="ui-modal__backdrop" onClick={onClose} />
      <div className="ui-modal__content">
        <header className="ui-modal__header">
          {title && <h3>{title}</h3>}
          <button className="ui-modal__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
