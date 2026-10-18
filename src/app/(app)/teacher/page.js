import { requireRole, ROLES } from "@/lib/permissions";

export const metadata = { title: "Co-Teacher | Acadexis" };

export default async function TeacherHomePage() {
  await requireRole(ROLES.CO_TEACHER);

  return (
    <div className="max-w-2xl space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">My assignments</h1>
      <p className="text-muted-foreground">
        Your assigned sections will appear here.
      </p>
    </div>
  );
}