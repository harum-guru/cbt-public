# Security Specification & Payload-First TDD — UjianKu

## 1. Data Invariants
1. **Strict RBAC & Self-Registration Guard**: Users may self-register only as `teacher` or `student`. Self-assigning `role: "admin"` is strictly denied unless the verified email matches the bootstrapped admin (`harumwibowo83@guru.sma.belajar.id`).
2. **Account Status Integrity**: Users cannot change their own `role`, `status`, `approvedBy`, or `suspendedReason`. Inactive/suspended accounts cannot read or write classes, exams, or attempts.
3. **Answer Key Isolation**: `exams/{examId}/answerKeys/{questionId}` is never readable by students during an `in_progress` attempt, and is never readable by Admin accounts (to preserve exam integrity per PRD). Students may read `answerKeys` only after their attempt is `submitted` AND either `resultsReleased == true` or `resultsPolicy == "answers_immediate"`.
4. **Immutable Exam Questions After Attempts**: Once `attemptCount > 0` on an exam, the teacher cannot modify or delete questions in `questions`, except updating `voided` for problematic question handling (GRD-4).
5. **Terminal Attempt Locking**: Once `attempts/{attemptId}.status` becomes `"submitted"`, the student can never modify `answers`, `status`, or `submittedAt`. Students cannot write or spoof `score`, `maxScore`, `percentage`, `passed`, `correctCount`, or `gradedAt` at any time.
6. **Append-Only Audit & Proctoring Logs**: `auditLogs` and `attempts/{attemptId}/events` cannot be updated or deleted by clients.
7. **PII Isolation & Zero Blanket List**: `users` documents (containing `email`) are readable only by the document owner or Admin. `allow list` rules always enforce `resource.data` predicates with zero `get()`/`exists()` calls.
8. **Path Variable & Payload Bounds**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128` chars) and every string/array enforces strict `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Privilege Escalation on Registration**: `POST /users/{uid}` with `{ role: "admin", status: "active" }` by non-admin user -> `PERMISSION_DENIED`.
2. **Self-Approval Attack**: `PATCH /users/{uid}` by `pending_approval` teacher setting `{ status: "active" }` -> `PERMISSION_DENIED`.
3. **Ghost Field Shadow Update**: `PATCH /users/{uid}` with `{ displayName: "Budi", isSuperAdmin: true }` -> `PERMISSION_DENIED` (blocked by `affectedKeys().hasOnly(...)`).
4. **Email Spoofing Attack**: Request with matching admin email where `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
5. **PII Blanket Read**: Student `get` or `list` on `/users` or another student's `/users/{otherUid}` -> `PERMISSION_DENIED`.
6. **Answer Key Leak During Exam**: Enrolled student with `in_progress` attempt reading `/exams/{examId}/answerKeys/{qId}` -> `PERMISSION_DENIED`.
7. **Admin Answer Key Read**: Admin reading `/exams/{examId}/answerKeys/{qId}` -> `PERMISSION_DENIED`.
8. **Score Spoofing by Student**: Student creating or updating `/exams/{examId}/attempts/{attemptId}` with `{ score: 100, percentage: 100, passed: true }` -> `PERMISSION_DENIED`.
9. **Post-Submit Answer Tampering**: Student updating `answers` on `/exams/{examId}/attempts/{attemptId}` when `existing().status == "submitted"` -> `PERMISSION_DENIED`.
10. **Deadline Bypass**: Student updating `answers` on `/exams/{examId}/attempts/{attemptId}` when `request.time > existing().deadline` -> `PERMISSION_DENIED`.
11. **Proctoring Log Deletion**: Student deleting or editing `/exams/{examId}/attempts/{attemptId}/events/{eventId}` -> `PERMISSION_DENIED`.
12. **Resource Poisoning / ID Injection**: Writing document with 200KB string or invalid path ID `../admin` -> `PERMISSION_DENIED`.
