const TONES = {
  CREATED: "bg-muted text-foreground",
  PENDING: "bg-muted text-foreground",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  UNDER_REVIEW: "bg-purple-100 text-purple-800",
  CHANGES_REQUESTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  LOCKED: "bg-slate-800 text-white",
  EXPORTED: "bg-slate-800 text-white",
};

export default function StatusBadge({ status, labels }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
        TONES[status] ?? TONES.CREATED
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}