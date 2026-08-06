interface LoadingBarProps {
  progress: number;
  text: string;
  secondsRemaining: number;
}

export default function LoadingBar({ progress, text, secondsRemaining }: LoadingBarProps) {
  return (
    <div className="loading-bar" role="status" aria-live="polite">
      <div className="loading-bar-track">
        <div className="loading-bar-fill" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <div className="loading-bar-row">
        <p className="loading-bar-text">{text}</p>
        {secondsRemaining > 0 && (
          <p className="loading-bar-countdown">~{secondsRemaining}s</p>
        )}
      </div>
    </div>
  );
}
