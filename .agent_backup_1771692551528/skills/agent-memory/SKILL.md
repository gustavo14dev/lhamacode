---
name: agent-memory
description: Patterns for persisting agent state across sessions. Long-term memory, user preferences, episodic recall, and semantic knowledge extraction.
---

# 🧠 Agent Memory (Beyond the Context Window)

An agent without memory is a stranger every time. This skill teaches how to make agents **remember**.

## 1. The 4 Types of Memory

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT MEMORY                         │
├──────────────┬──────────────┬────────────┬──────────────┤
│  SHORT-TERM  │  LONG-TERM   │  EPISODIC  │  SEMANTIC    │
│  (Buffer)    │  (Persistent)│  (Events)  │  (Knowledge) │
├──────────────┼──────────────┼────────────┼──────────────┤
│ Last N msgs  │ User prefs   │ "Client X  │ "Customers   │
│ Current      │ Purchase     │  complained│  from North  │
│ session      │ history      │  about     │  prefer Pix" │
│ state        │ Preferences  │  shipping" │              │
├──────────────┼──────────────┼────────────┼──────────────┤
│ LangGraph    │ PostgreSQL   │ PostgreSQL │ Vector DB    │
│ State        │ / SQLite     │ + timestamp│ (Qdrant)     │
│ (in-memory)  │              │            │              │
├──────────────┼──────────────┼────────────┼──────────────┤
│ TTL: Session │ TTL: Forever │ TTL: 90d   │ TTL: Forever │
└──────────────┴──────────────┴────────────┴──────────────┘
```

### When to Use Each

| Type | Use When | Example |
| :--- | :--- | :--- |
| **Short-term** | Within a single conversation | "User just said they want a blue shirt" |
| **Long-term** | Facts that persist forever | "Daniel prefers Dell notebooks" |
| **Episodic** | Specific events with timestamps | "Order #123 was delayed on 01/10" |
| **Semantic** | Generalized knowledge from patterns | "80% of returns are size-related" |

---

## 2. Storage Backends

### Decision Tree

```
What's your scale?
│
├── Prototype / Local dev
│   └── SQLite (zero config, file-based)
│
├── Production (single service)
│   └── PostgreSQL (ACID, reliable, pgvector for semantic)
│
├── High-frequency reads (session cache)
│   └── Redis (TTL, fast, ephemeral)
│
└── Semantic search over memories
    └── Qdrant / pgvector (vector similarity)
```

### Schema Design (PostgreSQL/SQLite)

```sql
-- Core memory table
CREATE TABLE IF NOT EXISTS agent_memories (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    agent_id    TEXT NOT NULL,
    memory_type TEXT CHECK(memory_type IN ('long_term', 'episodic', 'semantic')),
    content     TEXT NOT NULL,
    metadata    JSON,
    embedding   BLOB,  -- For semantic search (optional)
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at  TIMESTAMP,  -- NULL = never expires
    access_count INTEGER DEFAULT 0
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_memories_user 
ON agent_memories(user_id, memory_type);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_memories_expiry 
ON agent_memories(expires_at) WHERE expires_at IS NOT NULL;
```

---

## 3. Implementation Patterns

### Pattern A: LangGraph Checkpointer (Short-term → Long-term Bridge)

LangGraph has native persistence via `Checkpointers`. This saves the **entire graph state** between invocations.

```python
from langgraph.checkpoint.sqlite import SqliteSaver

# Create a persistent checkpointer
memory = SqliteSaver.from_conn_string(":memory:")  # or "memories.db"

# Compile graph WITH memory
app = workflow.compile(checkpointer=memory)

# Invoke with a thread_id to persist across calls
config = {"configurable": {"thread_id": "user-daniel-session-1"}}
result = app.invoke({"messages": [HumanMessage(content="Hi")]}, config)

# Next call with SAME thread_id resumes conversation
result2 = app.invoke({"messages": [HumanMessage(content="What did I say?")]}, config)
# Agent remembers "Hi" from the previous call!
```

### Pattern B: Memory as a Tool (Agent queries its own memory)

```python
from langchain_core.tools import tool
import sqlite3

@tool
def recall_user_preference(user_id: str, topic: str) -> str:
    """Search the memory database for user preferences on a given topic.
    Use this when the user asks about something they previously mentioned."""
    conn = sqlite3.connect("memories.db")
    cursor = conn.execute(
        "SELECT content FROM agent_memories WHERE user_id = ? AND content LIKE ? ORDER BY created_at DESC LIMIT 3",
        (user_id, f"%{topic}%")
    )
    results = cursor.fetchall()
    conn.close()
    if results:
        return "\n".join([r[0] for r in results])
    return "No memories found for this topic."

@tool  
def save_user_preference(user_id: str, preference: str) -> str:
    """Save an important user preference or fact to long-term memory.
    Use this when the user explicitly states a preference or important fact."""
    conn = sqlite3.connect("memories.db")
    conn.execute(
        "INSERT INTO agent_memories (id, user_id, agent_id, memory_type, content) VALUES (?, ?, ?, ?, ?)",
        (str(uuid4()), user_id, "assistant", "long_term", preference)
    )
    conn.commit()
    conn.close()
    return f"Saved: {preference}"
```

### Pattern C: Memory Injection (System Prompt Enrichment)

```python
def build_system_prompt(user_id: str, base_prompt: str) -> str:
    """Inject relevant memories into the system prompt before each call."""
    conn = sqlite3.connect("memories.db")
    cursor = conn.execute(
        "SELECT content FROM agent_memories WHERE user_id = ? AND memory_type = 'long_term' ORDER BY access_count DESC LIMIT 5",
        (user_id,)
    )
    memories = cursor.fetchall()
    conn.close()
    
    if memories:
        memory_block = "\n".join([f"- {m[0]}" for m in memories])
        return f"{base_prompt}\n\n## Known Facts About This User:\n{memory_block}"
    return base_prompt
```

### Pattern D: Semantic Memory Search (Embedding + Cosine Similarity)

For generalized knowledge ("customers from North prefer Pix"), use vector similarity:

```python
from openai import OpenAI
import numpy as np
import sqlite3
import json

client = OpenAI()

def get_embedding(text: str) -> list[float]:
    """Generate embedding vector for a text."""
    response = client.embeddings.create(
        input=text, model="text-embedding-3-small"
    )
    return response.data[0].embedding

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    a, b = np.array(a), np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def store_semantic_memory(user_id: str, content: str):
    """Store a memory with its embedding for later semantic search."""
    embedding = get_embedding(content)
    conn = sqlite3.connect("memories.db")
    conn.execute(
        "INSERT INTO agent_memories (id, user_id, agent_id, memory_type, content, embedding) VALUES (?, ?, ?, ?, ?, ?)",
        (str(uuid4()), user_id, "assistant", "semantic", content, json.dumps(embedding))
    )
    conn.commit()
    conn.close()

def search_semantic_memory(user_id: str, query: str, top_k: int = 3) -> list[str]:
    """Find memories most semantically similar to the query."""
    query_embedding = get_embedding(query)
    conn = sqlite3.connect("memories.db")
    cursor = conn.execute(
        "SELECT content, embedding FROM agent_memories WHERE user_id = ? AND memory_type = 'semantic'",
        (user_id,)
    )
    
    scored = []
    for content, emb_json in cursor.fetchall():
        stored_embedding = json.loads(emb_json)
        score = cosine_similarity(query_embedding, stored_embedding)
        scored.append((score, content))
    
    conn.close()
    scored.sort(reverse=True)
    return [content for _, content in scored[:top_k]]

# Usage:
# store_semantic_memory("daniel", "Customers from North Brazil prefer paying with Pix")
# results = search_semantic_memory("daniel", "payment preferences in Manaus")
# → Returns: ["Customers from North Brazil prefer paying with Pix"]
```

> **Production Tip:** For large-scale semantic memory (10k+ records), replace SQLite + in-memory cosine with **pgvector** or **Qdrant** for hardware-accelerated ANN (Approximate Nearest Neighbor) search. See `vector-databases` skill.

---

## 4. Memory Lifecycle Management

### Forgetting (Critical for GDPR/LGPD)

```python
# Delete all memories for a user (Right to be Forgotten)
def forget_user(user_id: str):
    conn.execute("DELETE FROM agent_memories WHERE user_id = ?", (user_id,))

# Expire old episodic memories (cleanup job)
def cleanup_expired():
    conn.execute("DELETE FROM agent_memories WHERE expires_at < CURRENT_TIMESTAMP")
```

### Memory Ranking (Recency + Frequency)

Not all memories are equal. Prioritize by:
1. **Recency**: Recent memories are more relevant.
2. **Frequency**: Memories accessed often are important.
3. **Relevance**: Semantic similarity to current query.

```sql
-- Score = recency_weight * (1 / days_old) + frequency_weight * access_count
SELECT *, 
    (1.0 / (julianday('now') - julianday(created_at) + 1)) * 0.7 +
    access_count * 0.3 AS relevance_score
FROM agent_memories 
WHERE user_id = ? 
ORDER BY relevance_score DESC 
LIMIT 5;
```

---

## 5. Security Integration

> 🔴 **MANDATORY**: All memories MUST be scrubbed for PII before storage.

Use `ai-security` skill's Presidio integration:

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from uuid import uuid4
from datetime import datetime
import sqlite3
import json

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def sanitize_memory(text: str, user_id: str, agent_id: str) -> str:
    """Remove PII before storing in memory DB. Logs anonymization actions."""
    results = analyzer.analyze(text=text, language="pt")
    
    if results:
        anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
        
        # Log what was anonymized for LGPD Art. 37 compliance
        conn = sqlite3.connect("memories.db")
        conn.execute(
            "INSERT INTO memory_audit_log (id, user_id, agent_id, action, entities_found, original_hash, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                str(uuid4()), user_id, agent_id, "pii_anonymization",
                json.dumps([{"type": r.entity_type, "score": r.score} for r in results]),
                str(hash(text)),  # Hash only, never store raw PII
                datetime.utcnow().isoformat()
            )
        )
        conn.commit()
        conn.close()
        return anonymized.text
    
    return text
```

### Audit Log Schema (LGPD Art. 37 Compliance)

```sql
-- Tracks all PII anonymization actions for regulatory compliance
CREATE TABLE IF NOT EXISTS memory_audit_log (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    agent_id        TEXT NOT NULL,
    action          TEXT NOT NULL,       -- 'pii_anonymization', 'memory_deleted', 'user_forgotten'
    entities_found  JSON,                -- [{"type": "CPF", "score": 0.95}]
    original_hash   TEXT,                -- SHA hash of original (never raw PII)
    timestamp       TIMESTAMP NOT NULL,
    details         TEXT                 -- Optional additional context
);

CREATE INDEX IF NOT EXISTS idx_audit_user 
ON memory_audit_log(user_id, timestamp DESC);
```

**Rules:**
- Never store raw CPF, email, or phone in memories.
- Use `sanitize_memory()` before every `INSERT`.
- Every anonymization is logged in `memory_audit_log` with entity types and confidence scores.
- Use `original_hash` (not raw text) to correlate entries without exposing PII.

---

## 6. Setup

Use the setup script to create the database:
```bash
python .agent/scripts/setup-memory-db.py --backend sqlite --path memories.db
python .agent/scripts/setup-memory-db.py --backend postgres --url postgresql://user:pass@localhost/mydb
```

---

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Agent architecture | `agentic-patterns` |
| Vector search for semantic memory | `vector-databases` |
| PII protection | `ai-security` |
| Database schema | `database-design` |
