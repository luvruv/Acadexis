import { requireRole, ROLES } from "@/lib/permissions";

export const metadata = { title: "Coordinator | Acadexis" };

export default async function CoordinatorHomePage() {
  await requireRole(ROLES.COORDINATOR);

  return (
    <div className="max-w-2xl space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">My course files</h1>
      <p className="text-muted-foreground">
        Your course files will appear here.
      </p>
    </div>
  );
}