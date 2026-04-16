import "./ErrorMessage.css";

type ErrorMessageProps = {
  message: string;
};

export function ErrorMessage({ message }: ErrorMessageProps) {
  return <p className="ui-error-message">{message}</p>;
}