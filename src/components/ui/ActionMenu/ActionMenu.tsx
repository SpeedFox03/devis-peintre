import type { ReactNode } from "react";
import { MoreIcon } from "../Icons/AppIcons";
import "./ActionMenu.css";

type ActionMenuProps = {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
};

export function ActionMenu({ label, children, align = "right" }: ActionMenuProps) {
  return (
    <details className={`ui-action-menu ui-action-menu--${align}`}>
      <summary aria-label={label} title={label}><MoreIcon /></summary>
      <div className="ui-action-menu__content">{children}</div>
    </details>
  );
}
