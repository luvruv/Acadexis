# Coding Module and Test Case Submission

**Project Title:** Acadexis – Academic Course File & Documentation Management System  
**Institution:** BML Munjal University (School of Engineering & Technology)  
**Course:** Software Engineering (SEM V)  
**Submission:** Coding Module & Test Case Specification (Equally Divided in 4 Parts)  
**Test Framework:** Vitest v5.0.5 (14 Test Suites, 179 Unit Tests Passing – 100% Pass Rate)  

---

## 1. Project Overview & Architecture

Acadexis is a full-stack academic compliance and course-file automation platform designed to eliminate manual paper compilation of ABET/NBA course files. Built with Next.js, React, Tailwind CSS, PostgreSQL, and Prisma, it handles:
* Role-based user authentication (Admin, Course Coordinator, Co-Teacher).
* Multi-faculty collaborative section assignment and review workflows.
* Automated CO, PO, and PSO direct attainment calculations matching institutional rubrics.
* Maitri ERP Excel/CSV student marks import and column mapping.
* Tamper-evident official document issuance with unique alphanumeric Document IDs (`ACX-...`), cryptographic SHA-256 verification, and BMU-formatted DOCX/PDF export.

---

## 2. Test Case Format Standard

In strict accordance with the evaluation guidelines:

| Field | Description |
| :--- | :--- |
| **Test Case ID** | Unique Identifier (e.g., `TC_P1_01`, `TC_P2_01`) |
| **Test Case Description** | Functionality / test scenario being verified |
| **Input** | Input data or trigger conditions provided to the module |
| **Expected Output** | Expected result / system response |
| **Actual Output** | Result obtained after execution |
| **Status** | Pass / Fail |

---

## 3. Equal Module Division (4 Team Members)

The project coding modules are equally divided into 4 parts, with **each person responsible for one core module containing 6 comprehensive test cases** (24 total test cases, well exceeding the requirement of at least 4 test cases per student):

* **Part 1 (Person 1):** User Authentication, Role Authorization (RBAC) & Security Audit Trail
* **Part 2 (Person 2):** Course Setup, Section Assignment & Review Workflow State Machine
* **Part 3 (Person 3):** Direct Assessment, Maitri ERP Parser & CO-PO-PSO Attainment Engine
* **Part 4 (Person 4):** Attachment Security, Section Deadlines & Official BMU Document Export

---

# PART 1 (PERSON 1): Authentication, Role Permissions & Security Audit Trail

* **Contributor / Student:** Student 1 (Person 1)
* **Assigned Coding Module:** User Authentication, Session Management, Role Authorization Guards & System Audit Logging
* **Key Source Files:** `src/app/login/`, `src/lib/auth.js`, `src/lib/permissions.js`, `src/lib/audit.js`, `src/lib/login-throttle.js`, `src/app/(app)/admin/audit/`
* **Automated Unit Test Suite:** `tests/unit/validation.test.js` (23 tests passing)
* **Terminal Test Command:**
  ```powershell
  npx vitest run tests/unit/validation.test.js
  ```

### Test Cases Table (Person 1)

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_P1_01** | User login with valid university credentials | Valid email (`coordinator@acadexis.local`), correct password (`luvruv22`) | User authenticated, NextAuth session token issued, redirected to `/dashboard` | User logged in successfully, session active, redirected to coordinator dashboard | **Pass** |
| **TC_P1_02** | User login rejection on invalid password | Valid email (`coordinator@acadexis.local`), incorrect password (`WrongPass!`) | Error message `"Invalid email or password."` displayed; failed attempt logged | Form displays `"Invalid email or password."`; `LOGIN_FAILED` audit entry logged | **Pass** |
| **TC_P1_03** | Form validation on empty login inputs | Blank inputs: `email: ""`, `password: ""` | Form submission blocked with required field prompt | Client HTML5/Zod schema validation prevents submission; highlights empty inputs | **Pass** |
| **TC_P1_04** | Brute-force account lockout protection | 5 consecutive invalid login attempts on same account | Account temporarily locked; displays error `"Too many failed attempts. Try again in 15 minutes."` | Lockout triggered; warning message displayed; `LOGIN_BLOCKED` audit logged with client IP | **Pass** |
| **TC_P1_05** | Role-based route authorization guard | Authenticated user with `CO_TEACHER` role attempts to access `/admin/audit` | Access denied; user redirected to unauthorized page with 403 Forbidden | Request blocked by `requireRole(ROLES.ADMIN)`; unauthorized redirect issued | **Pass** |
| **TC_P1_06** | Audit log multi-parameter filtering | Admin filters audit logs by action `DOCUMENT_EXPORTED` and date range `2026-10-01` to `2026-10-31` | Log table renders only matching audit records within date bounds | Table filtered strictly to matching `DOCUMENT_EXPORTED` events | **Pass** |

---

# PART 2 (PERSON 2): Course Setup, Multi-Teacher Assignment & Review Workflow

* **Contributor / Student:** Student 2 (Person 2)
* **Assigned Coding Module:** Course File Lifecycle, Contributor Delegation, Section Forms & Approval State Machine
* **Key Source Files:** `src/lib/sections.js`, `src/lib/course-file-status.js`, `src/lib/lock.js`, `src/app/(app)/coordinator/course-files/[id]/assignments-table.jsx`, `src/app/(app)/teacher/`
* **Automated Unit Test Suites:** `tests/unit/workflow.test.js`, `tests/unit/section-forms.test.js`, `tests/unit/course-description.test.js` (34 tests passing)
* **Terminal Test Command:**
  ```powershell
  npx vitest run tests/unit/workflow.test.js tests/unit/section-forms.test.js tests/unit/course-description.test.js
  ```

### Test Cases Table (Person 2)

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_P2_01** | Section delegation to co-teacher | Coordinator assigns Section 2 (Course Syllabus) to `Demo Teacher One` | Section assignment persisted in database; visible on teacher's assigned tasks page | Section successfully assigned to `teacher1@acadexis.local`; table reflects assignee name | **Pass** |
| **TC_P2_02** | Contributor section draft submission | Assigned teacher completes syllabus details and clicks "Submit for Review" | Section status transitions from `DRAFT` to `SUBMITTED`; notification alert dispatched | Section status updated to `SUBMITTED`; section editing locked for contributor | **Pass** |
| **TC_P2_03** | Coordinator approval of submitted section | Coordinator clicks "Approve" on submitted section with optional remarks | Section status transitions from `SUBMITTED` to `APPROVED` | Status updated to `APPROVED`; green approval badge displayed on dashboard | **Pass** |
| **TC_P2_04** | Coordinator requests changes on section | Coordinator enters feedback `"Please add lab reference links"` and clicks "Request Changes" | Section status changes to `CHANGES_REQUESTED`; reopened for contributor editing | Section marked `CHANGES_REQUESTED`; review comments displayed to teacher | **Pass** |
| **TC_P2_05** | Prevent course file locking with pending sections | Coordinator attempts to lock course file while Section 4 is still `PENDING` | Lock rejected; returns list of lock blockers: `["Section 4: Not approved"]` | Lock action blocked; UI modal lists incomplete mandatory sections | **Pass** |
| **TC_P2_06** | Course file locking upon complete approvals | Coordinator locks course file when all mandatory sections are `APPROVED` | Course file status changes to `LOCKED`; freeze all sections against editing | Course file locked successfully; `status = LOCKED`; unblock export action | **Pass** |

---

# PART 3 (PERSON 3): Direct Assessment, Maitri ERP Parser & Attainment Engine

* **Contributor / Student:** Student 3 (Person 3)
* **Assigned Coding Module:** Maitri ERP Marks Import, CO-PO-PSO Attainment Rubrics & Assessment Engine
* **Key Source Files:** `src/lib/attainment.js`, `src/lib/attainment-method.js`, `src/lib/attainment-po.js`, `src/lib/maitri.js`, `src/lib/validation/marks.js`, `src/app/(app)/coordinator/course-files/[id]/sections/13/`
* **Automated Unit Test Suites:** `tests/unit/attainment.test.js`, `tests/unit/attainment-method.test.js`, `tests/unit/attainment-po.test.js`, `tests/unit/maitri.test.js` (48 tests passing)
* **Terminal Test Command:**
  ```powershell
  npx vitest run tests/unit/attainment.test.js tests/unit/attainment-method.test.js tests/unit/attainment-po.test.js tests/unit/maitri.test.js
  ```

### Test Cases Table (Person 3)

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_P3_01** | Parse and import marks from Maitri ERP file | TSV/CSV marks paste/file with columns (Roll No, Student Name, Quiz, Mid-Term) | Automatically detects delimiters, maps student enrollment numbers and marks | Successfully parses student rows and maps marks into component grid | **Pass** |
| **TC_P3_02** | Mark boundary validation against component maximum | Entering mark `25` for Quiz component with `maxMarks = 20` | Input rejected with validation error: `"Mark cannot exceed maximum marks (20)."` | Validation error triggered by `parseMarkValue()`; cell highlighted in red | **Pass** |
| **TC_P3_03** | Handling absent student evaluation in cohort | Student mark entry recorded as `"AB"` | Absent student counted as 0 marks; included in total assessed without crashing | Student included in assessed cohort (attained: `false`); percentages calculated | **Pass** |
| **TC_P3_04** | Direct CO attainment level classification | Attainment score evaluated: `<50%`, `50-59%`, `60-69%`, `≥70%` | Classified into Level 0 (Unattained), Level 1 (Slight), Level 2 (Moderate), Level 3 (Substantial) | Returns exact attainment level (Level 0, 1, 2, or 3) matching BMU criteria | **Pass** |
| **TC_P3_05** | Department attainment method & CO weight verification | User sets CO weights for CO1..CO5 summing to `100%` | Attainment engine computes overall course attainment as weighted sum | Attainment engine accepts `100%` total weight; computes weighted overall target level | **Pass** |
| **TC_P3_06** | PO and PSO correlation matrix attainment mapping | CO attainments combined with 1-3 correlation weights in CO-PO/PSO matrix | Computes correlation-weighted average for PO1..PO12 and PSO1..PSO2 | PO and PSO attainment table computed and populated dynamically | **Pass** |

---

# PART 4 (PERSON 4): Attachment Security, Section Deadlines & Document Export

* **Contributor / Student:** Student 4 (Person 4)
* **Assigned Coding Module:** Magic Byte Upload Verification, Section Deadlines/Cron, Official BMU DOCX/PDF Export & Document IDs
* **Key Source Files:** `src/lib/uploads.js`, `src/lib/dates.js`, `src/lib/reminder-message.js`, `src/lib/document-id.js`, `src/lib/docx/`, `src/lib/storage.js`, `src/lib/export-service.js`
* **Automated Unit Test Suites:** `tests/unit/uploads.test.js`, `tests/unit/dates.test.js`, `tests/unit/document-id.test.js`, `tests/unit/docx.test.js`, `tests/unit/annexures.test.js`, `tests/unit/storage.test.js` (74 tests passing)
* **Terminal Test Command:**
  ```powershell
  npx vitest run tests/unit/uploads.test.js tests/unit/dates.test.js tests/unit/document-id.test.js tests/unit/docx.test.js tests/unit/annexures.test.js tests/unit/storage.test.js
  ```

### Test Cases Table (Person 4)

| Test Case ID | Test Case Description | Input | Expected Output | Actual Output | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_P4_01** | Magic byte binary validation on file upload | Upload genuine PDF with `%PDF-1.7` magic byte header | Returns `{ ok: true, mimeType: "application/pdf" }`; file accepted | File binary signature verified; accepted and saved to storage | **Pass** |
| **TC_P4_02** | Detect and reject fake renamed file extensions | Text file containing `"hello"` or executable renamed to `syllabus.pdf` | Upload rejected: `"File content does not match extension."` | Magic byte mismatch detected; file upload rejected immediately | **Pass** |
| **TC_P4_03** | Filename path traversal sanitization | File uploaded with hostile name `../../secret/passwords.pdf` | Filename sanitized strictly to basename `passwords.pdf` | Sanitizer strips path traversal sequences; saves under safe filename | **Pass** |
| **TC_P4_04** | Section completion deadline & reminder alert | Coordinator sets section due date within 3 days | System generates reminder alert: `"Reminder: Section 2 \"Course Syllabus\" is due on <date>."` | Reminder created; notification bell badge updated on assignee's top navbar | **Pass** |
| **TC_P4_05** | Unambiguous official Document ID generation | Course: `CSE3005`, Year: `2026-27`, Sem: `5`, Rev: `1` | Produces format `ACX-CSE3005-2026-27-S5-R1-XXXX` excluding look-alike characters (`0, O, 1, I, L`) | Generates unambiguous verified ID (e.g., `ACX-CSE3005-2026-27-S5-R1-K7QD`) | **Pass** |
| **TC_P4_06** | Official BMU course file export with annexures | Coordinator requests export for locked course file with PDF question paper annexures | Generates BMU DOCX and PDF, appends annexures within 500-page limit, calculates SHA-256 hash | Document generated, SHA-256 hash stored in DB, status updated to `EXPORTED` | **Pass** |

---

## 4. Overall Test Execution Summary

```
Total Test Suites Executed:    14 Suites
Total Automated Unit Tests:   179 Passing (100% Pass Rate)
Execution Time:                1.48 seconds
Test Runner:                  Vitest v5.0.5
Documented Test Scenarios:     24 Test Cases (Equally 6 per person across 4 parts)
Verdict:                       ALL TESTS PASSED (0 Failures)
```

---

## 5. Live Demonstration Guide for Teacher Evaluation

### A. Terminal Commands Demonstration

Run these commands in PowerShell inside the project directory (`c:\Users\jaind\SEM V\SE\acadexis`):

1. **Demonstrate All Tests Running (Complete Project):**
   ```powershell
   npm test
   ```
   *Expected Output:* `14 passed (14)`, `179 passed (179)`, Duration ~1.5s.

2. **Person 1 Individual Demo:**
   ```powershell
   npx vitest run tests/unit/validation.test.js
   ```

3. **Person 2 Individual Demo:**
   ```powershell
   npx vitest run tests/unit/workflow.test.js tests/unit/section-forms.test.js tests/unit/course-description.test.js
   ```

4. **Person 3 Individual Demo:**
   ```powershell
   npx vitest run tests/unit/attainment.test.js tests/unit/attainment-method.test.js tests/unit/attainment-po.test.js tests/unit/maitri.test.js
   ```

5. **Person 4 Individual Demo:**
   ```powershell
   npx vitest run tests/unit/uploads.test.js tests/unit/dates.test.js tests/unit/document-id.test.js tests/unit/docx.test.js tests/unit/annexures.test.js tests/unit/storage.test.js
   ```

---

### B. Localhost Web UI Demonstration

1. **Start the Development Server:**
   ```powershell
   npm run dev
   ```
   Open your web browser at **`http://localhost:3000`**.

2. **Demo User Accounts (Configured in Project):**
   * **Admin:** `admin@acadexis.local` | Password: `luvruv22`
   * **Course Coordinator:** `coordinator@acadexis.local` | Password: `luvruv22`
   * **Co-Teacher 1:** `teacher1@acadexis.local` | Password: `luvruv22`
   * **Co-Teacher 2:** `teacher2@acadexis.local` | Password: `luvruv22`

3. **Walkthrough by Person:**
   * **Person 1:** Navigate to `http://localhost:3000/login`. Demonstrate invalid password error, empty field rejection, and login as Admin to showcase the `/admin/audit` log filter view.
   * **Person 2:** Log in as Coordinator (`coordinator@acadexis.local`). Open a Course File, assign Section 2 to `teacher1@acadexis.local`. Log in as `teacher1` to submit it, then return to Coordinator to Approve or Request Changes. Show the Lock button checking for incomplete sections.
   * **Person 3:** In the course file, navigate to **Section 13 (Direct CO Attainment)**. Demonstrate the Maitri ERP import table, paste marks, verify that absent students (`AB`) are computed, and show the automatic calculation of CO levels (0, 1, 2, 3) and PO/PSO attainment matrices.
   * **Person 4:** Demonstrate setting a Section Due Date to trigger the in-app reminder bell badge. Lock the course file, navigate to the **Export** tab, click **Export Official Document**, and show the generated Document ID (`ACX-...`), the SHA-256 hash, and download the compiled DOCX/PDF file.
