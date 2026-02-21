---
name: rag-patterns
description: Reference guide for Retrieval-Augmented Generation (RAG) architectures and best practices.
---

# RAG Patterns & Best Practices

This skill provides a comprehensive guide to implementing robust RAG systems, from basic prototypes to advanced enterprise solutions.

## 🏗️ RAG Architectures

### 1. Naive RAG (Prototype)
- **Flow**: User Query -> Embed -> Vector Search -> Retrieve Top-K -> LLM Generation.
- **Use Case**: Simple Q&A on small documents.
- **Pros**: Easy to implement.
- **Cons**: Low precision, hallucinations, no context awareness.

### 2. Advanced RAG (Optimization Focus)
- **Pre-Retrieval**: Query Expansion (Hypothetical Document Embeddings - HyDE), Query Decomposition, Query Routing.
- **Retrieval**: Hybrid Search (Dense Vector + Sparse Keyword/BM25).
- **Post-Retrieval**: Reranking (Cohere Rerank, Cross-Encoders) to re-sort results by relevance. context Compression.
- **Use Case**: Production Q&A, Knowledge bases.

### 3. Modular RAG (Component-Based)
- **Concept**: Treat retrieval, generation, and processing as separate modules that can be swapped or chained.
- **Modules**:
    - **Search Module**: SerpAPI, Bing Search, Internal Docs.
    - **Memory Module**: Conversation history.
    - **Fusion Module**: Combine multiple retrieval sources (Reciprocal Rank Fusion).
- **Use Case**: Complex systems requiring multiple data sources.

### 4. GraphRAG (Structured Knowledge)
- **Concept**: Combine Vector Search with Knowledge Graphs (Neo4j, ArangoDB).
- **Flow**:
    1.  Extract entities and relationships from docs to build a Graph.
    2.  Query: Search both vector store (unstructured) and Graph (structured relationships).
    3.  Traverse graph to find multi-hop answers.
- **Use Case**: Complex domains (Medical, Legal, Finance) where relationships matter more than semantic similarity.

### 5. Agentic RAG (Autonomous)
- **Concept**: An Agent uses "Tools" to retrieve information. It can formulate its own search queries, critique its own results, and iterate.
- **Tools**: Vector Store Tool, Web Search Tool, SQL Database Tool.
- **Flow**: User Query -> Agent Plan -> Call Tool -> Analyze Result -> (Loop) -> Answer.
- **Use Case**: Complex reasoning tasks requiring multi-step investigation.

## 📝 Embedding & Chunking Strategies

### Chunking
- **Fixed-size**: Simple character/token count (e.g., 512 tokens). **Cons**: Breaks semantic meaning.
- **Recursive**: Split by separators (Markdown headers, paragraphs) to keep context. **Recommended**.
- **Semantic**: Group text by semantic similarity (using embedding distance).
- **Agentic Chunking**: Use an LLM to propositionally chunk text.

### Embedding Models
- **OpenAI**: `text-embedding-3-small` (Fast, cheap), `text-embedding-3-large` (High accuracy).
- **Open Source**: `bge-m3`, `e5-mistral-7b-instruct`. excellent for multilingual or specific domains.

## 🔍 Retrieval Strategies

- **Dense Retrieval**: Semantic search using embeddings. Good for concept matching.
- **Sparse Retrieval**: Keyword search (BM25/Splade). Good for exact term matching (e.g., part numbers, names).
- **Hybrid Search**: Combine Dense + Sparse scores (alpha parameter). **Gold Standard**.
- **Reranking**: Always rerank top 50-100 results to top 5-10 for the LLM. Drastically improves accuracy.

## 📦 Context Assembly (Feeding the LLM)

The retrieved chunks are useless if poorly formatted. Context Assembly is how you **build the prompt context** from raw chunks.

### The Pattern: XML-Delimited Documents

```python
def assemble_context(retrieved_chunks: list[dict]) -> str:
    """Format retrieved chunks into a structured context block.
    
    Uses XML tags for clear document boundaries and includes
    source metadata for citation support.
    """
    # Sort by relevance: most relevant at START and END (Lost-in-the-Middle defense)
    if len(retrieved_chunks) > 4:
        mid = len(retrieved_chunks) // 2
        reordered = (
            retrieved_chunks[:2] +          # Top 2 at start
            retrieved_chunks[mid:-2] +      # Lower relevance in middle
            retrieved_chunks[-2:]            # Top 3-4 at end
        )
    else:
        reordered = retrieved_chunks
    
    context_parts = []
    for i, chunk in enumerate(reordered, 1):
        context_parts.append(
            f'<document id="{i}" source="{chunk["source"]}" relevance="{chunk["score"]:.2f}">\n'
            f'{chunk["text"]}\n'
            f'</document>'
        )
    
    return "\n\n".join(context_parts)

# Usage:
# context = assemble_context(reranked_results)
# prompt = f"Based on the following documents:\n{context}\n\nAnswer: {user_query}"
```

### Rules
1. **Always use delimiters** (XML tags, not just newlines) — models understand boundaries.
2. **Include source metadata** — enables citation in the answer.
3. **Reorder for Lost-in-the-Middle** — put best docs at start and end.
4. **Limit total tokens** — Keep context under 60% of the model's window.

## 🗜️ Context Compression

When retrieved chunks are too verbose, compress them before sending to the LLM. Saves tokens and improves focus.

### Strategy 1: Extractive Compression (Fast, Cheap)
Keep only the most relevant sentences from each chunk.

```python
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain_openai import ChatOpenAI

compressor = LLMChainExtractor.from_llm(ChatOpenAI(model="gpt-4o-mini", temperature=0))

# Compresses each chunk to only the sentences relevant to the query
compressed_docs = compressor.compress_documents(
    documents=retrieved_docs,
    query="What is the return policy?"
)
# 500-token chunk → 80-token extract (only relevant sentences)
```

### Strategy 2: Abstractive Compression (Higher quality)
Summarize chunks into a dense context block.

```python
COMPRESSION_PROMPT = """Summarize the following document in 2-3 sentences,
keeping ONLY information relevant to this question: {query}

Document:
{document}

Relevant summary:"""
```

### When to Compress
- **Yes**: Chunks > 500 tokens, or > 5 chunks retrieved.
- **No**: Chunks are already concise (< 200 tokens), or factual precision is critical (compression may lose details).

## ⚠️ Common Pitfalls

1.  **"Lost in the Middle"**: LLMs tend to forget information in the middle of a long context window. Put the most relevant context at the beginning and end.
2.  **Hallucination**: The model answers confidently but incorrectly. **Fix**: Use "stick to the context" instructions and implementation citations.
3.  **Retrieval Failures**: Relevant doc not retrieved. **Fix**: Improve chunking, use hybrid search, or query expansion.

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Vector DB selection & schema | `vector-databases` |
| Data parsing (PDF, Web, APIs) | `data-ingestion` |
| Prompt design for generation step | `prompt-engineering` |
| Evaluation metrics & golden sets | `rag-evaluation` |
| Reduce cost with caching | `semantic-cache` |
| Security (RBAC, prompt injection) | `ai-security` |
| Tracing & monitoring | `ai-observability` |
