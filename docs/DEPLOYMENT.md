# Deployment Guide

This guide covers deploying the Finnish Statistics Platform both locally and to Google Cloud Platform (GCP).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Deployment](#local-deployment)
- [GCP Deployment](#gcp-deployment)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Local Development

- **Docker** 24+ and **Docker Compose** 2+
- **Git** for cloning the repository
- 4GB RAM minimum (8GB recommended)
- Port availability: 5173 (frontend), 8000 (backend), 5432 (database)

### GCP Deployment

- **Google Cloud SDK** installed and configured
- **GCP Project** with billing enabled
- **IAM Permissions:**
  - Cloud Run Admin
  - Cloud SQL Admin
  - Cloud Scheduler Admin
  - Artifact Registry Administrator
- **APIs Enabled:**
  - Cloud Run API
  - Cloud SQL Admin API
  - Cloud Scheduler API
  - Artifact Registry API

---

## Local Deployment

### Quick Start

```bash
# Clone repository
git clone https://github.com/jnkp/geoinfo.git
cd geoinfo

# Create environment file
cp .env.example .env

# Start all services
docker-compose --profile full up -d

# View logs
docker-compose logs -f

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Step-by-Step Setup

#### 1. Environment Configuration

Create `.env` file in the project root:

```bash
# Database Configuration
POSTGRES_USER=geoinfo
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=geoinfo
POSTGRES_PORT=5432

# Backend Configuration
BACKEND_PORT=8000
DATABASE_URL=postgresql://geoinfo:your_secure_password_here@db:5432/geoinfo

# StatFin API Configuration
STATFIN_BASE_URL=https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin
FETCH_INTERVAL_HOURS=24

# Frontend Configuration
FRONTEND_PORT=5173
VITE_API_URL=http://localhost:8000
```

**Security Note:** Use strong passwords for production deployments.

#### 2. Start Services

**Option A: Full Stack (all services)**
```bash
docker-compose --profile full up -d
```

**Option B: Database Only (for development)**
```bash
# Start only database
docker-compose up -d db

# Run backend locally (requires Python 3.11+)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Run frontend locally (requires Node.js 20+)
cd frontend
npm install
npm run dev
```

#### 3. Initialize Database

```bash
# Run migrations
docker-compose exec backend alembic upgrade head

# Verify database
docker-compose exec db psql -U geoinfo -d geoinfo -c "\dt"
```

#### 4. Load Reference Data

```bash
# Load Finnish regions (optional, for geographic filtering)
docker-compose exec backend python -m scripts.load_regions

# Load industry classifications (optional, for industry filtering)
docker-compose exec backend python -m scripts.load_industries
```

#### 5. Verify Installation

```bash
# Check service health
docker-compose ps

# Test backend
curl http://localhost:8000/
# Expected: {"message": "Finnish Statistics API", ...}

# Test database connection
docker-compose exec backend python -c "
from models.database import init_db
import asyncio
asyncio.run(init_db())
print('Database connection OK')
"

# Test frontend
curl http://localhost:5173
# Expected: HTML response
```

### Development Workflow

#### Hot Reload

All services support hot reload during development:

- **Frontend**: Vite watches `./frontend/src` for changes
- **Backend**: Uvicorn watches `./backend` for Python file changes
- **Worker**: Requires manual restart after code changes

#### Running Tests

```bash
# Backend tests
docker-compose exec backend pytest tests/ -v

# Frontend tests
docker-compose exec frontend npm test

# E2E tests
docker-compose exec backend pytest tests/test_e2e_flow.py -v
```

#### Database Management

```bash
# Create migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback migration
docker-compose exec backend alembic downgrade -1

# Database shell
docker-compose exec db psql -U geoinfo -d geoinfo
```

#### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Worker logs (background jobs)
docker-compose logs -f worker

# Last 100 lines
docker-compose logs --tail=100
```

### Stopping Services

```bash
# Stop all services
docker-compose --profile full down

# Stop and remove volumes (data will be lost)
docker-compose --profile full down -v

# Stop specific service
docker-compose stop backend
```

---

## GCP Deployment

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Google Cloud Platform                  │
│                                                          │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   Cloud Run  │      │   Cloud Run  │                │
│  │   Frontend   │◄─────┤   Backend    │                │
│  └──────────────┘      └──────┬───────┘                │
│         ▲                      │                        │
│         │                      ▼                        │
│  ┌──────┴──────┐      ┌──────────────┐                │
│  │ Load        │      │  Cloud SQL   │                │
│  │ Balancer    │      │  PostgreSQL  │                │
│  └─────────────┘      └──────────────┘                │
│                                                          │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   Cloud      │      │  Artifact    │                │
│  │   Scheduler  ├─────►│  Registry    │                │
│  └──────────────┘      └──────────────┘                │
└─────────────────────────────────────────────────────────┘
```

### Prerequisites Setup

```bash
# Set project variables
export PROJECT_ID="your-gcp-project-id"
export REGION="europe-north1"  # Or your preferred region
export SERVICE_ACCOUNT="geoinfo-sa"

# Login to GCP
gcloud auth login
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com
```

### 1. Create Cloud SQL Instance

```bash
# Create PostgreSQL instance
gcloud sql instances create geoinfo-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-size=10GB \
  --storage-type=SSD \
  --storage-auto-increase \
  --backup-start-time=03:00

# Create database
gcloud sql databases create geoinfo \
  --instance=geoinfo-db

# Create database user
gcloud sql users create geoinfo \
  --instance=geoinfo-db \
  --password="$(openssl rand -base64 32)"

# Get connection name
gcloud sql instances describe geoinfo-db \
  --format="value(connectionName)"
# Save this as INSTANCE_CONNECTION_NAME
```

### 2. Create Artifact Registry

```bash
# Create repository for Docker images
gcloud artifacts repositories create geoinfo \
  --repository-format=docker \
  --location=$REGION \
  --description="Finnish Statistics Platform images"

# Configure Docker authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

### 3. Build and Push Images

```bash
# Set image paths
export BACKEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/geoinfo/backend:latest"
export FRONTEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/geoinfo/frontend:latest"
export WORKER_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/geoinfo/worker:latest"

# Build backend
cd backend
docker build -t $BACKEND_IMAGE .
docker push $BACKEND_IMAGE

# Build frontend (with production API URL)
cd ../frontend
docker build \
  --build-arg VITE_API_URL="https://backend-XXXXXX-ey.a.run.app" \
  -t $FRONTEND_IMAGE .
docker push $FRONTEND_IMAGE

# Worker uses same image as backend
docker tag $BACKEND_IMAGE $WORKER_IMAGE
docker push $WORKER_IMAGE
```

### 4. Deploy Backend to Cloud Run

```bash
# Create service account for Cloud Run
gcloud iam service-accounts create $SERVICE_ACCOUNT \
  --display-name="Geoinfo Service Account"

# Grant Cloud SQL client role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Deploy backend
gcloud run deploy geoinfo-backend \
  --image=$BACKEND_IMAGE \
  --platform=managed \
  --region=$REGION \
  --service-account=${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com \
  --add-cloudsql-instances=$INSTANCE_CONNECTION_NAME \
  --set-env-vars="DATABASE_URL=postgresql://geoinfo:PASSWORD@/geoinfo?host=/cloudsql/$INSTANCE_CONNECTION_NAME" \
  --set-env-vars="STATFIN_BASE_URL=https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1

# Get backend URL
export BACKEND_URL=$(gcloud run services describe geoinfo-backend \
  --region=$REGION \
  --format="value(status.url)")

echo "Backend URL: $BACKEND_URL"
```

### 5. Deploy Frontend to Cloud Run

```bash
# Rebuild frontend with correct backend URL
cd frontend
docker build \
  --build-arg VITE_API_URL=$BACKEND_URL \
  -t $FRONTEND_IMAGE .
docker push $FRONTEND_IMAGE

# Deploy frontend
gcloud run deploy geoinfo-frontend \
  --image=$FRONTEND_IMAGE \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=5 \
  --memory=256Mi \
  --cpu=1

# Get frontend URL
export FRONTEND_URL=$(gcloud run services describe geoinfo-frontend \
  --region=$REGION \
  --format="value(status.url)")

echo "Frontend URL: $FRONTEND_URL"
echo "Visit: $FRONTEND_URL"
```

### 6. Setup Background Worker with Cloud Scheduler

```bash
# Create Cloud Run Job for worker
gcloud run jobs create geoinfo-worker \
  --image=$WORKER_IMAGE \
  --region=$REGION \
  --service-account=${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com \
  --add-cloudsql-instances=$INSTANCE_CONNECTION_NAME \
  --set-env-vars="DATABASE_URL=postgresql://geoinfo:PASSWORD@/geoinfo?host=/cloudsql/$INSTANCE_CONNECTION_NAME" \
  --set-env-vars="STATFIN_BASE_URL=https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin" \
  --task-timeout=1h \
  --max-retries=3 \
  --memory=512Mi \
  --cpu=1

# Create Cloud Scheduler job (runs daily at 2 AM)
gcloud scheduler jobs create http geoinfo-worker-trigger \
  --location=$REGION \
  --schedule="0 2 * * *" \
  --time-zone="Europe/Helsinki" \
  --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/geoinfo-worker:run" \
  --http-method=POST \
  --oauth-service-account-email=${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com

# Test worker manually
gcloud run jobs execute geoinfo-worker --region=$REGION
```

### 7. Database Migrations

```bash
# Run migrations using Cloud Run Job
gcloud run jobs create geoinfo-migrate \
  --image=$BACKEND_IMAGE \
  --region=$REGION \
  --service-account=${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com \
  --add-cloudsql-instances=$INSTANCE_CONNECTION_NAME \
  --set-env-vars="DATABASE_URL=postgresql://geoinfo:PASSWORD@/geoinfo?host=/cloudsql/$INSTANCE_CONNECTION_NAME" \
  --command="alembic" \
  --args="upgrade,head" \
  --task-timeout=10m \
  --execute-now
```

### 8. Configure CORS

Update backend CORS configuration for production:

```python
# backend/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://geoinfo-frontend-XXXXXX-ey.a.run.app",  # Your frontend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Rebuild and redeploy backend after CORS update.

### 9. Setup Custom Domain (Optional)

```bash
# Map custom domain to frontend
gcloud run domain-mappings create \
  --service=geoinfo-frontend \
  --domain=stats.yourdomain.com \
  --region=$REGION

# Map custom domain to backend
gcloud run domain-mappings create \
  --service=geoinfo-backend \
  --domain=api.stats.yourdomain.com \
  --region=$REGION

# Update DNS records as instructed by gcloud output
```

---

## Configuration

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `geoinfo` | PostgreSQL username |
| `POSTGRES_PASSWORD` | - | PostgreSQL password (required) |
| `POSTGRES_DB` | `geoinfo` | PostgreSQL database name |
| `DATABASE_URL` | - | Full PostgreSQL connection string |
| `STATFIN_BASE_URL` | StatFin API | Statistics Finland API endpoint |
| `FETCH_INTERVAL_HOURS` | `24` | Background fetch interval |
| `BACKEND_PORT` | `8000` | Backend server port |
| `FRONTEND_PORT` | `5173` | Frontend dev server port |
| `VITE_API_URL` | `http://localhost:8000` | Backend API URL for frontend |

### Docker Compose Profiles

- **Default** (no profile): Database only
- **`full`**: All services (database, backend, worker, frontend)

```bash
# Database only
docker-compose up -d

# Full stack
docker-compose --profile full up -d
```

---

## Monitoring

### Local Monitoring

```bash
# Service status
docker-compose ps

# Resource usage
docker stats

# Application logs
docker-compose logs -f backend
docker-compose logs -f worker

# Database queries (requires pgBadger)
docker-compose exec db cat /var/log/postgresql/postgresql-*.log | pgbadger -
```

### GCP Monitoring

```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=geoinfo-backend" \
  --limit=50 \
  --format=json

# View Cloud SQL logs
gcloud logging read "resource.type=cloudsql_database" \
  --limit=50

# Cloud Run metrics
gcloud run services describe geoinfo-backend \
  --region=$REGION \
  --format="value(status.latestReadyRevisionName, status.conditions)"

# Setup alerts (example: high error rate)
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

---

## Troubleshooting

### Local Issues

#### Port Already in Use

```bash
# Find process using port 8000
lsof -ti:8000

# Kill process
kill -9 $(lsof -ti:8000)

# Or change port in .env
BACKEND_PORT=8001
```

#### Database Connection Failed

```bash
# Check database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Verify credentials
docker-compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1"

# Recreate database
docker-compose down -v
docker-compose up -d db
```

#### Frontend Can't Reach Backend

```bash
# Check backend is running
curl http://localhost:8000/

# Check CORS configuration
# Frontend must be on allowed origins list in backend/main.py

# Check environment variable
docker-compose exec frontend env | grep VITE_API_URL
```

### GCP Issues

#### Cloud Run Service Won't Start

```bash
# Check logs
gcloud run services logs read geoinfo-backend --region=$REGION --limit=100

# Common issues:
# - Database connection: Verify INSTANCE_CONNECTION_NAME
# - Service account: Verify cloudsql.client role
# - Memory: Increase --memory flag
```

#### Database Connection from Cloud Run

```bash
# Verify Cloud SQL connection name
gcloud sql instances describe geoinfo-db --format="value(connectionName)"

# Verify service account has cloudsql.client role
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"

# Test connection from Cloud Run
gcloud run jobs execute test-db-connection --region=$REGION
```

#### Worker Not Running

```bash
# Check Cloud Scheduler job
gcloud scheduler jobs describe geoinfo-worker-trigger --location=$REGION

# Check Cloud Run job
gcloud run jobs describe geoinfo-worker --region=$REGION

# View execution history
gcloud run jobs executions list --job=geoinfo-worker --region=$REGION

# Manual execution
gcloud run jobs execute geoinfo-worker --region=$REGION --wait
```

---

## Cost Estimation (GCP)

**Small Deployment (Development/Testing):**
- Cloud Run (frontend + backend): ~$5-10/month (mostly idle)
- Cloud SQL (db-f1-micro): ~$10-15/month
- Cloud Scheduler: $0.10/month
- Artifact Registry: $0.50/month (storage)
- **Total: ~$15-25/month**

**Medium Deployment (Production - Low Traffic):**
- Cloud Run (with min instances): ~$30-50/month
- Cloud SQL (db-custom-2-4096): ~$50-70/month
- Cloud Scheduler: $0.10/month
- **Total: ~$80-120/month**

**High Deployment (Production - High Traffic):**
- Cloud Run (auto-scaling): ~$150-300/month
- Cloud SQL (HA instance): ~$200-400/month
- Load Balancer: ~$20/month
- **Total: ~$370-720/month**

*Costs are estimates and vary by region and actual usage.*

---

## Next Steps

- See [ARCHITECTURE.md](./ARCHITECTURE.md) for system architecture
- See [EXTENDING-DATA-SOURCES.md](./EXTENDING-DATA-SOURCES.md) for adding new data sources
- Configure monitoring and alerts for production
- Set up CI/CD pipeline with GitHub Actions
- Implement backup and disaster recovery procedures
