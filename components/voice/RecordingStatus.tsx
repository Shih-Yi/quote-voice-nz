"use client";

interface RecordingStatusProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
}

export function RecordingStatus({ isRecording, isPaused, duration }: RecordingStatusProps) {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const maxDuration = 120; // 2 minutes
  const progress = (duration / maxDuration) * 100;

  if (!isRecording) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse"
          }`}
        />
        <span className="text-lg font-mono font-medium text-text">
          {formatDuration(duration)}
        </span>
        <span className="text-sm text-text-muted">/ 2:00</span>
      </div>

      <div className="w-48 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ${
            isPaused ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {isPaused && (
        <span className="text-sm text-amber-600 font-medium">Paused</span>
      )}
    </div>
  );
}
