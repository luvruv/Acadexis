import { redirect } from "next/navigation";
import { requireRole, ROLES } from "@/lib/permissions";

export default async function AdminHomePage() {
  await requireRole(ROLES.ADMIN);
  redirect("/admin/program");
}