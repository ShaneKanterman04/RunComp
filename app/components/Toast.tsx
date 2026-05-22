"use client";

import { useEffect, useState } from "react";

export type ToastType = "milestone" | "success" | "confetti";

export interface ToastMessage {
  id: string;
  text: string;
  type: ToastType;
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const toast of toasts) {
      if (!exiting.has(toast.id)) {
        const t = setTimeout(() => {
          setExiting((prev) => new Set(prev).add(toast.id));
          setTimeout(() => onDismiss(toast.id), 300);
        }, 3500);
        timers.push(t);
      }
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [toasts, exiting, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="toastContainer" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type} ${exiting.has(toast.id) ? "exiting" : ""}`}
        >
          <span>{toast.type === "milestone" ? "🎉" : toast.type === "success" ? "✅" : "🎊"}</span>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
