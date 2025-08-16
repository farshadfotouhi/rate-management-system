# Magaya Rate Agent

A comprehensive rate management system for freight forwarders, powered by Pinecone Assistant AI.

## Features

- 🤖 AI-powered chat assistant for rate inquiries
- 📄 Contract management and upload
- 🔍 Intelligent rate searching across contracts
- 👥 Multi-tenant support
- 🔐 Secure authentication with JWT
- 📊 Real-time rate analysis

## Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- npm or yarn
- Pinecone Assistant API account

## Quick Start

### 1. Clone or Copy the Repository

```bash
# If using git
git clone <repository-url>
cd rate-management-system

# Or copy the entire rate-management-system folder to your new machine
```

### 2. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Database Setup

```bash
# Install PostgreSQL (if not already installed)
# macOS:
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian:
sudo apt-get install postgresql-15

# Create the database
createdb rate_management
```

### 4. Environment Configuration

Create a `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL=postgresql://localhost/rate_management

# Server
PORT=3001
NODE_ENV=development

# JWT Secrets (generate your own secure keys)
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here

# Pinecone Assistant Configuration
PINECONE_ASSISTANT_API_KEY=your-pinecone-api-key
PINECONE_ASSISTANT_HOST=https://prod-1-data.ke.pinecone.io
PINECONE_PROJECT_ID=your-project-id

# CORS
CORS_ORIGIN=http://localhost:5173

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

### 5. Initialize Database

```bash
cd backend
npm run db:init
```

### 6. Create First Tenant and Admin User

```bash
cd backend
npm run create-tenant
```

Default credentials:
- Email: admin@demofreight.com
- Password: admin123

### 7. Start the Application

```bash
# Terminal 1 - Start backend
cd backend
npm run dev

# Terminal 2 - Start frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## File Transfer Methods

### Option 1: Using Git (Recommended)

1. Initialize git repository on source machine:
```bash
cd rate-management-system
git init
git add .
git commit -m "Initial commit"
```

2. Push to GitHub/GitLab/Bitbucket:
```bash
git remote add origin <your-repo-url>
git push -u origin main
```

3. Clone on target machine:
```bash
git clone <your-repo-url>
cd rate-management-system
```

### Option 2: Direct Transfer

1. Create archive on source machine:
```bash
cd ..
tar -czf magaya-rate-agent.tar.gz rate-management-system/
```

2. Transfer via:
   - USB drive
   - Network share
   - SCP: `scp magaya-rate-agent.tar.gz user@target-machine:/path/`
   - Cloud storage (Dropbox, Google Drive, etc.)

3. Extract on target machine:
```bash
tar -xzf magaya-rate-agent.tar.gz
cd rate-management-system
```

### Option 3: Using rsync

```bash
rsync -avz --exclude 'node_modules' --exclude '.env' \
  rate-management-system/ user@target-machine:/path/to/destination/
```

## Important Files to Preserve

When transferring, ensure you have:
- All source code files
- `package.json` files (both backend and frontend)
- Database schema (`backend/src/database/schema.sql`)
- Magaya logo (`frontend/public/magaya-logo.png`)

Do NOT transfer:
- `node_modules/` folders
- `.env` files (recreate on target machine)
- Database files
- Log files

## Production Deployment

For production deployment:

1. Build frontend:
```bash
cd frontend
npm run build
```

2. Set production environment variables
3. Use PM2 or similar for process management:
```bash
npm install -g pm2
pm2 start backend/dist/index.js --name magaya-rate-agent
```

4. Configure nginx/Apache as reverse proxy
5. Set up SSL certificates

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify database exists: `psql -l`

### Pinecone Connection Issues
- Verify API key is correct
- Check host URL matches your region
- Ensure assistant ID is created in Pinecone console

### Port Conflicts
- Change PORT in backend/.env if 3001 is in use
- Update CORS_ORIGIN if frontend port changes

## Support

For issues or questions, please refer to the documentation or contact support.

## License

© 2025 Magaya Corporation. All rights reserved.