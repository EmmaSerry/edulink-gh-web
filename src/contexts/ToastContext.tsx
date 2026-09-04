import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastVariant, string> = {
  success: "bi-check-circle-fill",
  error: "bi-exclamation-triangle-fill",
  info: "bi-info-circle-fill",
};

/**
 * Lightweight, dependency-free toast notification system (no Bootstrap JS
 * bundle required). Every configuration module calls `useToast().showToast`
 * after a create/update/delete/validation-failure instead of rolling its
 * own notification UI.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="position-fixed bottom-0 end-0 p-3"
        style={{ zIndex: 1080, maxWidth: 360 }}
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`d-flex align-items-center gap-2 rounded-3 shadow-sm px-3 py-2 mb-2 text-white ${
              t.variant === "success" ? "bg-success" : t.variant === "error" ? "bg-danger" : "bg-primary"
            }`}
          >
            <i className={`bi ${ICONS[t.variant]}`} />
            <span className="small">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
