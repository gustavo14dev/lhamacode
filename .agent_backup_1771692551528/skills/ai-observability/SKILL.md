---
name: ai-observability
description: Standards for tracing, monitoring, and evaluating AI applications in production.
---

# 🔭 AI Observability & Tracing

You cannot improve what you cannot measure. Observability is the "Black Box Recorder" for your AI system.

## 📡 Tracing (The "X-Ray")

Tracing visualizes the entire execution chain provided by the AI.

### Tools
- **LangSmith (Cloud)**: Best for LangChain users. Zero-setup, great visualization.
- **Arize Phoenix (Open Source)**: Excellent local tracing. Runs in docker. Great for privacy-sensitive apps.

### What to Trace
1.  **Retriever**: exactly *which* chunks were retrieved? (Check relevance).
2.  **Reranker**: How did the score change? (Check ranking quality).
3.  **LLM**: What was the exact system prompt? (Check injection/errors).
4.  **Tools**: What API arguments were passed? (Check logic).

## 📊 Key Metrics

| Metric | Definition | Why it matters |
| :--- | :--- | :--- |
| **TTFT (Time to First Token)** | Time from user enter to first word appearing. | User perception of speed. Target < 1.5s. |
| **Total Latency** | Time to complete the full answer. | Overall system performance. |
| **Token Usage** | Input + Output tokens per query. | Direct cost correlation. |
| **Retrieval Score** | Similarity score of top chunk. | Low score = "I don't know" or missing data. |

## 🔁 Feedback Loops

The most valuable data is user feedback.
1.  **Explicit**: User click "Thumbs Up/Down".
    - *Action*: Save the (Question, Answer, Feedback) to a "Fine-tuning Dataset".
2.  **Implicit**: User rephrases the question immediately.
    - *Action*: Flag the first turn as a potential failure.

## 🛠️ Implementation Pattern (Python)

```python
# Phoenix OTLP setup
from phoenix.otel import register
tracer_provider = register(
    project_name="my-rag-app",
    endpoint="http://localhost:6006/v1/traces"
)
```

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| RAG pipeline to observe | `rag-patterns` |
| Evaluation framework (offline metrics) | `rag-evaluation` |
| Cache hit/miss monitoring | `semantic-cache` |
| Security alerting | `ai-security` |
