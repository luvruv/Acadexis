import { requireRole, ROLES } from "@/lib/permissions";

export const metadata = { title: "Admin | Acadexis" };

export default async function AdminHomePage() {
  await requireRole(ROLES.ADMIN);

  return (
    <div className="max-w-2xl space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">Admin area</h1>
      <p className="text-muted-foreground">
        Program setup and user management will appear here.
      </p>
    </div>
  );
}