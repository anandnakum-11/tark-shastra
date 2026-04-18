# SakshyaAI – Smart Grievance Verification System

> AI-assisted grievance resolution verification for Gujarat's Swagat portal.  
> Independent verification with IVR, geo-tagged evidence, GPS validation, and auto-reopen logic.

## 🏗️ Project Structure

```
tark-shastra/
├── backend/           # Node.js + Express + MongoDB backend
│   ├── server.js      # Entry point
│   ├── src/
│   │   ├── config/    # DB, Redis, S3, Twilio clients
│   │   ├── models/    # Mongoose schemas
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   ├── queues/    # BullMQ workers
│   │   ├── middleware/ # Auth, RBAC, Twilio validation
│   │   ├── utils/     # Haversine, logger, constants
│   │   └── seed/      # Database seed script
│   └── .env           # Environment variables
└── frontend/          # Vanilla HTML/CSS/JS dashboard
    ├── index.html     # Main page
    ├── style.css      # Premium dark theme
    └── app.js         # Application logic
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (optional — works without for demo)

### 1. Backend Setup
```bash
cd backend
npm install
npm run seed    
npm run dev     
```

### 2. Frontend
Open `frontend/index.html` in your browser (or use Live Server)

### 3. Demo Credentials
| Role | Username | Password |
|------|----------|----------|
| Collector | `collector` | `collector123` |
| Department (RBD) | `dept_rbd` | `dept123` |
| Department (WSSB) | `dept_wssb` | `dept123` |
| Field Officer | `officer1` | `officer123` |
| Citizen | `citizen1` | `citizen123` |

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/grievances/:id/resolve` | Trigger verification (Department) |
| POST | `/api/ivr/welcome` | Twilio IVR webhook |
| POST | `/api/ivr/response` | DTMF response handler |
| GET | `/api/evidence/upload-url` | Presigned S3 URL |
| POST | `/api/evidence/confirm` | Confirm evidence + GPS |
| GET | `/api/collector/dashboard` | Collector dashboard |
| GET | `/api/departments/:id/score` | Department score |

## ⚡ Mock Mode
Set `MOCK_MODE=true` in `.env` to run without real Twilio/S3 credentials.
All IVR calls and S3 uploads are simulated with logs.
