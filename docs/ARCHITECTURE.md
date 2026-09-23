# Backend Architecture Document

## 1. Tech Stack
- Runtime: Node.js (v20+)
- Framework: Express.js
- Database: PostgreSQL 16
- Query Builder: Knex.js
- Validation: Zod
- Auth: JWT & bcryptjs

## 2. Directory Structure & Layers
Routes -> Controllers -> Services -> Repositories

- Routes: Define HTTP paths.
- Controllers: Handle HTTP requests and responses.
- Services: Contain all business rules and stock transactions.
- Repositories: Execute SQL queries.

## 3. Error Format
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 2 units available",
    "requestId": "req_123"
  }
}