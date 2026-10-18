import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import UserManagement from "./user-management";

export const metadata = { title: "Users | Acadexis" };

export default async function UsersPage() {
  const admin = await requireRole(ROLES.ADMIN);

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return <UserManagement users={users} currentUserId={admin.id} />;
}