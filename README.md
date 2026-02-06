# Finnish Statistics Platform

A full-stack web application for collecting, storing, and visualizing public statistics from Statistics Finland (StatFin). The platform enables multi-dimensional analysis of statistical data across time, geography, and industry dimensions.

## Features

- **Multi-dimensional Data Analysis** - Filter and visualize statistics across time, region, and industry
- **Interactive Visualizations** - Interactive maps, charts, and time sliders
- **Automated Data Collection** - Background worker fetches data from StatFin API
- **Cross-dataset Comparison** - Link and compare statistics from multiple datasets
- **Modern Tech Stack** - React + TypeScript frontend, FastAPI + Python backend, PostgreSQL database

## Quick Start

```bash
# Clone the repository
git clone https://github.com/jnkp/geoinfo.git
cd geoinfo

# Create environment file
cp .env.example .env

# Start all services with Docker Compose
docker-compose --profile full up -d

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Documentation: http://localhost:8000/docs
```

## Documentation

### Core Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture with Mermaid diagrams
  - Component architecture (Frontend, Backend, Database)
  - Data flow diagrams
  - Multi-dimensional query model
  - Performance characteristics

- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment instructions
  - Local development setup
  - Google Cloud Platform deployment
  - Configuration reference
  - Monitoring and troubleshooting

- **[EXTENDING-DATA-SOURCES.md](docs/EXTENDING-DATA-SOURCES.md)** - Adding new data sources
  - Integration architecture
  - Step-by-step implementation guide
  - Example integrations (Eurostat, CSV import)
  - Best practices

### Additional Documentation

- **API Documentation**: Available at http://localhost:8000/docs (when running locally)
- **QA Report**: See `.auto-claude/specs/001-planning/qa_report.md` for implementation details

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TanStack Query** - Server state management
- **Recharts** - Data visualization
- **Leaflet** - Interactive maps

### Backend
- **Python 3.11+** - Runtime
- **FastAPI** - Web framework
- **SQLAlchemy 2.0** - Async ORM
- **PostgreSQL 15** - Database
- **APScheduler** - Background jobs

### DevOps
- **Docker & Docker Compose** - Containerization
- **Alembic** - Database migrations
- **pytest** - Testing (backend)
- **Vitest** - Testing (frontend)

## Project Structure

```
geoinfo/
├── backend/                # Python FastAPI backend
│   ├── api/               # API routes
│   │   └── routes/        # Endpoints (statistics, datasets, etc.)
│   ├── models/            # SQLAlchemy models
│   ├── services/          # Business logic (StatFin client, data fetcher)
│   ├── tests/             # Backend tests
│   ├── alembic/           # Database migrations
│   ├── main.py            # FastAPI application
│   └── worker.py          # Background worker (APScheduler)
├── frontend/              # React TypeScript frontend
│   ├── src/
│   │   ├── components/    # React components (charts, maps, filters)
│   │   ├── pages/         # Page components (Dashboard, MapView)
│   │   ├── api/           # API client (type-safe fetch)
│   │   ├── context/       # State management (FilterContext)
│   │   └── hooks/         # Custom hooks
│   └── vite.config.ts     # Vite configuration
├── docs/                  # Documentation
│   ├── ARCHITECTURE.md    # System architecture
│   ├── DEPLOYMENT.md      # Deployment guide
│   └── EXTENDING-DATA-SOURCES.md  # Integration guide
├── scripts/               # Utility scripts
├── docker-compose.yml     # Docker orchestration
└── README.md             # This file
```

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐
│  React Frontend │─────▶│  FastAPI Backend│
│  (TypeScript)   │◀─────│    (Python)     │
└─────────────────┘      └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │   PostgreSQL    │
                         │    Database     │
                         └────────▲────────┘
                                  │
                         ┌────────┴────────┐
                         │ Background      │
                         │ Worker          │
                         │ (APScheduler)   │
                         └─────────────────┘
                                  ▲
                                  │
                         ┌────────┴────────┐
                         │  Statistics     │
                         │  Finland API    │
                         └─────────────────┘
```

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed diagrams and explanations.

## Development

### Prerequisites

- Docker 24+ and Docker Compose 2+
- For local development without Docker:
  - Python 3.11+
  - Node.js 20+
  - PostgreSQL 15+

### Running Locally

```bash
# Start database only
docker-compose up -d db

# Run backend (in separate terminal)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Run frontend (in separate terminal)
cd frontend
npm install
npm run dev
```

### Database Migrations

```bash
# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback migration
docker-compose exec backend alembic downgrade -1
```

### Running Tests

```bash
# Backend tests
docker-compose exec backend pytest tests/ -v

# Frontend tests
docker-compose exec frontend npm test

# E2E tests
docker-compose exec backend pytest tests/test_e2e_flow.py -v
```

## Configuration

### Environment Variables

Create `.env` file based on `.env.example`:

```bash
# Database
POSTGRES_USER=geoinfo
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=geoinfo

# Backend
DATABASE_URL=postgresql://geoinfo:your_secure_password@db:5432/geoinfo
STATFIN_BASE_URL=https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin
FETCH_INTERVAL_HOURS=24

# Frontend
VITE_API_URL=http://localhost:8000
```

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete configuration reference.

## Deployment

### Local (Docker Compose)

```bash
docker-compose --profile full up -d
```

### Google Cloud Platform

See detailed instructions in [DEPLOYMENT.md](docs/DEPLOYMENT.md#gcp-deployment).

Quick overview:
- **Cloud Run** - Frontend and backend services
- **Cloud SQL** - PostgreSQL database
- **Cloud Scheduler** - Background data fetching
- **Artifact Registry** - Docker images

Estimated cost: $15-25/month for development, $80-120/month for production.

## Contributing

This project was initially scaffolded by Auto-Claude and is designed to be extended with additional data sources and features.

To add a new data source:
1. Read [EXTENDING-DATA-SOURCES.md](docs/EXTENDING-DATA-SOURCES.md)
2. Create a client in `backend/services/`
3. Add normalization logic
4. Create API routes
5. Add tests

## Data Sources

### Currently Supported

- **Statistics Finland (StatFin)** - Finnish national statistics
  - URL: https://pxdata.stat.fi/PxWeb/
  - Coverage: Comprehensive Finnish statistics
  - Format: JSON-stat

### Potential Extensions

See [EXTENDING-DATA-SOURCES.md](docs/EXTENDING-DATA-SOURCES.md) for guides on adding:
- Eurostat (European statistics)
- OECD (International statistics)
- Custom CSV imports
- Custom database integrations

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Built with [Statistics Finland (StatFin)](https://www.stat.fi/index_en.html) open data
- Initial implementation scaffolded by [Auto-Claude](https://github.com/AndyMik90/Auto-Claude)
- Visualization powered by [Recharts](https://recharts.org/) and [Leaflet](https://leafletjs.com/)

## Support

For questions or issues:
- Check the [documentation](docs/)
- Review the [API documentation](http://localhost:8000/docs) (when running locally)
- See the QA report for implementation details

---

**Built with 🇫🇮 for analyzing Finnish public statistics**
