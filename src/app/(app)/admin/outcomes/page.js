import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import OutcomeForms from "./outcome-forms";

export const metadata = { title: "Program outcomes | Acadexis" };

export default async function OutcomesPage() {
  await requireRole(ROLES.ADMIN);

  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    include: {
      school: { select: { name: true } },
      outcomes: { orderBy: [{ type: "asc" }, { position: "asc" }] },
    },
  });

  const data = programs.map((program) => ({
    id: program.id,
    name: program.name,
    schoolName: program.school.name,
    outcomes: program.outcomes.map((outcome) => ({
      id: outcome.id,
      type: outcome.type,
      code: outcome.code,
      description: outcome.description,
    })),
  }));

  return <OutcomeForms programs={data} />;
}