---
description: Step-by-step guide to building a robust RAG (Retrieval-Augmented Generation) pipeline.
---

# 🧠 Build a RAG Pipeline

Follow this workflow to design and implement a RAG system using the AI Architect's standards.

## Phase 1: Requirement & Data Analysis
1.  **Define the Use Case**: Chatbot? Search Engine? Report Generator?
2.  **Analyze Data**:
    - Format: PDF, HTML, JSON, SQL?
    - Volatility: Static (Annual Report) or Dynamic (Stock Prices)?
    - Sensitivity: Public or PII?
3.  **Determine Constraints**:
    - Latency (< 2s?)
    - Cost (Budget per user?)
    - Accuracy (Critical vs. Tolerable error)

## Phase 2: Ingestion & Indexing
1.  **Chunking Strategy**:
    - **Code**: Use language-specific splitters (Python, JS).
    - **Prose**: Use RecursiveCharacterTextSplitter (size: 512-1024, overlap: 10-20%).
2.  **Embedding Model Selection**:
    - **Multilingual**: `text-embedding-3-large` or `bge-m3`.
    - **English/Code**: `text-embedding-3-small`.
3.  **Vector Store Setup**:
    - **Production**: Pinecone / Qdrant Cloud.
    - **Local/Test**: Chroma / Faiss.
    - **Hybrid**: Weaviate / Elasticsearch.

## Phase 3: Retrieval Strategy
1.  **Baseline**: Vector Search (Dense).
2.  **Enhancement (Mandatory for Prod)**: Add Keyword Search (Sparse) = Hybrid Search.
3.  **Reranking**:
    - Implement a Cross-Encoder (Cohere Rerank) to re-order top 25 results.
    - Pass only Top 5-10 to the LLM.

## Phase 4: Generation
1.  **System Prompt**:
    - "You are a helpful assistant. Use the following context to answer. If unsure, say 'I don't know'."
2.  **Context Assembly**:
    - Format retrieved chunks clearly (e.g., `<doc id="1">...</doc>`).
3.  **Model Selection**:
    - Complex Reasoning: GPT-4o / Claude 3.5 Sonnet.
    - Simple Extraction: GPT-4o-mini / Llama 3.

## Phase 5: Evaluation (The "V" in RAG)
**Do not skip this.**
1.  **Dataset**: Create 20-50 Golden Q&A pairs.
2.  **Metrics**:
    - **Context Precision**: Did we retrieve relevant docs?
    - **Answer Faithfulness**: Is the answer derived *only* from context?
    - **Answer Relevance**: Does it answer the user's question?
3.  **Tooling**: Use Ragas or TruLens to automate this.

## Phase 6: Deployment
1.  **Caching**: Cache frequent queries to save costs (Redis/Semantic Cache).
2.  **Feedback Loop**: User Thumbs Up/Down to improve future retrieval.
