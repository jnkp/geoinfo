# Finnish Statistics Platform - Architecture

## Overview

The Finnish Statistics Platform is a full-stack web application for collecting, storing, and visualizing public statistics from Statistics Finland (StatFin). The platform enables multi-dimensional analysis of statistical data across time, geography, and industry dimensions.

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React Frontend<br/>TypeScript + Vite]
    end

    subgraph "Application Layer"
        API[FastAPI Backend<br/>Async Python]
        Worker[Background Worker<br/>APScheduler]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL<br/>TimeSeries + Spatial)]
    end

    subgraph "External Services"
        StatFin[Statistics Finland<br/>StatFin API]
    end

    UI -->|HTTP/REST| API
    API -->|SQL Queries| DB
    Worker -->|Scheduled Fetches| StatFin
    Worker -->|Store Data| DB
    API -->|On-demand| StatFin

    style UI fill:#4A90E2
    style API fill:#50C878
    style Worker fill:#FFB347
    style DB fill:#9B59B6
    style StatFin fill:#E8E8E8
```

## Component Architecture

### Frontend (React + TypeScript)

```mermaid
graph LR
    subgraph "Pages"
        Dashboard[Dashboard]
        MapView[Map View]
        FetchConfig[Fetch Config]
    end

    subgraph "State Management"
        FilterContext[Filter Context<br/>URL Sync]
        QueryClient[React Query<br/>Cache]
    end

    subgraph "Components"
        RegionMap[Region Map<br/>Leaflet]
        DataChart[Data Chart<br/>Recharts]
        TimeSlider[Time Slider]
        IndustryFilter[Industry Filter]
        DatasetSelector[Dataset Selector]
    end

    subgraph "API Client"
        Client[Fetch Client<br/>Type-safe]
    end

    Dashboard --> FilterContext
    Dashboard --> RegionMap
    Dashboard --> DataChart
    Dashboard --> TimeSlider
    Dashboard --> IndustryFilter

    FilterContext --> Client
    QueryClient --> Client

    Client -->|HTTP| Backend[Backend API]
```

**Key Technologies:**
- **React 18** - UI framework with hooks
- **TypeScript** - Type safety across the application
- **TanStack Query** - Server state management with caching
- **React Router 7** - Client-side routing with URL sync
- **Recharts** - Data visualization charts
- **Leaflet** - Interactive maps with GeoJSON
- **Vite** - Fast build tool and dev server

**Features:**
- URL-synchronized filter state (shareable links)
- Optimistic updates with React Query
- Parallel data fetching with `useQueries`
- Real-time filter updates across components
- Responsive design for mobile/desktop

### Backend (FastAPI + SQLAlchemy)

```mermaid
graph TB
    subgraph "API Routes"
        Statistics[/api/statistics<br/>Multi-dimensional queries]
        Datasets[/api/datasets<br/>CRUD operations]
        Dimensions[/api/dimensions<br/>Reference data]
        Fetch[/api/fetch<br/>Configuration]
        StatFinAPI[/api/statfin<br/>Proxy + browse]
    end

    subgraph "Services"
        StatFinClient[StatFin Client<br/>Async HTTP]
        Fetcher[Data Fetcher<br/>Orchestration]
        Normalizer[Data Normalizer<br/>JSON-stat parser]
    end

    subgraph "Models"
        Dataset[Dataset Model]
        Statistic[Statistic Model]
        Region[Region Model]
        Industry[Industry Model]
        FetchConfig[Fetch Config Model]
    end

    Statistics --> Statistic
    Datasets --> Dataset
    Dimensions --> Region
    Dimensions --> Industry
    Fetch --> FetchConfig
    StatFinAPI --> StatFinClient

    Fetcher --> StatFinClient
    Fetcher --> Normalizer
    Normalizer --> Statistic
```

**Key Technologies:**
- **FastAPI** - Modern async web framework
- **SQLAlchemy 2.0** - Async ORM with type hints
- **Pydantic** - Data validation and serialization
- **asyncpg** - Async PostgreSQL driver
- **httpx** - Async HTTP client for StatFin API
- **Alembic** - Database migrations

**Features:**
- Async request handling for high concurrency
- Connection pooling for database efficiency
- Comprehensive error handling with retries
- OpenAPI documentation at `/docs`
- CORS configured for frontend integration

### Database Schema

```mermaid
erDiagram
    Dataset ||--o{ Statistic : contains
    Region ||--o{ Statistic : dimensions
    Industry ||--o{ Statistic : dimensions
    FetchConfig ||--o{ Dataset : configures

    Dataset {
        string id PK
        string statfin_table_id UK
        string name_fi
        string name_sv
        string name_en
        text description
        string time_resolution
        boolean has_region_dimension
        boolean has_industry_dimension
        datetime created_at
        datetime updated_at
    }

    Statistic {
        int id PK
        string dataset_id FK
        int year
        int quarter
        int month
        string region_code FK
        string industry_code FK
        float value
        string unit
        datetime created_at
    }

    Region {
        string code PK
        string name_fi
        string name_sv
        string name_en
        string region_type
        string parent_code
        geometry geometry
    }

    Industry {
        string code PK
        string name_fi
        string name_sv
        string name_en
        int level
        string parent_code
    }

    FetchConfig {
        int id PK
        string dataset_id FK
        string schedule_cron
        boolean active
        datetime last_run
        datetime next_run
        string status
    }
```

**Indexes:**
- **Composite Index** on `(dataset_id, year, quarter, month, region_code, industry_code)` for fast multi-dimensional queries
- **Individual Indexes** on `year`, `region_code`, `industry_code` for filtered queries
- **GiST Index** on `geometry` for spatial queries

### Background Worker

```mermaid
sequenceDiagram
    participant Scheduler as APScheduler
    participant Worker as Worker Process
    participant StatFin as StatFin API
    participant DB as PostgreSQL

    Scheduler->>Worker: Trigger scheduled job
    Worker->>DB: Load active fetch configs
    loop For each config
        Worker->>StatFin: Fetch JSON-stat data
        StatFin-->>Worker: Return dataset
        Worker->>Worker: Parse JSON-stat format
        Worker->>Worker: Normalize dimensions
        Worker->>DB: Bulk insert statistics
        Worker->>DB: Update fetch config status
    end
    Worker->>Scheduler: Schedule next run
```

**Key Features:**
- **APScheduler** for cron-based scheduling
- Configurable fetch intervals (default: 24 hours)
- Automatic retry logic with exponential backoff
- Bulk inserts for performance
- Status tracking and error logging

## Data Flow

### Fetch Flow (Background)

```mermaid
flowchart TD
    Start([Scheduled Trigger]) --> LoadConfigs[Load Active Fetch Configs]
    LoadConfigs --> CheckConfig{Config Active?}
    CheckConfig -->|No| Skip[Skip]
    CheckConfig -->|Yes| FetchStatFin[Fetch from StatFin API]

    FetchStatFin --> ParseJSON[Parse JSON-stat Format]
    ParseJSON --> NormalizeDims[Normalize Dimensions]
    NormalizeDims --> ValidateData{Data Valid?}

    ValidateData -->|No| LogError[Log Error]
    ValidateData -->|Yes| BulkInsert[Bulk Insert to DB]

    BulkInsert --> UpdateStatus[Update Fetch Config Status]
    UpdateStatus --> ScheduleNext[Schedule Next Run]

    Skip --> End([Complete])
    LogError --> End
    ScheduleNext --> End
```

### Query Flow (Frontend → Backend)

```mermaid
sequenceDiagram
    participant UI as React Frontend
    participant Query as React Query
    participant API as FastAPI Backend
    participant Cache as Query Cache
    participant DB as PostgreSQL

    UI->>Query: useQuery(filters)

    alt Cache Hit
        Query-->>Cache: Check cache
        Cache-->>UI: Return cached data
    else Cache Miss
        Query->>API: GET /api/statistics?filters
        API->>DB: SELECT with WHERE clauses
        DB-->>API: Result set
        API-->>Query: JSON response
        Query->>Cache: Store in cache
        Query-->>UI: Return data
    end

    Note over Query,Cache: Cache TTL: 5 minutes
    Note over API,DB: Connection pool reuse
```

## Multi-Dimensional Query Model

The platform uses a consistent dimensional model for efficient cross-dataset queries:

```mermaid
graph TD
    Query[Statistics Query] --> TimeDim[Time Dimension<br/>Year/Quarter/Month]
    Query --> GeoDim[Geography Dimension<br/>Region Codes]
    Query --> IndDim[Industry Dimension<br/>TOL 2008 Codes]
    Query --> Dataset[Dataset Selection<br/>Multi-select]

    TimeDim --> Composite[Composite Index]
    GeoDim --> Composite
    IndDim --> Composite
    Dataset --> Composite

    Composite --> Results[Optimized Query]

    style Query fill:#4A90E2
    style Composite fill:#FFB347
    style Results fill:#50C878
```

**Benefits:**
- **Fast Queries**: Composite indexes enable sub-second queries even with millions of rows
- **Data Linkage**: Join statistics from different datasets by common dimensions
- **Flexible Filtering**: Filter by any combination of dimensions
- **Comparison**: Compare datasets side-by-side with aligned dimensions

## Security Architecture

```mermaid
flowchart LR
    Internet([Internet]) --> CORS[CORS Middleware]
    CORS --> RateLimit[Rate Limiting]
    RateLimit --> Validation[Input Validation<br/>Pydantic]
    Validation --> API[API Routes]

    API --> AuthZ{Future: Auth}
    AuthZ -->|Authorized| DB[(Database)]
    AuthZ -->|Unauthorized| Deny[403 Forbidden]

    DB --> ReadOnly[Read-only queries<br/>for public data]
    DB --> Admin[Admin operations<br/>Future: require auth]
```

**Current Security:**
- CORS configured for known origins
- Input validation via Pydantic schemas
- SQL injection prevention via SQLAlchemy ORM
- No authentication (public statistics only)

**Future Enhancements:**
- OAuth2 authentication for admin operations
- API keys for programmatic access
- Rate limiting per client
- Audit logging

## Deployment Architecture

### Local Development

```mermaid
graph TB
    subgraph "Docker Compose"
        Frontend[Frontend:5173<br/>Vite Dev Server]
        Backend[Backend:8000<br/>Uvicorn + Reload]
        Worker[Worker<br/>APScheduler]
        DB[(PostgreSQL:5432)]
    end

    Frontend -.->|Volume Mount| FrontendCode[./frontend]
    Backend -.->|Volume Mount| BackendCode[./backend]
    Worker -.->|Volume Mount| BackendCode

    Dev[Developer] -->|Hot Reload| Frontend
    Dev -->|Hot Reload| Backend

    style Frontend fill:#4A90E2
    style Backend fill:#50C878
    style Worker fill:#FFB347
    style DB fill:#9B59B6
```

### Production (GCP - Future)

```mermaid
graph TB
    subgraph "Google Cloud Platform"
        LB[Cloud Load Balancer<br/>HTTPS]

        subgraph "Cloud Run"
            Frontend[Frontend Service<br/>Static + SSR]
            Backend[Backend Service<br/>Auto-scaling]
        end

        subgraph "Cloud SQL"
            DB[(PostgreSQL<br/>HA + Backups)]
        end

        subgraph "Cloud Scheduler"
            Scheduler[Scheduled Jobs] --> Worker[Worker Cloud Run Job]
        end

        subgraph "Artifact Registry"
            Images[Docker Images]
        end
    end

    User([Users]) --> LB
    LB --> Frontend
    Frontend --> Backend
    Backend --> DB
    Worker --> DB

    CI[GitHub Actions] --> Images
    Images --> Frontend
    Images --> Backend
    Images --> Worker

    style LB fill:#E8E8E8
    style Frontend fill:#4A90E2
    style Backend fill:#50C878
    style Worker fill:#FFB347
    style DB fill:#9B59B6
```

## Performance Characteristics

| Component | Metric | Target | Notes |
|-----------|--------|--------|-------|
| Frontend Load | Initial Load | < 2s | With code splitting |
| API Response | P95 Latency | < 200ms | Simple queries |
| API Response | P95 Latency | < 1s | Complex multi-dataset |
| Database | Query Time | < 100ms | With indexes |
| Background Fetch | Processing | ~1000 rows/s | Bulk insert |
| React Query Cache | Hit Rate | > 80% | 5-minute TTL |

## Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React | 18.x | UI framework |
| Frontend | TypeScript | 5.x | Type safety |
| Frontend | Vite | 5.x | Build tool |
| Frontend | TanStack Query | 5.x | Data fetching |
| Frontend | Recharts | 2.x | Charts |
| Frontend | Leaflet | 1.9.x | Maps |
| Backend | Python | 3.11+ | Runtime |
| Backend | FastAPI | 0.110+ | Web framework |
| Backend | SQLAlchemy | 2.0+ | ORM |
| Backend | Pydantic | 2.x | Validation |
| Backend | APScheduler | 3.x | Job scheduling |
| Database | PostgreSQL | 15+ | Data store |
| Database | PostGIS | (optional) | Spatial data |
| DevOps | Docker | 24+ | Containerization |
| DevOps | Docker Compose | 2.x | Orchestration |

## Next Steps

- See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions
- See [EXTENDING-DATA-SOURCES.md](./EXTENDING-DATA-SOURCES.md) for adding new data sources
- See [API Documentation](http://localhost:8000/docs) when running locally
