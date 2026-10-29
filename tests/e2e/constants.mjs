// Accounts that exist only in the throw-away test database.
// This password is not used anywhere else.
export const PASSWORD = "E2e-Test-Password-1";

export const USERS = {
  admin: { email: "e2e-admin@test.local", name: "E2E Admin", role: "ADMIN" },
  coordinator: { email: "e2e-coordinator@test.local", name: "E2E Coordinator", role: "COORDINATOR" },
  teacher1: { email: "e2e-teacher1@test.local", name: "E2E Teacher One", role: "CO_TEACHER" },
  teacher2: { email: "e2e-teacher2@test.local", name: "E2E Teacher Two", role: "CO_TEACHER" },
  lockme: { email: "e2e-lockme@test.local", name: "E2E Lock Me", role: "CO_TEACHER" },
};
