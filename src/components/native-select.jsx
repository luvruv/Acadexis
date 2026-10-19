export default function NativeSelect({ className = "", children, ...props }) {
  return (
    <select
      className={`h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}