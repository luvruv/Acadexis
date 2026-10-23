// Program-level data shaped for the sections that show it. Locking stores
// exactly this shape in the section; before locking it is read live.
export function buildProgramSnapshots(program) {
  const { school } = program;
  const { university } = school;
  const outcomesOfType = (type) =>
    program.outcomes
      .filter((outcome) => outcome.type === type)
      .map(({ code, description }) => ({ code, description }));

  return {
    "university-vision-mission": {
      universityName: university.name,
      vision: university.vision,
      mission: university.mission,
    },
    "graduate-attributes": {
      attributes: university.graduateAttributes.map((attribute) => attribute.text),
    },
    "school-vision-mission": {
      schoolName: school.name,
      vision: school.vision,
      mission: school.mission,
    },
    "program-outcomes": {
      programName: program.name,
      peos: outcomesOfType("PEO"),
      pos: outcomesOfType("PO"),
      psos: outcomesOfType("PSO"),
    },
  };
}

export async function loadProgramSnapshots(db, programId) {
  const program = await db.program.findUnique({
    where: { id: programId },
    include: {
      outcomes: { orderBy: [{ type: "asc" }, { position: "asc" }] },
      school: {
        include: {
          university: {
            include: { graduateAttributes: { orderBy: { position: "asc" } } },
          },
        },
      },
    },
  });
  return program ? buildProgramSnapshots(program) : null;
}