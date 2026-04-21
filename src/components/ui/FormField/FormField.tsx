import type { ReactNode } from "react";
import "./FormField.css";

type FormFieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
};

export function FormField({ label, children }: FormFieldProps) {
  return (
    <label className="ui-form-field">
      <span className="ui-form-field__label">{label}</span>
      {children}
    </label>
  );
}