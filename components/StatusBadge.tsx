import type { Status } from "@/lib/api";

const MAP: Record<string, string> = {
  OK:      "bg-green-100 text-green-700",
  PROBLEM: "bg-red-100 text-red-700",
  ERROR:   "bg-orange-100 text-orange-700",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${MAP[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
