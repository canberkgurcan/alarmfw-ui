/**
 * Displays a non-blocking warning when one or more backend PromQL queries
 * failed. An empty / undefined errors map renders nothing.
 */
export default function QueryErrorBanner({ errors }: { errors?: Record<string, string> }) {
  if (!errors || Object.keys(errors).length === 0) return null;
  const entries = Object.entries(errors);
  return (
    <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
      <span className="font-semibold">⚠ {entries.length} sorgu başarısız</span>
      {" — "}sonuçlar eksik olabilir:
      <ul className="mt-1 space-y-0.5 list-disc list-inside text-yellow-700">
        {entries.map(([key, msg]) => (
          <li key={key}>
            <span className="font-mono">{key}</span>: {msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
