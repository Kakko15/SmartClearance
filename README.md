# SmartClearance

A comprehensive university clearance management system built for Isabela State University. SmartClearance digitizes and streamlines the graduation clearance process, replacing paper-based workflows with an efficient, role-based web application.

## Features

- **Multi-Stage Graduation Clearance** — Students submit clearance requests that flow through Library → Cashier → Registrar → Signatory approval stages
- **Role-Based Access Control** — Seven distinct roles (System Admin, Super Admin, Registrar, Librarian, Cashier, Signatory, Student) with hierarchical permissions
- **Two-Factor Authentication (2FA)** — OTP-based second factor for secure logins
- **ID & Face Verification** — OCR-based ID scanning (Tesseract.js) and facial recognition (face-api.js) during signup
- **Certificate Generation** — PDF certificates with QR codes and a public verification page
- **Email Notifications** — Automated status updates via Nodemailer
- **Document Uploads** — File attachments at each clearance stage
- **Bulk Actions** — Staff can approve/reject multiple requests at once
- **Audit Logging** — Tracks actions for accountability
- **Session Security** — Auto-logout on idle, CSRF protection, rate limiting, reCAPTCHA

## Tech Stack

### Frontend

- **React 19** with **Vite** for fast development and HMR
- **React Router v7** for client-side routing
- **Tailwind CSS** for utility-first styling
- **Framer Motion** for animations
- **Three.js** (@react-three/fiber) for 3D visual effects
- **Axios** for API communication

### Backend

- **Express.js 5** (Node.js) REST API
- **Supabase** for PostgreSQL database, authentication, and file storage
- **Nodemailer** for email delivery
- **PDFKit** + **qrcode** for certificate generation
- **Multer** for file upload handling
- **express-rate-limit** for brute-force protection

## Project Structure

```
SmartClearance/
├── backend/
│   ├── index.js                 # Express server entry point
│   ├── supabaseClient.js        # Supabase client configuration
│   ├── routes/                  # API route handlers
│   │   ├── authRoutes.js        # Authentication & signup
│   │   ├── graduationRoutes.js  # Graduation clearance flow
│   │   ├── requestRoutes.js     # Clearance requests
│   │   ├── certificateRoutes.js # Certificate generation & verification
│   │   ├── clearanceRoutes.js   # Clearance status management
│   │   ├── commentRoutes.js     # Request comments
│   │   ├── documentRoutes.js    # Document uploads
│   │   ├── adminAccountRoutes.js# Staff account management
│   │   ├── twoFactorRoutes.js   # 2FA setup & verification
│   │   ├── secretCodeRoutes.js  # Staff signup codes
│   │   └── escalationRoutes.js  # Request escalation
│   ├── services/                # Business logic
│   ├── middleware/               # Auth, CSRF, error handling, uploads
│   ├── constants/               # Roles, allowed origins
│   └── utils/                   # Helpers (escapeHtml, validatePassword)
├── frontend/
│   ├── src/
│   │   ├── pages/               # Page components (dashboards, auth, landing)
│   │   ├── components/          # Reusable UI, auth, feature, and layout components
│   │   ├── contexts/            # React contexts (Auth, Theme)
│   │   ├── hooks/               # Custom hooks (useIdleTimeout)
│   │   ├── services/            # API service layer
│   │   └── lib/                 # Utility functions
│   ├── public/                  # Static assets
│   └── index.html               # HTML entry point
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** (v18 or later)
- **npm**
- A **Supabase** project ([supabase.com](https://supabase.com))
- A **Google reCAPTCHA** site/secret key pair ([reCAPTCHA admin](https://www.google.com/recaptcha/admin))
- An **SMTP email account** (e.g., Gmail with an app-specific password)

### 1. Clone the Repository

```bash
git clone https://github.com/Kakko15/SmartClearance.git
cd SmartClearance
```

### 2. Set Up the Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Supabase credentials, email settings, and other config
```

### 3. Set Up the Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your Supabase URL, anon key, and reCAPTCHA site key
```

### 4. Run the Application

In two separate terminals:

```bash
# Terminal 1 — Backend (default: http://localhost:5000)
cd backend
npm run dev

# Terminal 2 — Frontend (default: http://localhost:5173)
cd frontend
npm run dev
```

### Environment Variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example) for the full list of required configuration variables and their descriptions.

## User Roles

| Role | Description |
|------|-------------|
| **System Admin** | Developer/IT-level access for system management |
| **Super Admin** | University-level oversight and management |
| **Registrar** | Verifies academic records |
| **Librarian** | Checks library clearance |
| **Cashier** | Verifies financial clearance |
| **Signatory** | Final approval (professor/department head) |
| **Student** | Submits and tracks graduation clearance requests |

## License

ISC
