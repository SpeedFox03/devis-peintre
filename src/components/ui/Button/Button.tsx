import "./Button.css";

type ButtonVariant = "primary" | "secondary" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  iconOnly?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  iconOnly = false,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-button ui-button--${variant} ui-button--${size}${iconOnly ? " ui-button--icon" : ""} ${className}`.trim()}
      {...props}
    />
  );
}
