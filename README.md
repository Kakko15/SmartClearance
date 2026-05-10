<p align="center">
  <img src="frontend/public/logo.png" alt="SmartClearance Logo" width="80" />
</p>

<h1 align="center">SmartClearance</h1>

<p align="center">
  <strong>AI-Powered Graduation Clearance Management System</strong><br/>
  Isabela State University
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tests-108%20Passing-brightgreen?logo=vitest&logoColor=white" />
</p>

---

## 📋 Overview

SmartClearance is a full-stack web application that digitizes and automates the graduation clearance process at Isabela State University. It replaces the traditional paper-based workflow with an intelligent, role-based system featuring AI-powered request routing, sequential approval chains, real-time notifications, and automated certificate generation.

### Key Highlights

- **6 User Roles** — Student, Librarian, Cashier, Registrar, Signatory, Super Admin
- **Dual Clearance Pipelines** — Separate undergraduate and graduate workflows
- **AI Request Classification** — Rule-based priority scoring and intelligent routing
- **Auto-Escalation** — Stale requests are automatically flagged and escalated
- **Self-Healing Approvals** — Detects and repairs DB trigger inconsistencies
- **Real-Time Notifications** — In-app + email notifications at every stage
- **Certificate Generation** — Unique ISU-GC certificates with QR verification

---

## 🏗️ Architecture

```
SmartClearance/
├── backend/                    # Express.js API Server
│   ├── routes/                 # 15 route modules
│   │   ├── authRoutes.js       # Login, signup, email verification, 2FA
│   │   ├── graduationRoutes.js # Graduation clearance workflow
│   │   ├── requestRoutes.js    # Document request lifecycle
│   │   ├── clearanceRoutes.js  # Comment system
│   │   ├── adminAccountRoutes.js # User management + deletion
│   │   ├── certificateRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── profileRoutes.js
│   │   └── ...
│   ├── services/               # Business logic layer
│   │   ├── aiRequestRouter.js  # AI classification engine
│   │   ├── certificateService.js
│   │   ├── escalationService.js
│   │   ├── graduationHelpers.js
│   │   ├── notificationService.js
│   │   ├── auditService.js
│   │   └── otpStore.js
│   ├── middleware/
│   │   ├── authMiddleware.js   # JWT auth + role-based access
│   │   ├── errorHandler.js
│   │   └── uploadMiddleware.js
│   ├── constants/              # Roles, designations, validation
│   ├── utils/                  # Helpers (password, escapeHtml, safeError)
│   └── tests/                  # Vitest test suites
│       ├── api.test.js         # 38 API validation tests
│       └── flows.test.js       # 47 business logic tests
│
├── frontend/                   # React 19 + Vite SPA
│   ├── src/
│   │   ├── pages/              # 8 role-specific dashboards
│   │   │   ├── StudentDashboardGraduation.jsx
│   │   │   ├── LibrarianDashboard.jsx
│   │   │   ├── CashierDashboard.jsx
│   │   │   ├── RegistrarDashboard.jsx
│   │   │   ├── SignatoryDashboard.jsx
│   │   │   ├── SuperAdminDashboard.jsx
│   │   │   ├── LandingPage.jsx
│   │   │   └── CertificateVerifyPage.jsx
│   │   ├── components/
│   │   │   ├── admin/          # User management, pending accounts
│   │   │   ├── auth/           # Login, signup, 2FA forms
│   │   │   ├── features/       # 22 feature components
│   │   │   ├── ui/             # Confetti, CommandPalette, etc.
│   │   │   └── layout/         # Navigation, sidebar
│   │   ├── contexts/           # AuthContext
│   │   ├── hooks/              # useRealtimeSubscription
│   │   ├── services/           # API client (axios)
│   │   └── test/               # 23 component tests
│   └── public/
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** 9+
- **Supabase** project (PostgreSQL + Auth)

### 1. Clone the Repository

```bash
git clone https://github.com/Kakko15/SmartClearance.git
cd SmartClearance
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
RECAPTCHA_SECRET_KEY=your-recaptcha-secret
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
SUPER_ADMIN_EMAIL=admin@isu.edu.ph
ESCALATION_DAYS=3
NODE_ENV=development
PORT=5000
```

Start the server:

```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:5000
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

Start the dev server:

```bash
npm run dev
```

The app will be available at **http://localhost:5173**

### 4. Seed Accounts (Optional)

```bash
cd backend
node scripts/create-accounts.js
```

This creates default staff accounts (librarian, cashier, registrar, signatories, super admin).

### 5. Docker Deployment (Optional)

```bash
# Build the backend image
docker build -t smartclearance-api .

# Run with environment variables
docker run -p 5000:5000 --env-file backend/.env smartclearance-api
```

The container includes a built-in health check at `/api/health`.

---

## 🔐 Role System

| Role | Access | Key Capabilities |
|------|--------|-------------------|
| **Student** | Student Dashboard | Apply for clearance, track status, upload documents, download certificate |
| **Signatory** | Signatory Dashboard | Approve/reject at their stage, view assigned students, add comments |
| **Librarian** | Librarian Dashboard | Approve library clearance, manage library-related requests |
| **Cashier** | Cashier Dashboard | Approve cashier clearance, verify payment status |
| **Registrar** | Registrar Dashboard | Approve registrar clearance, manage records, bulk operations |
| **Super Admin** | Admin Dashboard | Full system access, user management, secret codes, analytics, delete users |

---

## 📊 Clearance Workflow

### Undergraduate Pipeline

```
Student Application
    │
    ▼
┌─────────────────────┐
│ Department Chairman  │ ← Stage 1 (no prereqs)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│    College Dean      │ ← Stage 2 (requires Stage 1)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Dir. Student Affairs │ ← Stage 3 (requires Stage 2)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   NSTP Director      │ ← Stage 4 (requires Stage 3)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Executive Officer   │ ← Stage 5 (requires Stage 4)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Campus Librarian    │ ← Library clearance
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Chief Accountant    │ ← Cashier clearance
└──────────┬──────────┘
           ▼
   ✅ Certificate Generated
```

> **Note:** Registrar is auto-approved for undergraduates.

### Graduate Pipeline

```
Student Application
    │
    ├──► Chief Accountant (Cashier)
    ├──► Campus Librarian (Library)
    ├──► Record Evaluator (Registrar)
    │
    ▼  (all three must approve first)
┌─────────────────────┐
│ Dean, Graduate School│ ← Final signatory
└──────────┬──────────┘
           ▼
   ✅ Certificate Generated
```

---

## 🧪 Testing

### Run All Tests

```bash
# Backend (85 tests)
cd backend
npm test

# Frontend (23 tests)
cd frontend
npm test
```

### Test Coverage

| Suite | Tests | What's Covered |
|-------|-------|----------------|
| `api.test.js` | 38 | Auth, RBAC, delete user, bulk ops, audit, cascade delete |
| `flows.test.js` | 47 | Clearance pipelines, stage determination, comment visibility, designations |
| `components.test.jsx` | 23 | Confetti, CommandPalette, AllUsersView, delete modal, constants |
| **Total** | **108** | |

---

## 🔒 Security Features

| Feature | Implementation |
|---------|---------------|
| **Authentication** | JWT via Supabase Auth, Bearer token on every request |
| **Authorization** | `requireAuth` + `requireRole()` middleware chain |
| **Rate Limiting** | Per-IP and per-account limits on login, signup, and API writes |
| **2FA** | OTP-based two-factor authentication with attempt limits |
| **Password Policy** | Minimum length, uppercase, lowercase, number, special char |
| **Input Validation** | Email normalization, student number regex, HTML escaping |
| **reCAPTCHA** | Google reCAPTCHA v2 on signup forms |
| **Audit Logging** | All admin actions logged with actor, target, and timestamp |
| **Safe Errors** | `safeErrorResponse()` prevents stack trace leakage |
| **Face Verification** | Stored for review, never auto-trusted (BUG-003 fix) |

---

## 🤖 AI Features

### Request Classification Engine

The `aiRequestRouter.js` service automatically classifies incoming requests:

- **Keyword Extraction** — Detects urgent, academic, financial, and clearance patterns
- **Priority Scoring** — 0-100 scale based on document type, keywords, and stage count
- **Urgency Levels** — Critical (80+), High (60+), Medium (40+), Low (<40)
- **Processing Time Estimation** — Hours estimate based on stage count and urgency
- **Routing Strategy** — Sequential routing through required stages

### Auto-Escalation

The `escalationService.js` runs periodic checks:

- Requests idle for 3+ days are automatically escalated
- Escalation levels increment with each check
- Staff and admin receive notifications at each level
- Full escalation history is preserved

---

## 📧 Notification System

| Event | In-App | Email |
|-------|--------|-------|
| New clearance application | ✅ | ✅ (to all staff) |
| Stage approved | ✅ | ✅ |
| Stage rejected / on hold | ✅ | ✅ |
| Clearance completed | ✅ | ✅ |
| Request escalated | ✅ | ✅ |
| Re-evaluation requested | ✅ | ✅ |
| New comment | ✅ | — |
| Account approved/rejected | ✅ | ✅ |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, Framer Motion, TailwindCSS, Recharts |
| **Backend** | Node.js, Express.js |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (JWT) |
| **Email** | Nodemailer (Gmail SMTP) |
| **Testing** | Vitest, React Testing Library, Supertest |
| **AI** | Rule-based classification engine |
| **Real-time** | Supabase Realtime subscriptions |

---

## 📝 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login with rate limiting |
| POST | `/api/auth/signup` | Staff signup with secret code |
| POST | `/api/auth/signup-student` | Student signup with face verification |
| POST | `/api/auth/check-email` | Check if email is registered |
| POST | `/api/auth/verify-recaptcha` | reCAPTCHA verification |

### Graduation Clearance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/graduation/apply` | Submit clearance application |
| GET | `/api/graduation/status/:studentId` | Get clearance status |
| DELETE | `/api/graduation/cancel/:studentId` | Cancel clearance request |
| POST | `/api/graduation/request-reevaluation` | Request stage re-evaluation |

### Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests/create` | Create document request |
| POST | `/api/requests/:id/approve` | Approve at current stage |
| POST | `/api/requests/:id/reject` | Reject with reason |
| POST | `/api/requests/:id/resubmit` | Resubmit from on_hold |
| GET | `/api/requests/student/:id` | Get student's requests |
| GET | `/api/requests/admin/:role` | Get role-filtered requests |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/approve` | Approve pending account |
| POST | `/api/admin/reject` | Reject pending account |
| DELETE | `/api/admin/delete-user/:userId` | Cascade delete user |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check — returns status, version, uptime |

---

## 👥 Contributors

- **Kakko15** — Full-stack Developer

---

## 📄 License

This project is developed for **Isabela State University** as part of the Software Engineering curriculum.

---

<p align="center">
  <strong>SmartClearance</strong> — Digitizing education, one clearance at a time. 🎓
</p>
