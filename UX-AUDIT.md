# SmartClearance — UX/Flow Audit

> Last verified: March 15, 2026 — All claims cross-checked against actual codebase.

---

## System Flow

```
/ (Loader 1.2s) → /home → /select-role → /auth → /dashboard
                                        → /super-admin (hidden)
                                        → /reset-password

Signup (Student):  Form → reCAPTCHA → ID Upload + OCR → Selfie → 2FA Setup → Email Verify → Auto-login
Signup (Staff):    Form + Secret Code → reCAPTCHA → 2FA Setup → Email Verify → Auto-login
Login:             Email + Password → Email Check → Session → 2FA (if enabled) → Dashboard

Roles: student | signatory | librarian | cashier | registrar | super_admin
```

---

## Architecture

| Layer | Detail |
|-------|--------|
| Router | React Router, `BrowserRouter` in `main.jsx` |
| Auth | `AuthContext` — session, role, 2FA, idle timeout, `navigateRef` |
| Theme | `ThemeContext` — dark/light/system, persisted |
| API | `api.js` — `apiFetch` (timeout + retry + `response.ok`), `authAxios` (interceptor + 401 redirect) |
| Realtime | `useRealtimeSubscription` hook — Supabase Postgres changes via websocket, 400ms debounce, error handling |
| Idle | `useIdleTimeout` — 15min timeout, 2min warning, 30s throttle |
| Backend Error | `errorHandler.js` — centralized middleware after all routes |
| Validation | `validatePassword.js` — shared utility for both signup routes |
| Constants | `formOptions.js`, `constants/roles.js` (frontend + backend) |

---

## ✅ Done — Verified Working

### Security
- [x] Email verification OTP (6-digit, 10-min expiry, 60s resend cooldown)
- [x] Session timeout / idle logout (15min default, 2min warning)
- [x] `/check-email` — O(1) Postgres function + 200ms constant-time floor
- [x] TOTP key masked by default + reveal toggle with `aria-label`
- [x] 2FA setup authenticated with signup tokens
- [x] `requireAuth` on all protected routes
- [x] `express.json()` body limit 1MB
- [x] CORS restricted via `ALLOWED_ORIGINS`
- [x] Forgot-password returns generic message (no email enumeration)
- [x] Backend signup rollback — cleans up auth user if profile creation fails
- [x] `api.js` — `response.ok` checks, 15s timeout, retry on 502/503/504
- [x] `authAxios` 401 interceptor — auto sign-out + redirect on session expiry

### Auth & Flow
- [x] React Router with deep linking, back button support
- [x] `AuthContext` cleanly separated from `App.jsx` (~130 lines)
- [x] Role mismatch → redirects to `/select-role` (not just sign out)
- [x] `complete2FA` navigates to `/dashboard`
- [x] Auto-login after signup + email verification (session reuse, fallback to manual)
- [x] Password reset redirects to `/auth` with role preserved
- [x] Session restoration on app mount
- [x] `ErrorBoundary` wraps entire app in `main.jsx`
- [x] `last_login` update with silent retry on failure

### Signup & Validation
- [x] Inline blur validation — red borders, animated errors, name filtering
- [x] Email duplicate check with spinner in both signup forms
- [x] Password strength meter + match/mismatch icons
- [x] Student 3-step wizard with back buttons + `sessionStorage` persistence
- [x] Face models load in background, Step 1 immediately usable
- [x] Camera consent pre-screen before selfie
- [x] Face similarity threshold ≥90% for auto-approval
- [x] "Forgot password?" link visible during signup tab
- [x] Backend reCAPTCHA validation (rejects in prod, optional in dev)
- [x] Social login buttons removed (were non-functional)

### Admin & Dashboard
- [x] Super admin hidden at `/super-admin`
- [x] Super admin dashboard — real Supabase data, real profile name
- [x] Super admin Topbar — no fake notifications, no dead buttons
- [x] Super admin "Refresh" button for dashboard stats
- [x] Secret codes CRUD — toggle, copy, delete confirmation, role-scoped
- [x] Search/filter on Librarian, Cashier, Registrar dashboards
- [x] `PendingAccountsView` null safety for `face_similarity`
- [x] `DashboardContent` fallback shows "Unknown role" error
- [x] Comment visibility filtering on `/:clearanceId/comments` GET

### Real-Time Updates
- [x] `useRealtimeSubscription` hook — Supabase Postgres changes via websocket
- [x] Cashier dashboard — live updates on `requests` table changes
- [x] Librarian dashboard — live updates on `requests` table changes
- [x] Registrar dashboard — live updates on `requests` + `profiles` table changes
- [x] SuperAdmin dashboard stats — live updates on `profiles` + `requests` table changes
- [x] `PendingAccountsView` — live updates on `profiles` table changes
- [x] Student dashboard — live clearance status on `requests` + `professor_approvals` changes
- [x] Silent re-fetches (no loading spinner flash) for real-time updates
- [x] 400ms debounce to prevent API spam on rapid-fire changes
- [x] `AnimatePresence` with spring transitions on all request/account lists
- [x] Channel error handling (`CHANNEL_ERROR`, `TIMED_OUT` logged)
- [x] Channel cleanup on component unmount

### Accessibility
- [x] Role selection cards — `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space
- [x] Admin modal — focus trap (Tab cycles within modal, Escape closes + returns focus)
- [x] Admin modal — `role="dialog"`, `aria-modal="true"`, `aria-label`
- [x] 2FA digit inputs — `aria-label="Digit N of 6"` on all inputs (Setup + Verify)
- [x] ID verification progress bar — `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- [x] Loader — `role="status"`, `aria-live="polite"`, `aria-label`, sr-only text
- [x] Loader progress bar — `role="progressbar"` with ARIA value attributes

### Code Quality
- [x] `StudentDashboard.jsx` deleted (was dead file)
- [x] `pendingProfile` removed from `App.jsx`
- [x] Legacy role fallbacks removed from `roleMatchesSelection`
- [x] `handleDrop` stale closure fixed via `handleIDUploadRef` ref
- [x] `idPreview` blob URL revoked on unmount + before new creation
- [x] `SelfieCapture` cleans up camera stream on unmount
- [x] `TwoFactorVerify` clears all timers on unmount
- [x] Centralized error handler middleware
- [x] Shared password validation utility
- [x] Role architecture: `library_admin`→`librarian`, `cashier_admin`→`cashier`, `registrar_admin`→`registrar`, `professor`→`signatory`

### UI & Performance
- [x] Dark/light/system theme with persistence
- [x] `RequestHistory` dark mode support
- [x] `CustomSelect` search on Course field
- [x] Admin modal closes on backdrop click
- [x] Rate limiting feedback — countdown, attempts, warning vs blocked
- [x] 2FA — authenticator + email OTP, animated tabs, countdown, resend cooldown
- [x] Login saved email suggestions with keyboard nav + ARIA
- [x] Particle count reduced to 40 on `AuthPage` + `RoleSelectionPage` (was 120)

---

## ⚠️ Prerequisite — Supabase Configuration

Real-time subscriptions require Realtime to be enabled on these tables in the Supabase dashboard (Database → Replication):

| Table | Used By |
|-------|---------|
| `requests` | Cashier, Librarian, Registrar, SuperAdmin, Student dashboards |
| `profiles` | Registrar, SuperAdmin, PendingAccountsView |
| `professor_approvals` | Student dashboard |

Without this, the websocket subscriptions will connect but receive no events.

---

## 🚀 To Build — New Features

All 7 features have been implemented:

| # | Feature | Where | Status |
|---|---------|-------|--------|
| 1 | CSRF protection — Origin/Referer validation middleware | `backend/middleware/csrfProtection.js`, `backend/index.js` | ✅ Done |
| 2 | Persistent OTP/token storage — Supabase `otp_tokens` table | `backend/services/otpStore.js`, `authRoutes.js`, `twoFactorRoutes.js` | ✅ Done |
| 3 | Increase secret code entropy — 128-bit base64url codes | `backend/routes/secretCodeRoutes.js` | ✅ Done |
| 4 | Consistent design system — shared `dashboardThemes.js` | `frontend/src/constants/dashboardThemes.js`, all dashboards | ✅ Done |
| 5 | Audit logging — `audit_log` table + `auditService.js` | `backend/services/auditService.js`, graduation/admin/secret routes | ✅ Done |
| 6 | Bulk approve/reject in PendingAccountsView | `backend/routes/adminAccountRoutes.js`, `PendingAccountsView.jsx` | ✅ Done |
| 7 | Email notifications for clearance status changes | `backend/routes/graduationRoutes.js` | ✅ Done |

---

## 📋 What To Do Next (Priority Order)

All code-level issues and feature work from this audit have been completed. Remaining items:

1. **Run SQL migrations** — Execute `add_otp_tokens_table.sql` and `add_audit_log_table.sql` in Supabase SQL Editor
2. **Enable Supabase Realtime** — Turn on replication for `requests`, `profiles`, `professor_approvals` tables
3. **Toast consistency** — Standardize toast usage across all components (medium effort, cross-cutting)

### New SQL Migrations Required

| Migration | Purpose |
|-----------|---------|
| `backend/migrations/add_otp_tokens_table.sql` | Persistent OTP/token storage (replaces in-memory Maps) |
| `backend/migrations/add_audit_log_table.sql` | Audit logging for admin actions |
