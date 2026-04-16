import "./LoadingBlock.css";

type LoadingBlockProps = {
  message?: string;
};

export function LoadingBlock({
  message = "Chargement...",
}: LoadingBlockProps) {
  return <p className="ui-loading-block">{message}</p>;
}