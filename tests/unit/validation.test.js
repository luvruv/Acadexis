import { describe, expect, it } from "vitest";
import { saveAssessmentsSchema } from "@/lib/validation/assessments";
import { attainmentSettingsSchema } from "@/lib/validation/attainment";
import { loginSchema } from "@/lib/validation/auth";
import { saveStudentsSchema } from "@/lib/validation/students";
import { createUserSchema } from "@/lib/validation/users";

const message = (result) => result.error.issues[0].message;

describe("loginSchema", () => {
  it("lower-cases and trims the email", () => {
    const result = loginSchema.safeParse({ email: "  Admin@Acadexis.LOCAL ", password: "x" });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe("admin@acadexis.local");
  });
  it("rejects a bad email, an empty password and a huge password", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(129) }).success).toBe(false);
  });
  it("rejects missing fields", () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
  });
});

describe("createUserSchema", () => {
  const valid = { name: "Test Teacher", email: "T@x.com", role: "CO_TEACHER", password: "longenough1" };
  it("accepts a valid user and normalizes the email", () => {
    const result = createUserSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data.email).toBe("t@x.com");
  });
  it("enforces the password length from 10 to 72 characters", () => {
    expect(createUserSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, password: "x".repeat(73) }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, password: "x".repeat(72) }).success).toBe(true);
  });
  it("only accepts the three roles", () => {
    expect(createUserSchema.safeParse({ ...valid, role: "SUPERUSER" }).success).toBe(false);
    for (const role of ["ADMIN", "COORDINATOR", "CO_TEACHER"]) {
      expect(createUserSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
  });
});

describe("saveStudentsSchema", () => {
  const student = (n, extra = {}) => ({
    enrollmentNo: `ENR${n}`, rollNo: "", name: `Student ${n}`, classGroup: "", ...extra,
  });
  const body = (students) => ({ courseFileId: "cf", sectionVersion: 1, students });

  it("accepts students and turns empty optional fields into null", () => {
    const result = saveStudentsSchema.safeParse(body([student(1)]));
    expect(result.success).toBe(true);
    expect(result.data.students[0]).toMatchObject({ rollNo: null, classGroup: null });
  });
  it("rejects an empty list", () => {
    expect(message(saveStudentsSchema.safeParse(body([])))).toBe("Add at least one student.");
  });
  it("rejects duplicate enrollment numbers, ignoring case", () => {
    const result = saveStudentsSchema.safeParse(body([student(1), student(2, { enrollmentNo: "enr1" })]));
    expect(result.success).toBe(false);
    expect(message(result)).toMatch(/Duplicate enrollment number enr1/);
  });
  it("rejects missing names and enrollment numbers", () => {
    expect(saveStudentsSchema.safeParse(body([student(1, { name: "" })])).success).toBe(false);
    expect(saveStudentsSchema.safeParse(body([student(1, { enrollmentNo: "  " })])).success).toBe(false);
  });
  it("rejects more than 1000 students", () => {
    const many = Array.from({ length: 1001 }, (_, i) => student(i));
    expect(saveStudentsSchema.safeParse(body(many)).success).toBe(false);
  });
});

describe("saveAssessmentsSchema", () => {
  const component = (name, maxMarks = 10, extra = {}) => ({
    id: null, name, maxMarks, courseOutcomeIds: [], ...extra,
  });
  const body = (components) => ({ courseFileId: "cf", components });

  it("accepts valid components", () => {
    expect(saveAssessmentsSchema.safeParse(body([component("Quiz 1"), component("End Term", 40)])).success).toBe(true);
  });
  it("rejects duplicate names, ignoring case", () => {
    const result = saveAssessmentsSchema.safeParse(body([component("Quiz"), component("quiz")]));
    expect(message(result)).toMatch(/Names must be different/);
  });
  it("rejects bad maximum marks", () => {
    expect(saveAssessmentsSchema.safeParse(body([component("A", 0)])).success).toBe(false);
    expect(saveAssessmentsSchema.safeParse(body([component("A", -5)])).success).toBe(false);
    expect(saveAssessmentsSchema.safeParse(body([component("A", 1001)])).success).toBe(false);
    expect(saveAssessmentsSchema.safeParse(body([component("A", 10.123)])).success).toBe(false);
    expect(saveAssessmentsSchema.safeParse(body([component("A", null)])).success).toBe(false);
  });
  it("rejects an empty list and more than 15 components", () => {
    expect(saveAssessmentsSchema.safeParse(body([])).success).toBe(false);
    const many = Array.from({ length: 16 }, (_, i) => component(`C${i}`));
    expect(saveAssessmentsSchema.safeParse(body(many)).success).toBe(false);
  });
});
describe("attainmentSettingsSchema", () => {
  const valid = {
    courseFileId: "cf",
    studentLevel3MinPercent: 50,
    studentLevel2MinPercent: 45,
    courseLevel3MinPercent: 70,
    courseLevel2MinPercent: 65,
    absentAsZero: true,
    confirmed: false,
    coWeights: [
      { courseOutcomeId: "a", weightPercent: 35 },
      { courseOutcomeId: "b", weightPercent: 40 },
      { courseOutcomeId: "c", weightPercent: 25 },
    ],
  };
  it("accepts the HCI workbook defaults", () => {
    expect(attainmentSettingsSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts a course file with no outcomes yet", () => {
    expect(attainmentSettingsSchema.safeParse({ ...valid, coWeights: [] }).success).toBe(true);
  });
  it("requires the student Level 2 minimum to be lower than Level 3", () => {
    const result = attainmentSettingsSchema.safeParse({ ...valid, studentLevel2MinPercent: 50 });
    expect(result.success).toBe(false);
    expect(message(result)).toMatch(/Level 2 minimum must be lower/);
  });
  it("requires the course Level 2 target to be lower than Level 3", () => {
    const result = attainmentSettingsSchema.safeParse({ ...valid, courseLevel2MinPercent: 75 });
    expect(result.success).toBe(false);
    expect(message(result)).toMatch(/Level 2 target must be lower/);
  });
  it("requires the CO weights to add up to 100 percent", () => {
    const result = attainmentSettingsSchema.safeParse({
      ...valid,
      coWeights: [
        { courseOutcomeId: "a", weightPercent: 50 },
        { courseOutcomeId: "b", weightPercent: 40 },
      ],
    });
    expect(result.success).toBe(false);
    expect(message(result)).toMatch(/add up to 100%\. They add up to 90%/);
  });
  it("keeps percentages between 0 and 100, with at most 2 decimals, and rejects NaN", () => {
    for (const bad of [101, -1, Number.NaN, 45.123]) {
      expect(attainmentSettingsSchema.safeParse({ ...valid, studentLevel2MinPercent: bad }).success).toBe(false);
    }
  });
});

describe("saveAssessmentsSchema: component weights", () => {
  const body = (outcomeWeights) => ({
    courseFileId: "cf",
    components: [{ id: null, name: "Lab-1", maxMarks: 30, courseOutcomeIds: ["a"], outcomeWeights }],
  });
  it("accepts weights in percent, including empty ones", () => {
    expect(saveAssessmentsSchema.safeParse(body({ a: 40 })).success).toBe(true);
    expect(saveAssessmentsSchema.safeParse(body({ a: null })).success).toBe(true);
    expect(saveAssessmentsSchema.safeParse(body(undefined)).success).toBe(true);
  });
  it("rejects weights outside 0 to 100 or with more than 2 decimals", () => {
    for (const bad of [-1, 120, 33.333]) {
      expect(saveAssessmentsSchema.safeParse(body({ a: bad })).success).toBe(false);
    }
  });
});
