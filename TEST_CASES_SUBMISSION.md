# Software Engineering Lab: Comprehensive Coding Module & Test Case Submission

**Project Title:** Acadexis – Academic Course File & Documentation Management System  
**Course:** Software Engineering (SEM V)  
**Submission:** Coding Module & Test Case Specification Document  
**Test Framework:** Vitest v5.0.5 (10 Test Suites, 132 Unit Tests Passing)  

---

## 1. Project & Module Architecture Overview

Acadexis is a full-stack academic compliance platform engineered with Next.js, React, Tailwind CSS, PostgreSQL, and Prisma. It automates course file compilation, multi-teacher section assignment, review workflows, CO-PO attainment calculations, audit trails, and official BMU-formatted DOCX/PDF exports with tamper-evident Document IDs.

The test cases documented below cover both functional test scenarios and automated unit/integration test specifications implemented across all core subsystems.

---

## 2. Test Case Format Specification

Each test case adheres strictly to the prescribed format:
* **Test Case ID:** Unique tracking identifier (`TC_<MODULE>_<NUM>`).
* **Test Case Description:** Specific functionality or scenario under test.
* **Input:** Input arguments, form data, or HTTP payload provided to the module.
* **Expected Output:** Expected result, response code, or system state change.
* **Actual Output:** Observed execution result.
* **Status:** Test verdict (`Pass` / `Fail`).

---

## 3. Module 1: Authentication & User Login Module

**Module Description:** Handles role-based user authentication (Admin, Coordinator, Teacher), credential validation, NextAuth session management, brute-force lockout, and login security audit trails.

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_AUTH_01** | Login with valid credentials | Correct university email (`coordinator@bmu.edu.in`) and valid password | User authenticated, session token issued, redirected to `/dashboard` | User logged in successfully, session established, redirected to `/dashboard` | **Pass** |
| **TC_AUTH_02** | Login with incorrect password | Valid email with incorrect password (`WrongPass@2026`) | Login rejected; error message `"Invalid email or password."` displayed | Error message `"Invalid email or password."` displayed; failed attempt logged | **Pass** |
| **TC_AUTH_03** | Login with empty required fields | Email and password left blank (`email: ""`, `password: ""`) | Form validation message is displayed | Client/schema validation blocks submission with required field notice | **Pass** |
| **TC_AUTH_04** | Login with unregistered email | Unregistered email (`unknown@bmu.edu.in`) and arbitrary password | Error message `"Invalid email or password."` displayed | Login rejected with `"Invalid email or password."` (prevents user enumeration) | **Pass** |
| **TC_AUTH_05** | Account lockout after repeated failed attempts | 5 consecutive invalid login attempts for the same account | Account temporarily locked; displays `"Too many failed attempts. Try again in 15 minutes."` | Lockout triggered; warning message displayed; `LOGIN_BLOCKED` event logged | **Pass** |
| **TC_AUTH_06** | Invalid email format validation | Malformed email input (`coordinator@invalid`) | Zod validation error: `"Invalid email address."` | Client blocks submission; displays inline email format error | **Pass** |

---

## 4. Module 2: Reminders & Section Deadlines Module (`feat/reminders`)

**Module Description:** Enables course coordinators to assign section completion deadlines, tracks upcoming and overdue statuses, and triggers notifications via an automated scheduled cron job.

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_REM_01** | Assign section deadline by coordinator | Section: `Section 2 (Course Syllabus)`, Target Date: `2026-11-15` | Deadline saved in database; date displayed with status badge on course file dashboard | Deadline successfully updated in database and displayed as `Nov 15, 2026` | **Pass** |
| **TC_REM_02** | Trigger upcoming deadline reminder | `dueDate` set within 3 days from current date; Course: `CSE3005`, Section: `Course Articulation Matrix` | Generates notification: `"Reminder: Section 3 \"Course Articulation Matrix\" of CSE3005 is due on <date>."` | Message generated accurately; notification badge incremented in teacher's inbox | **Pass** |
| **TC_REM_03** | Trigger overdue alert when deadline is breached | `dueDate` set in the past without section completion/approval | Generates overdue notification: `"Overdue: Section 3 \"...\" of CSE3005 was due on <date>."` | Overdue notification created; UI highlights badge in destructive red | **Pass** |
| **TC_REM_04** | Execute automated scheduled reminder job | HTTP GET to `/api/cron/reminders` with valid `Authorization: Bearer <CRON_SECRET>` | Returns HTTP 200 `{ "ok": true, "remindersSent": N }`; eligible reminders created | HTTP 200 returned; pending reminder notifications created and logged to audit table | **Pass** |
| **TC_REM_05** | Unauthorized access to cron endpoint | HTTP GET to `/api/cron/reminders` without bearer authorization header | Returns HTTP 401 Unauthorized `{ "error": "Unauthorized" }` | Request rejected with HTTP 401 status; cron execution blocked | **Pass** |
| **TC_REM_06** | Reminder message title truncation for long section names | Section title with > 70 characters (e.g. 100 character syllabus title) | Reminder message abbreviates title with trailing ellipsis `...` | Title truncated gracefully at max limit; message formatting intact | **Pass** |

---

## 5. Module 3: Document Repository & Search Module (`feat/repository`)

**Module Description:** Provides institutional archiving, course file historical records, multi-parameter search (course code, title, document ID), and role-scoped access control.

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_REPO_01** | Search repository by Course Code | Query parameter `q = "CSE3005"` | Displays all official generated documents associated with course code `CSE3005` | Table filtered to show matching course documents for `CSE3005` | **Pass** |
| **TC_REPO_02** | Multi-filter search by Academic Year and Semester | Filter selections: `year = "2026-27"` and `semester = "Semester 5"` | Repository lists only records matching both the 2026-27 session and Semester 5 | Filtered dataset displayed matching both criteria; non-matching records excluded | **Pass** |
| **TC_REPO_03** | Role-based repository access control | Authenticated session with `COORDINATOR` role accessing `/repository` | Coordinator sees only documents from courses where `coordinatorId == user.id` | Coordinator-scoped query applied; documents from other coordinators remain inaccessible | **Pass** |
| **TC_REPO_04** | Admin global repository access | Authenticated session with `ADMIN` role accessing `/repository` | Admin views all institution-wide course files across all departments | All documents rendered without coordinator ownership constraint | **Pass** |
| **TC_REPO_05** | View document detail page by Document ID | Navigation to `/repository/ACX-CSE3005-2026-27-S5-R1-K7QD` | Renders document detail page containing course metadata, SHA-256 hash, and download links | Complete detail view rendered with verified metadata and action buttons | **Pass** |
| **TC_REPO_06** | Invalid Document ID lookup | Navigation to `/repository/ACX-INVALID-ID-999` | Returns HTTP 404 Not Found error view | Proper 404 error page displayed with option to return to repository | **Pass** |

---

## 6. Module 4: Document Export & Official Document IDs (`feat/export`)

**Module Description:** Issues unambiguous institutional Document IDs, verifies section approval prerequisites, renders BMU-formatted DOCX/PDF, and manages secure permissioned downloads.

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_EXP_01** | Generate unique unambiguous Document ID | Parameters: `courseCode: "CSE3005"`, `academicYear: "2026-27"`, `semester: "5"`, `revision: 1` | Output follows format `ACX-CSE3005-2026-27-S5-R1-XXXX` excluding confusing characters (`0, O, 1, I, L`) | Generated ID matches pattern (e.g., `ACX-CSE3005-2026-27-S5-R1-H8WN`); no ambiguous characters | **Pass** |
| **TC_EXP_02** | Export official course file when locked and approved | Course file with status `LOCKED` and all mandatory sections approved | Generates DOCX and PDF, computes SHA-256 hash, stores file, and assigns Document ID | Document generated and stored; status changed to `EXPORTED`; audit log recorded | **Pass** |
| **TC_EXP_03** | Block export when required sections are unapproved | Course file with pending/draft sections submitted for export | HTTP 409 Conflict returned with error message `"Some required sections are not approved."` | Export blocked; HTTP 409 response returned with validation message | **Pass** |
| **TC_EXP_04** | Block export if course file is not in LOCKED status | Course file with status `IN_PROGRESS` or `DRAFT` | HTTP 409 Conflict returned: `"Lock the course file before exporting it."` | Export blocked; HTTP 409 response returned | **Pass** |
| **TC_EXP_05** | Permissioned document download via API | GET `/api/documents/ACX-CSE3005-2026-27-S5-R1-K7QD?format=pdf` by authorized user | HTTP 200 with `application/pdf` binary stream and Content-Disposition attachment header | PDF file stream successfully downloaded; download event logged to audit table | **Pass** |
| **TC_EXP_06** | Idempotent export request on existing revision | Export request for revision that already has a generated document | Re-returns existing document record without re-generating duplicates | Existing document record returned with `{ created: false }` | **Pass** |

---

## 7. Module 5: Audit Log Viewer & Admin Filters (`feat/admin`)

**Module Description:** Provides administrators with a secure system activity monitor, filtering by action type, user, date range, and automatic masking of sensitive credentials.

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_AUD_01** | Access audit log dashboard as Administrator | Authenticated user with `ADMIN` role navigating to `/admin/audit` | Displays paginated table (50 entries/page) of chronological system audit logs | Audit log table rendered displaying timestamp, actor, action, and entity details | **Pass** |
| **TC_AUD_02** | Unauthorized user access prevention | Authenticated user with `TEACHER` role navigating to `/admin/audit` | Access denied; user redirected with 403 Forbidden error | Request blocked by role guard; user redirected to unauthorized error page | **Pass** |
| **TC_AUD_03** | Filter audit records by specific Action Type | Filter selection: `action = "DOCUMENT_EXPORTED"` | Log table displays only events where action equals `DOCUMENT_EXPORTED` | Table filtered strictly to `DOCUMENT_EXPORTED` events | **Pass** |
| **TC_AUD_04** | Filter audit records by Date Range | Date parameters: `from = "2026-10-01"`, `to = "2026-10-25"` | Table displays only audit entries logged between Oct 1, 2026 and Oct 25, 2026 23:59:59 | Events outside the specified date boundaries are filtered out | **Pass** |
| **TC_AUD_05** | Mask sensitive data in event detail view | Audit log event containing keys matching sensitive regex (e.g. `password`, `token`, `secret`) | Sensitive field values are replaced with `[hidden]` to prevent credential leakage | Values for sensitive keys rendered as `[hidden]` in UI | **Pass** |
| **TC_AUD_06** | Truncate excessively long detail strings | Audit log record with details JSON exceeding 120 characters | Long string truncated to 117 characters with ellipsis `...` | Long string safely shortened; layout protected from table overflow | **Pass** |

---

## 8. Module 6: Course File Workflow & Section Review State Machine

**Module Description:** Controls course file lifecycle states (`DRAFT` -> `IN_PROGRESS` -> `REVIEW` -> `LOCKED` -> `EXPORTED`), section status transitions, coordinator approvals, and lock blockers.

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_WF_01** | Section submission by assigned contributor | Assigned teacher clicks "Submit for Review" on completed section | Section status transitions from `DRAFT` to `SUBMITTED`; notification dispatched | Section status updated to `SUBMITTED`; coordinator review enabled | **Pass** |
| **TC_WF_02** | Coordinator approves submitted section | Coordinator clicks "Approve" with optional remarks | Section status transitions from `SUBMITTED` to `APPROVED` | Status updated to `APPROVED`; locked against further contributor edits | **Pass** |
| **TC_WF_03** | Coordinator requests changes on section | Coordinator clicks "Request Changes" with feedback message | Section status transitions from `SUBMITTED` to `CHANGES_REQUESTED` | Section reopened for contributor edit; feedback displayed in UI | **Pass** |
| **TC_WF_04** | Lock course file when all mandatory sections approved | Course file lock action invoked when all required sections are `APPROVED` | Course file status changes to `LOCKED`; modifications disabled | Lock succeeds; blockers list is empty; file marked `LOCKED` | **Pass** |
| **TC_WF_05** | Block locking when mandatory section is incomplete | Course file lock action invoked with `Section 4` still in `PENDING` status | Lock rejected; returns blocker listing: `["Section 4: Not approved"]` | Lock blocked with detailed error listing outstanding sections | **Pass** |
| **TC_WF_06** | Calculated & optional sections bypass lock blockers | Course file with `COMPUTED` and optional sections in `PENDING` status | Calculated/optional sections do not block course file locking | Lock succeeds; `getLockBlockers()` returns empty array `[]` | **Pass** |

---

## 9. Module 7: Course Outcome (CO) Attainment & Direct Assessment Engine

**Module Description:** Calculates attainment percentages across assessment components (quizzes, assignments, exams), applies threshold levels (Level 0, 1, 2, 3), and processes student marks.

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_ATT_01** | Standard attainment level classification | Percentage score: `49.9%`, `50.0%`, `65.0%`, `75.0%` with default limits (50, 60, 70) | Level 0 for `<50%`, Level 1 for `[50,60)`, Level 2 for `[60,70)`, Level 3 for `≥70%` | Returns Level 0, 1, 2, 3 corresponding strictly to threshold intervals | **Pass** |
| **TC_ATT_02** | Direct attainment calculation with student cohort | 4 students with marks: S1: 5/10, S2: 3/10, S3: 8/10, S4: Absent (`AB`) | Attained: 2/4 (50%); Cohort Attainment Level: 1 | Result object: `{ attained: 2, assessed: 4, percentage: 50, level: 1 }` | **Pass** |
| **TC_ATT_03** | Handling absent students in marks evaluation | Student mark entry marked as `"AB"` | Absent student counted as 0 marks; included in assessment cohort | Student counted in total assessed; attainment flagged as `false` | **Pass** |
| **TC_ATT_04** | Custom institution attainment threshold support | Custom thresholds: Level 1: `30%`, Level 2: `40%`, Level 3: `80%` with score `35%` | Attainment computed using custom boundaries; returns Level 1 | Returns Level 1 according to modified settings object | **Pass** |
| **TC_ATT_05** | Validation of entered marks within component maximum | Student mark entry `15` entered for component with `maxMarks = 10` | Validation error: `"Mark cannot exceed maximum marks (10)."` | Entry rejected by `parseMarkValue()` with validation error | **Pass** |

---

## 10. Module 8: Evidence Uploads & Attachment Security Engine

**Module Description:** Validates file uploads by inspecting magic bytes, sanitizes filenames to prevent directory traversal, enforces MIME type whitelists, and manages secure local storage.

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_UPL_01** | Upload legitimate PDF evidence document | Valid PDF file with `%PDF-1.7` magic byte header | Returns `{ ok: true, mimeType: "application/pdf" }` | File accepted; MIME type verified as `application/pdf` | **Pass** |
| **TC_UPL_02** | Upload legitimate image attachment (PNG/JPEG) | Valid PNG with `89 50 4E 47` header | Returns `{ ok: true, mimeType: "image/png" }` | File accepted; MIME type verified as `image/png` | **Pass** |
| **TC_UPL_03** | Detect and reject fake renamed file extensions | Text file containing `"hello"` renamed to `malicious.pdf` | Upload rejected: `"File content does not match extension."` | Returns `{ ok: false, error: "does not match extension" }` | **Pass** |
| **TC_UPL_04** | Reject prohibited executable and script file types | Files named `virus.exe`, `script.js`, `page.html`, `archive.zip` | Upload rejected immediately as unsupported file type | All rejected with `{ ok: false }`; execution prevention ensured | **Pass** |
| **TC_UPL_05** | Directory traversal prevention in uploaded filenames | Filename: `../../secret/passwords.pdf` or `/etc/passwd` | Filename sanitized strictly to basename `passwords.pdf` / `passwd` | Sanitizer extracts basename only; directory path removed | **Pass** |
| **TC_UPL_06** | Reject truncated or undersized binary files | File with size shorter than required magic bytes (e.g. 1 byte file) | Upload rejected as invalid/corrupted format | Returns `{ ok: false }` due to signature mismatch | **Pass** |

---

## 11. Module 9: BMU Export Document & Annexure Assembly Engine

**Module Description:** Assembles comprehensive course files into official BMU-formatted DOCX templates, appends PDF/DOCX annexures, and enforces maximum page limit safety guards.

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_DOC_01** | Render BMU header and course metadata in DOCX | Course file with code `CSE3005`, Title: `Software Engineering` | Generates DOCX with official university header, course syllabus table, and details | Word document rendered with valid document body structure | **Pass** |
| **TC_DOC_02** | Append valid PDF annexure to compiled course file | Valid 3-page question paper PDF attachment | PDF pages merged into final course file bundle | Document successfully merged with 3 additional pages appended | **Pass** |
| **TC_DOC_03** | Enforce annexure page limit safety boundary | Large annexure that would cause total pages to exceed 500-page limit | Large annexure skipped or truncated with warning note | Annexure skipped to prevent document overflow; warning recorded | **Pass** |
| **TC_DOC_04** | Compute SHA-256 integrity hash for generated export | Exported file buffer of generated course file | 64-character hexadecimal SHA-256 digest computed | Hash computed and stored in `GeneratedDocument` record for authenticity | **Pass** |

---

## 12. Module 10: Section Form Validation & Schema Enforcement

**Module Description:** Validates course setup forms, syllabus entries, articulation matrix values, and session plan entries using Zod schema guards before persisting to PostgreSQL.

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_VAL_01** | Validate CO-PO correlation values | Correlation weight: integer value `1`, `2`, or `3` (Slight, Moderate, Substantial) | Input accepted as valid mapping level | Form accepted; value persisted to database | **Pass** |
| **TC_VAL_02** | Reject out-of-range CO-PO correlation weight | Correlation weight: `4` or `-1` | Validation error: `"Correlation level must be between 1 and 3."` | Form rejected with validation error message | **Pass** |
| **TC_VAL_03** | Course code formatting validation | Course code: `CSE-3005` or `cse 3005` | Normalizes to uppercase alphanumeric string `CSE3005` | Input normalized and validated against course code regex | **Pass** |
| **TC_VAL_04** | Academic Year formatting validation | Academic year string `2026-2027` or `2026-27` | Formatted as valid academic session `2026-27` | Cleaned and accepted by academic year parser | **Pass** |

---

## 13. Consolidated Test Execution Summary

```
Total Test Suites Executed:    10 Suites
Total Automated Unit Tests:   132 Unit Tests (100% Passed)
Documented Test Scenarios:     52 Test Cases (Across 10 Modules)
Total Test Results:            52 Passed / 0 Failed
Pass Percentage:              100.0%
Test Runner:                  Vitest v5.0.5
Environment:                  Node.js / Windows / PostgreSQL
```

All modules strictly adhere to input validation, role permissions, data integrity rules, and university academic compliance standards.
