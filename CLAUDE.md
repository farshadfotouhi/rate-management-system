# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Magaya Rate Agent - A comprehensive rate management system for freight forwarders powered by Pinecone Assistant AI. This is a full-stack TypeScript application with React frontend, Express.js backend, and PostgreSQL database.

## Development Commands

### Backend (from `/backend` directory)
```bash
npm run dev                # Start development server with hot reload (port 3001)
npm run build              # Compile TypeScript to JavaScript
npm run start              # Start production server
npm run lint               # Run ESLint for code quality checks
npm run typecheck          # Type check without building
npm run test               # Run Jest tests (when available)
npm run setup-admin        # Create admin user for a tenant
npm run link-assistant     # Link Pinecone assistant to tenant
npm run upgrade-assistant  # Upgrade from mock to real assistant
```

### Frontend (from `/frontend` directory)
```bash
npm run dev        # Start Vite development server (port 5173)
npm run build      # Build for production
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
npm run typecheck  # Type check without building
```

### E2E Testing (from root directory)
```bash
npm test              # Run all Playwright tests
npm run test:ui       # Open Playwright UI for interactive testing
npm run test:headed   # Run tests with browser visible
npm run test:auth     # Run authentication tests only
npm run test:contracts # Run contract tests only
npm run test:chat     # Run chat tests only
```

### Database Setup
```bash
# Initialize database
createdb rate_management
psql -U your_user -d rate_management -f backend/src/database/schema.sql

# Create first tenant and admin
cd backend
npm run setup-admin
```

## High-Level Architecture

### Multi-Tenant SaaS Architecture
The system implements tenant isolation at the database level. Each tenant (freight forwarder company) has isolated data with tenant_id foreign keys throughout the schema. Authentication includes tenant context in JWT tokens.

### Backend Architecture Pattern
- **Layered Architecture**: Routes → Controllers → Services → Database
- **Service Layer**: Core business logic in `/backend/src/services/`:
  - `auth.service.ts`: JWT authentication with refresh tokens
  - `contract-processor.service.ts`: PDF contract processing and management
  - `pinecone-assistant.service.ts`: AI assistant integration for rate queries
  
### Frontend State Management
Uses Zustand for global state management (`/frontend/src/store/authStore.ts`) with localStorage persistence. Authentication state and user context are managed globally, while component-specific state uses React hooks.

### AI Integration Architecture
The system integrates with Pinecone Assistant API for intelligent rate searching:
1. PDF contracts are uploaded and processed (`/backend/src/services/contract-processor.service.ts`)
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
- Body: `{ messages: [...], stream: false, model: "gemini-2.5-pro" }`
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
- `/api/assistant/*` - Assistant configuration and instructions
- `/api/tenant/*` - Tenant management
- All endpoints require JWT authentication except login/register

### Database Design
PostgreSQL with UUID primary keys and comprehensive audit logging. Key tables:
- `tenants` - Multi-tenant isolation with assistant configuration
- `users` - User accounts with role-based access (admin, manager, user)
- `assistants` - Pinecone assistant configurations per tenant
- `contracts` - PDF contract metadata with processing status
- `chat_sessions` & `chat_messages` - Conversation history with token tracking
- `refresh_tokens` - JWT refresh token management
- `audit_logs` - Comprehensive activity logging
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
- `/backend/src/config/index.ts` - Environment configuration with Zod validation
- `/backend/src/database/index.ts` - Database connection pool management
- `/frontend/src/config/axios.ts` - API client configuration with interceptors

### Core Business Logic
- `/backend/src/services/` - All service layer implementations
- `/backend/src/routes/` - API route definitions
- `/backend/src/middleware/auth.middleware.ts` - JWT authentication middleware

### Frontend Components
- `/frontend/src/pages/` - Page-level components (Login, Dashboard, Contracts, Chat, Settings)
- `/frontend/src/components/Layout.tsx` - Main application layout
- `/frontend/src/store/authStore.ts` - Zustand authentication store

## Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://localhost/rate_management
DATABASE_POOL_SIZE=20

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# JWT Auth
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Pinecone Configuration
PINECONE_API_KEY=your-vector-db-key
PINECONE_ENVIRONMENT=your-environment
PINECONE_INDEX_NAME=rate-contracts
PINECONE_ASSISTANT_API_KEY=your-assistant-key
PINECONE_ASSISTANT_MODEL=gemini-2.5-pro

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE_MB=50
ALLOWED_FILE_TYPES=application/pdf

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
```

## Pinecone Assistant Setup & Troubleshooting

### Setting Up Pinecone Assistant
1. Create assistant in Pinecone dashboard (https://app.pinecone.io/)
2. Note the assistant name exactly as shown in dashboard
3. Link assistant to tenant: `npx tsx src/scripts/link-real-assistant.ts {tenantId} {assistantName}`
4. Current production assistant: "ratemanager"

### Mock Assistant for Development
The system automatically uses mock assistants (ID starting with "mock-assistant-") when no real assistant is configured. This allows development without Pinecone API access.

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

## Testing Strategy

### Unit Testing
- Backend: Jest with ts-jest for TypeScript support
- Frontend: Vitest for React components (when implemented)

### E2E Testing
- Playwright tests in root `/tests` directory
- Test files: `auth.spec.ts`, `contracts.spec.ts`, `chat.spec.ts`, `settings.spec.ts`
- Uses page object pattern for maintainability

### Manual Testing Scripts
- `/backend/src/scripts/` contains various testing utilities:
  - `test-pinecone-direct.ts` - Test Pinecone API directly
  - `test-chat-now.ts` - Test chat functionality
  - `test-instructions-save.ts` - Test custom instructions