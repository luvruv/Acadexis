// Starter data copied from the HCI sample course file (BMU, School of
// Engineering & Technology, B.Tech CSE). This is SEED data, not user-entered
// data. It only creates missing rows and never overwrites later edits.

import "dotenv/config";
import prismaPackage from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = prismaPackage;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ---------- University ----------

const UNIVERSITY = {
  name: "BML Munjal University",
  vision:
    "BML Munjal University seeks to nurture ethical leaders who are skilled, knowledgeable and have the life skills required for leading their organizations to success.\n\nThe university shall seek the advancement and dissemination of practically oriented knowledge benchmarked with the best global standards.",
  mission:
    "BML Munjal University aims to be a leading university for the quality and impact of its teaching, research, and linkages with major stakeholders. The focus of the university is to find creative solutions to problems through application of knowledge. The university aims to create a talented community of students and faculty who excel in teaching, learning and research, in a creative and stimulating environment. The university will collaborate with other institutions for development of science, technology, and arts in the global context.",
};

const GRADUATE_ATTRIBUTES = [
  "Acquire and apply practical understanding of discipline knowledge.",
  "Demonstrate a sense of ethics and display excellence in both personal and professional life.",
  "Exhibit problem solving, critical thinking skills and investigative capability to address real world problems.",
  "Manifest leadership qualities and work effectively in teams across globally diverse environments.",
  "Be a lifelong learner with an entrepreneurial mindset to innovate in the constantly changing global scenario.",
  "Possess a strong sense of inquiry and design innovative solutions for positive societal impact.",
  "Be effective communicators and possess an empathetic outlook.",
];

// ---------- School and program ----------

const SCHOOL = {
  name: "School of Engineering & Technology",
  vision:
    "To be amongst the leading engineering schools of the country recognized globally for excellence in teaching and research with focus on experiential learning, innovation, and entrepreneurship.",
  mission: [
    "Providing high-quality learning experience to our students, preparing them to be global leaders, and contributing to the development of society through research, innovation, and entrepreneurship.",
    "Creating an inclusive and diverse learning environment that fosters creativity, critical thinking, and ethical values.",
    "Collaborating with industry, government, and other institutions to address complex societal challenges and promote sustainable development.",
  ].join("\n"),
};

const PROGRAM = { name: "B.Tech (CSE)", code: "CSE" };

function buildOutcomes(type, prefix, descriptions) {
  return descriptions.map((description, index) => ({
    type,
    code: `${prefix}${index + 1}`,
    description,
    position: index + 1,
  }));
}

const PROGRAM_OUTCOMES = [
  ...buildOutcomes("PEO", "PEO", [
    "Identify real-life problems and develop creative and innovative hardware/software-based solutions.",
    "Achieve professional development through self-learning to adapt to the technological changes in the ever-changing field of computing.",
    "Engage in life-long learning of computer engineering technologies, critical thinking and continuous ingenuity and apply them in real-life applications.",
    "Accomplish leadership roles by imbibing ethics and professionalism with emphasis on sustainable development of the society.",
  ]),
  ...buildOutcomes("PO", "PO", [
    "Apply the knowledge of mathematics, science, engineering fundamentals, along with Electronics & Computer engineering to the solution of complex engineering problems.",
    "Identify, formulate, review research literature, and analyse complex engineering problems reaching substantiated conclusions using domain knowledge of electronics & computer engineering.",
    "Design solutions for complex engineering problems and design system components or processes that meet the specified needs with appropriate consideration for the public health & safety, cultural, societal, and environmental considerations.",
    "Use research-based knowledge and research methods including design of experiments, analysis and interpretation of data, and synthesis of the information to provide valid conclusions.",
    "Select and apply appropriate techniques, resources, and electronics & communication engineering tools to various engineering activities with an understanding of the limitations.",
    "Apply reasoning informed by the contextual knowledge to assess societal, health, safety, legal and cultural issues and the consequent responsibilities relevant to the professional engineering practice.",
    "Understand the impact of the professional engineering solutions in societal and environmental contexts, and demonstrate the knowledge of, and need for sustainable development.",
    "Apply ethical principles and commit to professional ethics and responsibilities and norms of the engineering practice.",
    "Function effectively as an individual, and as a member or leader in diverse teams, and in multidisciplinary settings.",
    "Communicate effectively on complex engineering activities with the engineering community and with society at large, such as, being able to comprehend and write effective reports and design documentation, make effective presentations, and give and receive clear instructions.",
    "Demonstrate knowledge and understanding of the electronics & computer engineering and management principles and apply these to one's own work, as a member and leader in a team, to manage projects and in multidisciplinary environments.",
    "Recognize the need for and have the preparation and ability to engage in independent and life-long learning in the broadest context of technological change.",
  ]),
  ...buildOutcomes("PSO", "PSO", [
    "Identify applicable tools and techniques related to data science practice such as data collection, cleaning, analysis, modelling, evaluation, and result interpretation and apply them for deriving hidden and meaningful patterns for appropriate actionable insights.",
    "Develop intelligent systems for various real-life domains like healthcare, transportation, finance etc. using Artificial Intelligence methodologies.",
    "Understand the foundational concepts and techniques to protect computing systems against constantly evolving cybersecurity threats and analyse security breaches and violations of cyber systems and networks to provide appropriate solutions.",
    "Design effective security systems to mitigate risks, threats, and vulnerabilities for protecting the organizations against cyber threats.",
  ]),
];

// ---------- Course file templates ----------
// Each row: [number, title, formKey, source, isRequired]
// "isRequired" for sections 24 and 25 (and 19 in the HCI layout) is an
// ASSUMPTION based on the "(if any)" wording in the template. To be confirmed.

const TEMPLATE_25_NAME = "BMU Course File - 25 sections (official template)";
const TEMPLATE_25 = [
  [1, "Course Details", "course-details", "COURSE_SETUP", true],
  [2, "Vision, Mission of the University", "university-vision-mission", "PROGRAM_DATA", true],
  [3, "Graduate Attributes of the BMU Students", "graduate-attributes", "PROGRAM_DATA", true],
  [4, "Vision, Mission of the School", "school-vision-mission", "PROGRAM_DATA", true],
  [5, "PEOs and POs & PSOs of the Program", "program-outcomes", "PROGRAM_DATA", true],
  [6, "Course Description and its objectives", "course-description", "COURSE_SETUP", true],
  [7, "Course Outcomes and CO-PO Mapping", "course-outcomes", "COURSE_SETUP", true],
  [8, "Course Syllabus", "course-syllabus", "COURSE_SETUP", true],
  [9, "Detailed Session wise Plan", "session-plan", "CONTRIBUTOR", true],
  [10, "Weekly Timetable", "weekly-timetable", "CONTRIBUTOR", true],
  [11, "Registered Students List", "student-list", "COURSE_SETUP", true],
  [12, "Details of Internal Assessments; weightages, due dates, mapping to CO", "internal-assessments", "CONTRIBUTOR", true],
  [13, "Mid Semester Question papers with sample solutions", "midsem-papers", "CONTRIBUTOR", true],
  [14, "Sample Evaluated Internal Submissions and Identification of weak students", "evaluated-submissions", "CONTRIBUTOR", true],
  [15, "Reflections from the Mid-term semester feedback received, and interventions made to enhance the student learning and continuous improvement in teaching and learning strategies", "midterm-reflections", "CONTRIBUTOR", true],
  [16, "Interventions made for slow performers and advanced learners, highlighting initiatives taken for student improvements (retest, resubmissions etc.)", "interventions", "CONTRIBUTOR", true],
  [17, "End Semester Question papers with sample solutions", "endsem-papers", "CONTRIBUTOR", true],
  [18, "Detail of Marks in all components up to the End Semester", "marks-all-components", "CONTRIBUTOR", true],
  [19, "Attendance Report", "attendance", "CONTRIBUTOR", true],
  [20, "Final record of Results (including the grades)", "final-results", "CONTRIBUTOR", true],
  [21, "Analyzing Direct Feedback received on Course Outcomes", "direct-feedback", "CONTRIBUTOR", true],
  [22, "CO Attainment Measurement Analysis", "co-attainment", "COMPUTED", true],
  [23, "Feedback (class committee or otherwise) and corrective actions (if any)", "feedback-corrective-actions", "CONTRIBUTOR", true],
  [24, "Faculty Course Review", "faculty-review", "CONTRIBUTOR", false],
  [25, "Any other additional information", "additional-info", "CONTRIBUTOR", false],
];

const TEMPLATE_19_NAME = "BMU Course File - 19 sections (HCI sample layout)";
const TEMPLATE_19 = [
  [1, "Vision, Mission of the University", "university-vision-mission", "PROGRAM_DATA", true],
  [2, "Graduate Attributes of the BMU Students", "graduate-attributes", "PROGRAM_DATA", true],
  [3, "Vision, Mission of the School", "school-vision-mission", "PROGRAM_DATA", true],
  [4, "PEOs and POs & PSOs of the Program", "program-outcomes", "PROGRAM_DATA", true],
  [5, "Course Description and its objectives", "course-description", "COURSE_SETUP", true],
  [6, "Course Outcomes and CO-PO Mapping", "course-outcomes", "COURSE_SETUP", true],
  [7, "Course Syllabus", "course-syllabus", "COURSE_SETUP", true],
  [8, "Detailed Session wise Plan", "session-plan", "CONTRIBUTOR", true],
  [9, "Weekly Timetable", "weekly-timetable", "CONTRIBUTOR", true],
  [10, "Registered Students List", "student-list", "COURSE_SETUP", true],
  [11, "Details of Internal Assessments; weightages, due dates, mapping to CO", "internal-assessments", "CONTRIBUTOR", true],
  [12, "Mid-Semester Assignment Questions", "midsem-papers", "CONTRIBUTOR", true],
  [13, "Reflections from the Mid-term semester feedback received, and interventions made to enhance the student learning and continuous improvement in teaching and learning strategies", "midterm-reflections", "CONTRIBUTOR", true],
  [14, "End Semester Question papers", "endsem-papers", "CONTRIBUTOR", true],
  [15, "Attendance Report", "attendance", "CONTRIBUTOR", true],
  [16, "Final record of Results (including the grades)", "final-results", "CONTRIBUTOR", true],
  [17, "CO Attainment Measurement Analysis", "co-attainment", "COMPUTED", true],
  [18, "PO Attainment Analysis", "po-attainment", "COMPUTED", true],
  [19, "Course Review By Faculty", "faculty-review", "CONTRIBUTOR", false],
];

// ---------- Seeding functions ----------

async function seedProgramData() {
  const university = await prisma.university.upsert({
    where: { name: UNIVERSITY.name },
    update: {},
    create: UNIVERSITY,
  });

  const attributeCount = await prisma.graduateAttribute.count({
    where: { universityId: university.id },
  });
  if (attributeCount === 0) {
    await prisma.graduateAttribute.createMany({
      data: GRADUATE_ATTRIBUTES.map((text, index) => ({
        universityId: university.id,
        position: index + 1,
        text,
      })),
    });
  }

  const school = await prisma.school.upsert({
    where: {
      universityId_name: { universityId: university.id, name: SCHOOL.name },
    },
    update: {},
    create: { universityId: university.id, ...SCHOOL },
  });

  const program = await prisma.program.upsert({
    where: { schoolId_code: { schoolId: school.id, code: PROGRAM.code } },
    update: {},
    create: { schoolId: school.id, ...PROGRAM },
  });

  await prisma.programOutcome.createMany({
    data: PROGRAM_OUTCOMES.map((outcome) => ({
      programId: program.id,
      ...outcome,
    })),
    skipDuplicates: true,
  });
}

async function seedTemplate(name, description, sections) {
  const template = await prisma.templateVersion.upsert({
    where: { name },
    update: {},
    create: { name, description },
  });

  await prisma.templateSection.createMany({
    data: sections.map(([number, title, formKey, source, isRequired]) => ({
      templateVersionId: template.id,
      number,
      title,
      formKey,
      source,
      isRequired,
    })),
    skipDuplicates: true,
  });
}

async function main() {
  await seedProgramData();
  await seedTemplate(
    TEMPLATE_25_NAME,
    "Official BMU course file template with 25 sections.",
    TEMPLATE_25
  );
  await seedTemplate(
    TEMPLATE_19_NAME,
    "Layout of the completed HCI sample course file (19 sections).",
    TEMPLATE_19
  );

  const [universities, schools, programs, outcomes, attributes] = await Promise.all([
    prisma.university.count(),
    prisma.school.count(),
    prisma.program.count(),
    prisma.programOutcome.count(),
    prisma.graduateAttribute.count(),
  ]);
  const templates = await prisma.templateVersion.findMany({
    include: { _count: { select: { sections: true } } },
    orderBy: { name: "asc" },
  });

  console.log("Seed complete.");
  console.log({ universities, schools, programs, outcomes, attributes });
  for (const template of templates) {
    console.log(`${template.name}: ${template._count.sections} sections`);
  }
}

try {
  await main();
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}