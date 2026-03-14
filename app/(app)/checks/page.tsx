import { getChecks } from "@/lib/api";
import ChecksClient from "./ChecksClient";

export const revalidate = 0;

export default async function ChecksPage() {
  const checks = await getChecks().catch(() => []);
  return <ChecksClient initial={checks} />;
}
