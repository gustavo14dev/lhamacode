---
name: vector-databases
description: Guide to selecting and using Vector Databases for RAG applications.
---

# Vector Databases & Knowledge Stores

This skill guides the selection and implementation of vector stores, the backbone of any RAG system.

## 🗄️ Vector Database Landscape

### 1. Managed / Cloud-Native
- **Pinecone**: The standard for production.
    - **Pros**: Fully managed, serverless option, high availability, metadata filtering.
    - **Cons**: Cost at scale, data privacy (cloud only).
- **Weaviate Cloud**: Strong hybrid search, support for multi-tenancy.

### 2. Open Source / Self-Hosted
- **Chroma**: Developer-friendly, runs in-memory or client/server.
    - **Best For**: Prototyping, local development, small-to-medium datasets.
    - **Language**: Python/JS native.
- **Qdrant**: High performance (Rust), advanced filtering.
    - **Best For**: High-throughput production environments.
- **Milvus**: Built for massive scale (billions of vectors).

### 3. Integrated (SQL + Vector)
- **pgvector (PostgreSQL)**: The "good enough" solution for most apps.
    - **Pros**: Keep vectors with your relational data (Users, Posts). ACID transactions. No new infrastructure.
    - **Cons**: Performance limits at very high scale (>10M vectors) without tuning (IVFFlat/HNSW).
- **MongoDB Atlas**: Document store with vector search capabilities.

## 📐 Schema Design for RAG

Don't just store the vector! You need metadata for filtering.

### Recommended Schema (Generic)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Unique ID (e.g., UUID or URL hash). |
| `vector` | Array[Float] | The embedding (e.g., 1536 dims for OpenAI). |
| `text` | Text | The actual chunk content. |
| `source_url` | String | Link to the original document. |
| `created_at` | DateTime | For recency filtering. |
| `author_id` | String | For multi-tenant access control (RBAC). |
| `doc_type` | String | E.g., "manual", "email", "chat_log". |

## 🔍 Search Strategy Implementation

### Hybrid Search (The Gold Standard)
Pure vector search misses exact keyword matches (e.g., SKUs, names). Hybrid search fixes this.

**Formula**:
`Score = (1 - alpha) * Sparse_Score + (alpha) * Dense_Score`

- **Sparse**: BM25 (Keyword frequency).
- **Dense**: Cosine Similarity (Semantic meaning).

### Metadata Filtering
**Always filter BEFORE searching (Pre-filtering)** if possible.
- *Example*: "Show me `contract.pdf` (filter) related to `indemnity` (search)."
- Efficiently reduces the search space.

## 📏 Distance Metrics

1.  **Cosine Similarity**: Measures the angle between vectors. (Most common for NLP).
    - Range: -1 to 1. 1 = Identical.
2.  **Euclidean Distance (L2)**: Measures straight-line distance.
    - Useful for clustering.
3.  **Dot Product**: Faster, but requires normalized vectors.

## 🚀 Performance Tips

- **Index Type**: Use **HNSW** (Hierarchical Navigable Small World) for fast approximate search.
- **Dimension Reduction**: Using smaller embeddings (e.g., 256 dims vs 1536) speeds up search with minimal accuracy loss (Matryoshka Representation Learning).

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| RAG pipeline architecture | `rag-patterns` |
| Data ingestion into vectors | `data-ingestion` |
| Semantic memory for agents | `agent-memory` |
| Access control (RBAC) on vectors | `ai-security` |
