interface DiagnosticItem {
  label: string;
  message: string;
}

interface DiagnosticsProps {
  items: DiagnosticItem[];
}

export default function Diagnostics({ items }: DiagnosticsProps) {
  if (items.length === 0) return null;

  return (
    <details className="diagnostics">
      <summary>Diagnostics ({items.length})</summary>
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            <strong>{item.label}:</strong> {item.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
