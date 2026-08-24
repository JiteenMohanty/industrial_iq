"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Native <dialog> with showModal() rather than a hand-rolled overlay div: the browser provides
 * focus trapping, Escape-to-close, and top-layer stacking for free, which a manual
 * div-plus-backdrop implementation would otherwise have to reimplement to meet WCAG 2.1 AA
 * keyboard-operability requirements (FR-037).
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onCancel={onClose}
      className="fixed inset-y-0 right-0 m-0 h-full w-full max-w-lg overflow-y-auto border-0 bg-surface p-6 backdrop:bg-black/40"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-ink-secondary transition-colors duration-150 hover:bg-page hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}
