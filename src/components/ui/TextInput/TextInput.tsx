import "./TextInput.css";

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className = "", ...props }: TextInputProps) {
  return <input className={`ui-text-input ${className}`.trim()} {...props} />;
}