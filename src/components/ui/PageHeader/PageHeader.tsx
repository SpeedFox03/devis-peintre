import type { ReactNode } from "react";
import "./PageHeader.css";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="ui-page-header">
      <div>
        <h1 className="ui-page-header__title">{title}</h1>
        {description && (
          <p className="ui-page-header__description">{description}</p>
        )}
      </div>

      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </div>
  );
}