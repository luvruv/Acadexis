export default function ProgressBar({ percent }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-32 rounded-full bg-muted"
    >
      <div
        className="h-2 rounded-full bg-green-600"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}