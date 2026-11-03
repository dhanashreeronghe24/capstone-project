# Local PostgreSQL & DBeaver Setup Guide (Developer Reference)

> **Note:** This document provides supplemental developer environment setup instructions and is **not** part of the formal Spec-Driven Development (SDD) contract deliverables.

---

## 1. Creating a PostgreSQL Database & Schema Locally

You can set up your local PostgreSQL database using any of the following approaches:

### Approach A: Using the `psql` Command-Line Interface (CLI)

1. **Access PostgreSQL:**
   ```powershell
   psql -U postgres
   ```
   *(Enter your PostgreSQL password when prompted)*

2. **Create the Project Database:**
   ```sql
   CREATE DATABASE bookworm_db;
   ```

3. **Connect to the Database:**
   ```sql
   \c bookworm_db;
   ```

4. **(Optional) Create a Dedicated Schema:**
   By default, PostgreSQL uses the `public` schema. If you wish to create a dedicated schema:
   ```sql
   CREATE SCHEMA IF NOT EXISTS bookworm;
   SET search_path TO bookworm, public;
   ```

---

### Approach B: Running PostgreSQL via Docker (Fastest Containerized Setup)

If you have Docker Desktop installed, spin up a local PostgreSQL instance:

```powershell
docker run --name postgres-bookworm `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=bookworm_db `
  -p 5432:5432 `
  -d postgres:16-alpine
```

- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `bookworm_db`
- **User:** `postgres`
- **Password:** `postgres`

---

### Approach C: Automated Database & Schema Creation via Prisma ORM

Once the backend project is scaffolded:

1. Configure your `.env` connection string:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bookworm_db?schema=public"
   ```

2. Run the migration command:
   ```powershell
   npx prisma migrate dev --name init
   ```
   *Prisma automatically verifies the connection, creates the database if missing, generates tables, and applies all constraints.*

---

## 2. Connecting to Localhost PostgreSQL from DBeaver

Follow these steps to inspect and manage your local database using **DBeaver Community Edition**:

### Step 1: Create a New Connection
1. Open DBeaver.
2. Click **New Database Connection** (Plug icon with `+` in the top toolbar, or navigate to `Database` $\rightarrow$ `New Database Connection`).
3. Select **PostgreSQL** and click **Next**.

### Step 2: Configure Connection Parameters
In the **Main** settings tab, enter:
- **Host:** `localhost` (or `127.0.0.1`)
- **Port:** `5432`
- **Database:** `bookworm_db` (or `postgres` if creating the DB for the first time)
- **Authentication:** `Database Native`
- **Username:** `postgres` (or your local superuser)
- **Password:** `<your_local_postgres_password>`

### Step 3: Download JDBC Driver (First-Time Only)
If prompted by DBeaver, click **Download** to obtain the official PostgreSQL JDBC driver automatically.

### Step 4: Test and Save Connection
1. Click **Test Connection ...** in the bottom-left corner.
2. Verify the green checkmark with `Connected (PostgreSQL ...)`.
3. Click **Finish**.

---

## 3. Querying & Creating Schemas inside DBeaver

1. **Browse Database Objects:**
   - In the **Database Navigator** panel on the left, expand `bookworm_db` $\rightarrow$ `Schemas` $\rightarrow$ `public` $\rightarrow$ `Tables`.

2. **Open SQL Editor:**
   - Press <kbd>F3</kbd> or right-click `bookworm_db` $\rightarrow$ **SQL Editor** $\rightarrow$ **Open SQL Script**.
   - Type your SQL queries or schema definitions.
   - Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (or click the orange Play icon) to execute statements.

3. **View ER Diagrams:**
   - Double-click on any schema (e.g. `public` or `bookworm`) in the Database Navigator and click the **ER Diagram** tab to visually explore table relationships.
