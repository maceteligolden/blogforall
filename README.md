# BlogForAll - Blog SaaS Platform

A comprehensive blog management SaaS platform where users can create, manage, and publish blogs with API access for custom frontends.

## Features

- User authentication (signup, login, logout)
- Profile management (edit profile, change password)
- Blog management (CRUD, drafts, publish/unpublish)
- API key management for external integrations
- Public API with pagination, search, and filtering
- Guest comments and likes
- Netflix-inspired minimalist dashboard design

## Tech Stack

### Backend
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- Repository-Service-Controller pattern
- Dependency Injection (tsyringe)

### Frontend
- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- Netflix-inspired design with blue primary color

## Project Structure

```
blogforall/
├── backend/          # Express API Server
├── frontend/         # Next.js Web Application
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB
- Yarn or npm

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   cd backend && yarn install
   cd ../frontend && yarn install
   ```

3. Configure environment variables (see `.env.example` files)

4. Start development servers:
   ```bash
   # Backend
   cd backend && yarn dev
   
   # Frontend
   cd frontend && yarn dev
   ```

## Development Phases

- ✅ Phase 1: Project Setup & Infrastructure
- ⏳ Phase 2: Authentication Module
- ⏳ Phase 3: Blog Management Module
- ⏳ Phase 4: API Keys Module
- ⏳ Phase 5: Public API Endpoints
- ⏳ Phase 6: Comments & Likes
- ⏳ Phase 7: Frontend Dashboard
- ⏳ Phase 8: Landing Page & Documentation

