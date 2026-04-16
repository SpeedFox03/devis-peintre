import type { ReactNode } from "react";
import "./FormGrid.css";

type FormGridVariant = "2" | "3-1" | "1";

type FormGridProps = {
  children: ReactNode;
  columns?: FormGridVariant;
};

export function FormGrid({
  children,
  columns = "2",
}: FormGridProps) {
  return (
    <div className={`ui-form-grid ui-form-grid--${columns}`}>
      {children}
    </div>
  );
}