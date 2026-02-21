---
name: dataset-curation
description: Strategies for creating, cleaning, and formatting datasets for LLM training.
---

# 📚 Dataset Curation (Garbage In, Garbage Out)

The quality of your data matters 10x more than the training hyperparameters.

## 📝 Data Formats

### 1. Instruction Format (Alpaca/ShareGPT)
The standard for chat models.
```json
[
  {
    "instruction": "Summarize the error log.",
    "input": "[2025-01-01] Error 500: Database lock...",
    "output": "The database entered a deadlock state at midnight."
  }
]
```

### 2. ChatML (OpenAI Format)
Better for multi-turn conversations.
```json
{"messages": [
  {"role": "user", "content": "Hi"},
  {"role": "assistant", "content": "Hello!"}
]}
```

## 🏭 Synthetic Data Generation (Distillation)
Don't write 1,000 examples by hand. Use GPT-4 to teach Llama-3.

### Pipeline: Seed → Expand → Filter

1.  **Seed Data**: Write 10 perfect examples manually.
2.  **Expansion**: Ask GPT-4 to generate more examples similar to your seeds.
3.  **Filtration**: Remove hallucinations, short answers, and duplicates.

```python
from openai import OpenAI
import json

client = OpenAI()

def generate_synthetic_data(
    seed_examples: list[dict],
    n_generate: int = 50,
    domain: str = "customer support"
) -> list[dict]:
    """Use GPT-4o to generate training examples from seed data."""
    seeds_text = json.dumps(seed_examples[:5], indent=2, ensure_ascii=False)
    
    response = client.chat.completions.create(
        model="gpt-4o",
        temperature=0.8,
        messages=[{
            "role": "system",
            "content": f"You are a dataset generator for {domain}."
        }, {
            "role": "user",
            "content": (
                f"Here are {len(seed_examples)} seed examples:\n{seeds_text}\n\n"
                f"Generate {n_generate} NEW diverse examples in the EXACT same JSON format. "
                f"Vary the topics, complexity, and phrasing. Return a JSON array."
            )
        }],
        response_format={"type": "json_object"}
    )
    
    generated = json.loads(response.choices[0].message.content)
    examples = generated.get("examples", generated.get("data", []))
    
    # Filter: remove short outputs
    filtered = [ex for ex in examples if len(ex.get("output", "").split()) >= 10]
    print(f"✅ Generated {len(examples)}, kept {len(filtered)} after filtering")
    return filtered

# Usage:
# seeds = [{"instruction": "...", "input": "...", "output": "..."}]
# synthetic = generate_synthetic_data(seeds, n_generate=50, domain="e-commerce support")
```

### Quality Validation (Post-Generation)
After generating, validate quality before training:

```python
def validate_synthetic_quality(examples: list[dict]) -> dict:
    """Check synthetic data quality before training."""
    issues = {"short": 0, "no_output": 0, "duplicate_output": 0}
    seen_outputs = set()
    
    for ex in examples:
        output = ex.get("output", "")
        if not output:
            issues["no_output"] += 1
        elif len(output.split()) < 10:
            issues["short"] += 1
        if output in seen_outputs:
            issues["duplicate_output"] += 1
        seen_outputs.add(output)
    
    total_issues = sum(issues.values())
    print(f"📊 Quality: {len(examples) - total_issues}/{len(examples)} clean")
    for issue, count in issues.items():
        if count > 0:
            print(f"   ⚠️ {issue}: {count}")
    return issues
```

## 🧹 Cleaning Checklist
1.  **Deduplication**: Remove exact duplicates (MinHash LSH).
2.  **PII Scrubbing**: Remove emails/phones (use `ai-security`).
3.  **Length Filtering**: Drop examples with < 10 tokens (too short to learn).

```python
import hashlib

def deduplicate(examples: list[dict]) -> list[dict]:
    """Remove exact duplicate examples by content hash."""
    seen = set()
    unique = []
    for ex in examples:
        content_hash = hashlib.md5(
            (ex.get("input", "") + ex.get("output", "")).encode()
        ).hexdigest()
        if content_hash not in seen:
            seen.add(content_hash)
            unique.append(ex)
    removed = len(examples) - len(unique)
    if removed:
        print(f"🧹 Removed {removed} duplicates ({removed/len(examples)*100:.1f}%)")
    return unique

def filter_by_length(examples: list[dict], min_tokens: int = 10) -> list[dict]:
    """Drop examples where output is too short to teach anything."""
    return [ex for ex in examples if len(ex.get("output", "").split()) >= min_tokens]
```

## ✂️ Dataset Splitting (Critical!)

> [!CAUTION]
> **NUNCA treine no dataset inteiro.** Sem split, é impossível detectar overfitting.

### Why Split?
| Split | % | Purpose |
| :--- | :---: | :--- |
| **Train** | 80% | Model learns from this |
| **Validation** | 10% | Monitor loss during training (early stopping) |
| **Test** | 10% | Final score AFTER training (never seen by model) |

### Implementation

```python
import json
import random

def split_dataset(
    input_path: str,
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    seed: int = 42
) -> dict[str, list]:
    """Split JSONL into train/val/test sets with reproducibility."""
    with open(input_path, 'r', encoding='utf-8') as f:
        data = [json.loads(line) for line in f]
    
    random.seed(seed)
    random.shuffle(data)
    
    n = len(data)
    train_end = int(n * train_ratio)
    val_end = train_end + int(n * val_ratio)
    
    splits = {
        "train": data[:train_end],
        "val": data[train_end:val_end],
        "test": data[val_end:]
    }
    
    # Save each split
    for name, subset in splits.items():
        out_path = input_path.replace(".jsonl", f"_{name}.jsonl")
        with open(out_path, 'w', encoding='utf-8') as f:
            for ex in subset:
                f.write(json.dumps(ex) + "\n")
        print(f"💾 {name}: {len(subset)} examples → {out_path}")
    
    return splits

# Usage: split_dataset("train.jsonl")
# Output: train_train.jsonl (80%), train_val.jsonl (10%), train_test.jsonl (10%)
```

### Validation Report

Before training, always print a dataset health report:

```python
def dataset_report(path: str) -> None:
    """Print quality metrics for a JSONL dataset."""
    with open(path, 'r', encoding='utf-8') as f:
        data = [json.loads(line) for line in f]
    
    output_lengths = [len(ex.get("output", "").split()) for ex in data]
    
    print(f"📊 Dataset Report: {path}")
    print(f"   Total examples: {len(data)}")
    print(f"   Avg output length: {sum(output_lengths)/len(output_lengths):.0f} words")
    print(f"   Min output length: {min(output_lengths)} words")
    print(f"   Max output length: {max(output_lengths)} words")
    print(f"   Short outputs (<10 words): {sum(1 for l in output_lengths if l < 10)}")
```

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Training the model after data prep | `llm-finetuning` |
| PII scrubbing for training data | `ai-security` |
| Ingesting data from PDFs/web | `data-ingestion` |
| Evaluating the trained model | `rag-evaluation` (§LLM-as-a-Judge) |

