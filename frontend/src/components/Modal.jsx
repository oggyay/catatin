export default function Modal({ title, children, onClose, footer }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {title && <div className="title">{title}</div>}
        <div>{children}</div>
        {footer && <div className="actions">{footer}</div>}
      </div>
    </div>
  );
}
