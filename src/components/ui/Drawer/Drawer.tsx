import { useEffect } from "react";
import type { ReactNode } from "react";
import { CloseIcon } from "../Icons/AppIcons";
import "./Drawer.css";

type DrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function Drawer({ open, title, description, children, footer, onClose }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-drawer" role="presentation">
      <button className="ui-drawer__overlay" type="button" aria-label="Fermer" onClick={onClose} />
      <aside className="ui-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="ui-drawer__header">
          <div>
            <h2 id="drawer-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="ui-drawer__close" type="button" aria-label="Fermer" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="ui-drawer__body">{children}</div>
        {footer ? <footer className="ui-drawer__footer">{footer}</footer> : null}
      </aside>
    </div>
  );
}
