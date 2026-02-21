---
name: rag-evaluation
description: Guide to evaluating RAG pipelines using Golden Datasets and LLM-as-a-Judge.
---

# ⚖️ RAG Evaluation (The Truth)

How do you know if your RAG system is actually good? "It feels fast" is not a metric.

## 1. The Components of Quality
RAG has two failure points:
1.  **Retrieval**: Did we find the right document? (Precision/Recall).
2.  **Generation**: Did we answer the question correctly based on the document? (Faithfulness).

## 2. Generating the Golden Dataset
You need a "Golden Set" of 50+ Question-Answer pairs known to be correct.

**Tool**: `.agent/scripts/generate-eval-set.py`
```bash
python .agent/scripts/generate-eval-set.py --file ./my_docs.md --count 10
```
This uses GPT-4o to read your docs and generate hard question-answer pairs.

## 3. The Metrics

### Retrieval Metrics
- **Hit Rate**: Is the correct document in the top 5 results?
- **MRR (Mean Reciprocal Rank)**: How high up is the correct document?

### Generation Metrics (LLM-as-a-Judge)
We ask GPT-4o to grade Llama-3's answer.

- **Faithfulness**: Is the answer derived *only* from the context? (No hallucinations).
- **Answer Relevance**: Does it actually answer the user's question?

## 4. Running the Eval
Use tools like **Ragas** or **DeepEval**, or our internal script:
```bash
# Conceptual usage
python .agent/scripts/evaluate_model.py --test-set golden_set.jsonl --pipeline my_rag
```

## 5. Continuous Improvement
- If Retrieval Score is low -> Improve Chunking / Add Reranker.
- If Generation Score is low -> Improve Prompting / Fine-tune System Prompt.

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Improve retrieval scores | `rag-patterns` (§Retrieval Strategies) |
| Improve generation quality | `prompt-engineering` |
| Fine-tune for domain-specific quality | `llm-finetuning` |
| Monitor eval metrics in prod | `ai-observability` |
