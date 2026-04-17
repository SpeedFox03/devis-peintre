import type { ReactNode } from "react";
import "./FormGrid.css";

type FormGridVariant = "1" | "2" | "3" | "3-1" | "4";

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
