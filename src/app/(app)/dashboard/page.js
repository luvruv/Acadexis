import Link from "next/link";
import { requireUser, ROLE_HOME, ROLE_LABELS } from "@/lib/permissions";

export const metadata = { title: "Dashboard | Acadexis" };

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="max-w-2xl space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">
        Welcome, {user.name}
      </h1>
      <p className="text-muted-foreground">
        You are signed in as {ROLE_LABELS[user.role]}.
      </p>
      <Link href={ROLE_HOME[user.role]} className="underline">
        Go to my area
      </Link>
    </div>
  );
}