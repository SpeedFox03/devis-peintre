import type { ReactNode } from "react";
import "./SectionCard.css";

type SectionCardProps = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function SectionCard({
  title,
  actions,
  children,
}: SectionCardProps) {
  return (
    <section className="ui-section-card">
      <div className="ui-section-card__header">
        <h2 className="ui-section-card__title">{title}</h2>
        {actions && <div className="ui-section-card__actions">{actions}</div>}
      </div>

      <div className="ui-section-card__content">{children}</div>
    </section>
  );
}