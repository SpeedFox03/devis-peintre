import "./Select.css";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <select className={`ui-select ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}