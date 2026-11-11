import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function AdminDialog({
  title,
  subtitle,
  close,
  children,
  wide = false,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`cm-dialog catalog-dialog ops-modal ${wide ? "ops-modal-wide" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          close();
      }}
    >
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="cm-icon-button"
          type="button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
