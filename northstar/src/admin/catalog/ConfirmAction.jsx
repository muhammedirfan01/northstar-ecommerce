import { useEffect, useRef } from "react";

export default function ConfirmAction({
  title,
  description,
  busy,
  error,
  onConfirm,
  onClose,
  danger = false,
  confirmLabel = "Confirm",
}) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="cm-dialog catalog-dialog"
      aria-labelledby="confirm-action-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <h2 id="confirm-action-title">{title}</h2>
      <p>{description}</p>
      {error && (
        <p className="cm-error" role="alert">
          {error}
        </p>
      )}
      <div className="catalog-actions">
        <button
          className="cm-button"
          type="button"
          autoFocus
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className={danger ? "catalog-danger" : "catalog-primary"}
          type="button"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Please wait…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
