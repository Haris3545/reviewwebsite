interface LoadingBarProps {
  progress: number;
  text: string;
}

export default function LoadingBar({ progress, text }: LoadingBarProps) {
  return (
    <div className="loading-bar" role="status" aria-live="polite">
      <div className="loading-bar-track">
        <div className="loading-bar-fill" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <p className="loading-bar-text">{text}</p>
    </div>
  );
}
