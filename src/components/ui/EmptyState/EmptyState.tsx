import "./EmptyState.css";

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      <h3 className="ui-empty-state__title">{title}</h3>
      {description && <p className="ui-empty-state__description">{description}</p>}
    </div>
  );
}