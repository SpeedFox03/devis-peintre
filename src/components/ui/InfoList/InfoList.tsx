import type { ReactNode } from "react";
import "./InfoList.css";

type InfoListItem = {
  label: string;
  value: ReactNode;
};

type InfoListProps = {
  items: InfoListItem[];
};

export function InfoList({ items }: InfoListProps) {
  return (
    <div className="ui-info-list">
      {items.map((item) => (
        <div key={item.label} className="ui-info-list__item">
          <strong className="ui-info-list__label">{item.label}</strong>
          <div className="ui-info-list__value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}