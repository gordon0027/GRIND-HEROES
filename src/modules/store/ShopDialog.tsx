import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useUiKit } from "@idosgames/react/ui";
import { t } from "./i18n";

/** A native modal escapes the game feature overlay's stacking context. */
export function ShopDialog({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}): ReactNode {
  const kit = useUiKit();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} className="gh-shop-confirm" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="gh-shop-confirm__header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose} aria-label={t("close")}>×</button>
      </header>
      {children}
    </dialog>, kit.layer ?? document.body,
  );
}
