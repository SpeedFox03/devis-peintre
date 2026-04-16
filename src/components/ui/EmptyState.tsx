type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 24,
        marginTop: 16,
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {description && <p style={{ marginBottom: 0 }}>{description}</p>}
    </div>
  );
}