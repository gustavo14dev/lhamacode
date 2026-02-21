import argparse
import sqlite3
import sys

# Usage: 
#   python setup-memory-db.py --backend sqlite --path memories.db
#   python setup-memory-db.py --backend postgres --url postgresql://user:pass@localhost/mydb

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS agent_memories (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    agent_id    TEXT NOT NULL,
    memory_type TEXT CHECK(memory_type IN ('long_term', 'episodic', 'semantic')),
    content     TEXT NOT NULL,
    metadata    TEXT,
    embedding   BLOB,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at  TIMESTAMP,
    access_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS memory_audit_log (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    agent_id        TEXT NOT NULL,
    action          TEXT NOT NULL,
    entities_found  TEXT,
    original_hash   TEXT,
    timestamp       TIMESTAMP NOT NULL,
    details         TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_user 
ON agent_memories(user_id, memory_type);

CREATE INDEX IF NOT EXISTS idx_memories_expiry 
ON agent_memories(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memories_agent 
ON agent_memories(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user 
ON memory_audit_log(user_id, timestamp DESC);
"""

POSTGRES_SCHEMA = """
CREATE TABLE IF NOT EXISTS agent_memories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,
    agent_id    TEXT NOT NULL,
    memory_type TEXT CHECK(memory_type IN ('long_term', 'episodic', 'semantic')),
    content     TEXT NOT NULL,
    metadata    JSONB,
    embedding   VECTOR(1536),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS memory_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL,
    agent_id        TEXT NOT NULL,
    action          TEXT NOT NULL,
    entities_found  JSONB,
    original_hash   TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details         TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_user 
ON agent_memories(user_id, memory_type);

CREATE INDEX IF NOT EXISTS idx_memories_expiry 
ON agent_memories(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memories_agent 
ON agent_memories(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user 
ON memory_audit_log(user_id, timestamp DESC);

-- Optional: Enable pgvector for semantic memory search
-- CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE INDEX IF NOT EXISTS idx_memories_embedding 
-- ON agent_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
"""

def setup_sqlite(path: str):
    print(f"🗄️  Setting up SQLite database at: {path}")
    conn = sqlite3.connect(path)
    conn.executescript(SQLITE_SCHEMA)
    conn.close()
    print("✅ SQLite database ready!")
    print(f"   Tables: agent_memories, memory_audit_log")
    print(f"   Indexes: idx_memories_user, idx_memories_expiry, idx_memories_agent, idx_audit_user")

def setup_postgres(url: str):
    print(f"🐘 Setting up PostgreSQL database...")
    try:
        import psycopg2
    except ImportError:
        print("❌ psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)
    
    try:
        conn = psycopg2.connect(url)
    except psycopg2.OperationalError as e:
        print(f"❌ Connection failed: {e}")
        print("   💡 Check that PostgreSQL is running and the URL is correct.")
        print(f"   💡 URL format: postgresql://user:password@host:port/database")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error connecting to PostgreSQL: {e}")
        sys.exit(1)

    conn.autocommit = True
    cursor = conn.cursor()
    
    for statement in POSTGRES_SCHEMA.strip().split(";"):
        statement = statement.strip()
        if statement and not statement.startswith("--"):
            cursor.execute(statement + ";")
    
    cursor.close()
    conn.close()
    print("✅ PostgreSQL database ready!")
    print("   Tables: agent_memories, memory_audit_log")
    print("   Indexes: idx_memories_user, idx_memories_expiry, idx_memories_agent, idx_audit_user")
    print("   💡 Tip: Uncomment pgvector lines in script for semantic memory search.")

def verify_sqlite(path: str):
    print(f"\n🔍 Verifying SQLite database...")
    conn = sqlite3.connect(path)
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='index'")
    indexes = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    if "agent_memories" in tables:
        print(f"   ✅ Table 'agent_memories' exists")
    else:
        print(f"   ❌ Table 'agent_memories' NOT FOUND")
        return False
    
    expected_indexes = ["idx_memories_user", "idx_memories_expiry", "idx_memories_agent"]
    for idx in expected_indexes:
        if idx in indexes:
            print(f"   ✅ Index '{idx}' exists")
        else:
            print(f"   ⚠️ Index '{idx}' not found")
    
    print("\n🎉 Verification complete!")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Setup Agent Memory Database")
    parser.add_argument("--backend", choices=["sqlite", "postgres"], required=True)
    parser.add_argument("--path", default="memories.db", help="SQLite file path")
    parser.add_argument("--url", help="PostgreSQL connection URL")
    args = parser.parse_args()
    
    if args.backend == "sqlite":
        setup_sqlite(args.path)
        verify_sqlite(args.path)
    elif args.backend == "postgres":
        if not args.url:
            print("❌ --url is required for PostgreSQL backend")
            sys.exit(1)
        setup_postgres(args.url)
