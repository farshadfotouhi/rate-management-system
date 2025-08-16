# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Magaya Rate Agent - A comprehensive rate management system for freight forwarders powered by Pinecone Assistant AI. This is a full-stack TypeScript application with React frontend, Express.js backend, and PostgreSQL database.

## Development Commands

### Backend (from `/backend` directory)
```bash
npm run dev          # Start development server with hot reload (port 3001)
npm run build        # Compile TypeScript to JavaScript
npm run start        # Start production server
npm run lint         # Run ESLint for code quality checks
npm run test         # Run Jest tests (when available)
```

### Frontend (from `/frontend` directory)
```bash
npm run dev          # Start Vite development server (port 5173)
npm run build        # Build for production
npm run preview     # Preview production build locally
npm run lint         # Run ESLint
```

### E2E Testing (from root directory)
```bash
npm test             # Run all Playwright tests
npm run test:ui      # Open Playwright UI for interactive testing
npm run test:headed  # Run tests with browser visible
```

### Database Setup
```bash
# From /backend directory
psql -U your_user -d your_database -f src/database/schema.sql  # Initialize database schema
```

## High-Level Architecture

### Multi-Tenant SaaS Architecture
The system implements tenant isolation at the database level. Each tenant (freight forwarder company) has isolated data with tenant_id foreign keys throughout the schema. Authentication includes tenant context in JWT tokens.

### Backend Architecture Pattern
- **Layered Architecture**: Routes → Controllers → Services → Database
- **Service Layer**: Core business logic is in `/backend/src/services/`:
  - `auth.service.ts`: JWT authentication with refresh tokens
  - `contract.service.ts`: PDF contract processing and management
  - `pinecone.service.ts`: AI assistant integration for rate queries
  - `user.service.ts`: User management and tenant operations
  
### Frontend State Management
Uses Zustand for global state management (`/frontend/src/store/authStore.ts`) with localStorage persistence. Authentication state and user context are managed globally, while component-specific state uses React hooks.

### AI Integration Architecture
The system integrates with Pinecone Assistant API for intelligent rate searching:
1. PDF contracts are uploaded and processed (`/backend/src/services/contract.service.ts`)
2. Documents are indexed in Pinecone vector database
3. Chat interface queries Pinecone Assistant for rate information
4. Responses are streamed back to frontend via REST API

#### CRITICAL: Pinecone Assistant API Endpoints
The Pinecone Assistant API uses specific endpoints that differ from their documentation:

**Chat Endpoint**: `/assistant/chat/{assistantName}`
- Method: POST
- URL: `https://prod-1-data.ke.pinecone.io/assistant/chat/ratemanager`
- Headers: 
  - `Api-Key: {PINECONE_ASSISTANT_API_KEY}`
  - `X-Pinecone-API-Version: 2025-04`
- Body: `{ messages: [...], stream: false }`
- Response includes: `message.content`, `usage.total_tokens`

**File Upload Endpoint**: `/assistant/files/{assistantName}`
- Method: POST (multipart/form-data)
- URL: `https://prod-1-data.ke.pinecone.io/assistant/files/ratemanager`
- Headers:
  - `Api-Key: {PINECONE_ASSISTANT_API_KEY}`
  - `X-Pinecone-API-Version: 2025-04`
- Returns: `{ id, status: "Processing", ... }`

**Important Notes**:
- Do NOT use `/assistant/files/upload` endpoint - it returns 404
- Do NOT try to create assistants via API - they must be created in Pinecone dashboard
- The assistant name (e.g., "ratemanager") is passed in the URL path, not as a header
- Mock assistants (starting with "mock-assistant-") bypass API calls for development

### API Structure
RESTful API with consistent patterns:
- `/api/auth/*` - Authentication endpoints
- `/api/contracts/*` - Contract management
- `/api/chat/*` - AI assistant interactions
- `/api/users/*` - User management
- All endpoints require JWT authentication except login/register

### Database Design
PostgreSQL with UUID primary keys and comprehensive audit logging. Key tables:
- `tenants` - Multi-tenant isolation
- `users` - User accounts with role-based access
- `contracts` - PDF contract metadata
- `pinecone_documents` - Vector database document tracking
- `chat_sessions` & `chat_messages` - Conversation history
- `port_codes` - Shipping port lookup data

### Security Implementation
- JWT tokens with refresh token rotation
- Bcrypt password hashing with salt rounds
- Rate limiting on API endpoints
- Input validation using Zod schemas
- SQL injection protection via parameterized queries
- CORS configuration for frontend-backend communication
- Helmet.js for security headers

## Key File Locations

### Configuration
- `/backend/src/config/database.ts` - Database connection configuration
- `/backend/src/config/pinecone.ts` - Pinecone API configuration
- `/frontend/src/config/api.ts` - API client configuration

### Core Business Logic
- `/backend/src/services/` - All service layer implementations
- `/backend/src/routes/` - API route definitions
- `/backend/src/middleware/` - Authentication and request processing

### Frontend Components
- `/frontend/src/pages/` - Page-level components
- `/frontend/src/components/` - Reusable UI components
- `/frontend/src/hooks/` - Custom React hooks
- `/frontend/src/store/` - Zustand state management

## Environment Variables

### Backend (.env)
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql://localhost/rate_management`)
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - Refresh token secret
- `PINECONE_API_KEY` - Pinecone Vector DB API key
- `PINECONE_ASSISTANT_API_KEY` - Pinecone Assistant API key (different from Vector DB key)
- `PORT` - Server port (default: 3001)

### Frontend (.env)
- `VITE_API_URL` - Backend API URL (default: http://localhost:3001)

## Pinecone Assistant Setup & Troubleshooting

### Setting Up Pinecone Assistant
1. Create assistant in Pinecone dashboard (https://app.pinecone.io/)
2. Note the assistant name exactly as shown in dashboard
3. Link assistant to tenant: `npx tsx src/scripts/link-real-assistant.ts {tenantId} {assistantName}`
4. Current production assistant: "ratemanager"

### Common Issues & Solutions

**Issue: "No assistant found for tenant"**
- Solution: Run `npx tsx src/scripts/link-real-assistant.ts {tenantId} {assistantName}`
- For development: The system will use mock assistant automatically

**Issue: File upload returns 404**
- Wrong endpoint. Use `/assistant/files/{assistantName}` not `/assistant/files/upload`
- Ensure assistant name is in URL path, not header

**Issue: Chat returns 404**
- Wrong endpoint. Use `/assistant/chat/{assistantName}` not `/assistant/chat/completions`
- Ensure API version header is `X-Pinecone-API-Version: 2025-04`

**Issue: Both frontend and backend trying to use port 3001**
- Frontend should use port 5173 (configured in vite.config.ts)
- Backend uses port 3001
- Frontend proxies /api calls to backend

**Issue: Login fails with "Bad escaped character in JSON"**
- Special characters in password need proper escaping
- Use Node.js or proper HTTP client instead of curl for testing