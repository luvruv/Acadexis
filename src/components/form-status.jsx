export default function FormStatus({ state }) {
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={state.ok ? "text-sm text-green-700" : "text-sm text-red-600"}
    >
      {state.message}
    </p>
  );
}