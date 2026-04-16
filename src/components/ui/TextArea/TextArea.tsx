import "./TextArea.css";

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ className = "", ...props }: TextAreaProps) {
  return <textarea className={`ui-text-area ${className}`.trim()} {...props} />;
}