---
name: semantic-cache
description: Strategies to reduce LLM costs and latency by caching responses based on semantic meaning.
---

# 🧠 Semantic Caching

Traditional caching (Redis key-value) fails for LLMs because users never ask the *exact* same question twice.

**Semantic Caching** stores the *meaning* (vector) of the question. If a new question is semantically similar (e.g., > 0.95 cosine similarity), the cached answer is returned.

## 💰 The ROI of Caching
- **Latency**: 2s -> 0.05s (95% faster).
- **Cost**: $0.01 -> $0.00 (100% cheaper).
- **Consistency**: Guarantees the same answer for similar questions.

## 🛠️ Tools & Libraries

### 1. GPTCache (Open Source)
- **Features**: Specialized for LLM caching. Supports exact match, scalar match, and vector match.
- **Integration**: Works with LangChain, LlamaIndex, OpenAI SDK.
- **Backend**: Can use local files, Redis, Memcached, or Vector DBs.

### 2. Redis (Vector Similarity)
- **Features**: Enterprise-grade speed. Redis Stack includes vector search capability.
- **Pattern**:
    1.  Hash the user query -> Check exact match (L1 Cache).
    2.  Embed user query -> Check vector match (L2 Cache).

## 🚀 Implementation Strategy

### What to Cache?
- **FAQ-style queries**: "What is the return policy?" (High hit rate).
- **Summaries**: "Summarize this 50-page PDF" (High compute cost).
- **Catalog queries**: "Price of iPhone 15" (If using JIT context).

### What NOT to Cache?
- **Personalized queries**: "What is *my* balance?" (Security risk).
- **Creative writing**: "Write a poem about..." (Users want variety).
- **Time-sensitive**: "What is the current time?"

## ⚠️ Cache Invalidation
- **TTL (Time To Live)**: Set a default expiry (e.g., 24h).
- **Event-based**: If the "Return Policy" document is updated, invalidate all cache entries related to "Returns".

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| RAG pipeline (where cache fits) | `rag-patterns` |
| Vector similarity for cache matching | `vector-databases` |
| Observability (cache hit/miss metrics) | `ai-observability` |
