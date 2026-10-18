import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import ProgramForms from "./program-forms";

export const metadata = { title: "Program setup | Acadexis" };

export default async function ProgramSetupPage() {
  await requireRole(ROLES.ADMIN);

  const university = await prisma.university.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      graduateAttributes: { orderBy: { position: "asc" } },
      schools: { orderBy: { name: "asc" } },
    },
  });

  if (!university) {
    return (
      <p className="text-muted-foreground">
        No university found. Run <code>npm run db:seed</code> first.
      </p>
    );
  }

  const data = {
    university: {
      id: university.id,
      name: university.name,
      vision: university.vision,
      mission: university.mission,
      updatedAt: university.updatedAt.toISOString(),
    },
    attributes: university.graduateAttributes.map((item) => item.text),
    schools: university.schools.map((school) => ({
      id: school.id,
      name: school.name,
      vision: school.vision,
      mission: school.mission,
      updatedAt: school.updatedAt.toISOString(),
    })),
  };

  return <ProgramForms data={data} />;
}