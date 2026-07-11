# Lumen Backend

Python FastAPI backend for Lumen Wellness App. This is a complete migration of the Node.js/TypeScript Express backend to Python 3.13 + FastAPI + SQLAlchemy 2.0.

## Tech Stack
- **Framework**: FastAPI (Async)
- **Database ORM**: SQLAlchemy 2.0 (AsyncPG)
- **Database Engine**: PostgreSQL with `pgvector`
- **Background Jobs**: Dramatiq + Redis
- **Dependency Management**: Standard Python `venv` + `pip` (Hatchling)
- **AI Integration**: Anthropic Claude 3.5 Sonnet & Claude 3 Haiku via `httpx`

## Setup Instructions

1. **Create Virtual Environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -e ".[dev]"
   ```

3. **Run the API Server**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Run Background Workers**:
   ```bash
   dramatiq app.core.events
   ```

## Architecture
- `app/api/routers`: FastAPI route handlers (1-to-1 mapped with existing Express endpoints).
- `app/models`: SQLAlchemy ORM models mirroring Drizzle schema.
- `app/schemas`: Pydantic V2 models for input validation.
- `app/repositories`: Data access layer.
- `app/ai`: AI Agent orchestration (Fitness, Nutrition, Router).
- `app/core`: Configuration, events, logging.

