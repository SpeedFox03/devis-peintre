type LoadingBlockProps = {
  message?: string;
};

export function LoadingBlock({
  message = "Chargement...",
}: LoadingBlockProps) {
  return <p>{message}</p>;
}