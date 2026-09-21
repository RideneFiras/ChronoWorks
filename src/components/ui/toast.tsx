"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * DESIGN.md section 5: bottom right, one line, the same verb as the action
 * ("Invoice issued"). No icon, no stacking animation, no progress bar.
 */
type Tone = "done" | "warn" | "error";

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = "done") => {
    setToasts((current) => [...current, { id: Date.now() + Math.random(), message, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        // Announced politely rather than interrupting, and never traps focus.
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 end-4 z-[60] flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastLine
            key={toast.id}
            toast={toast}
            onDone={() => setToasts((c) => c.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastLine({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 4000);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <div
      className={cn(
        "pointer-events-auto rounded-panel border bg-raised px-4 py-2 text-body",
        toast.tone === "error" && "border-red text-red",
        toast.tone === "warn" && "border-amber text-amber",
        toast.tone === "done" && "border-line text-ink",
      )}
    >
      {toast.message}
    </div>
  );
}
