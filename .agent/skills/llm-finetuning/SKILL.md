---
name: llm-finetuning
description: Guide to creating specialized 'Student' models using LoRA and QLoRA.
---

# 🎓 LLM Fine-tuning & Specialization

Generalist models (GPT-4) are smart but expensive and slow. Specialist models (Llama-3-8B) are fast, cheap, and can outperform GPT-4 on narrow tasks if trained correctly.

## 🛠️ Concepts

### 1. Pre-training vs. Fine-tuning
- **Pre-training**: Teaching a model to speak English (Expensive, requires clusters).
- **Fine-tuning**: Teaching a model to follow *your* instructions or learn *your* jargon (Cheap, runs on 1 GPU).

### 2. PEFT (Parameter-Efficient Fine-Tuning)
We don't retrain all 8 billion parameters. We train a small "Adapter" layer (1% of parameters).
- **LoRA**: Adds low-rank matrices to attention layers.
- **QLoRA**: Does LoRA on a 4-bit quantized model (Fits on consumer GPUs).

### 3. Choosing a Base Model

> [!TIP]
> The base model determines your ceiling. Choose wisely before spending hours training.

| Model | Size | VRAM (4-bit) | Strengths | Unsloth ID |
| :--- | :---: | :---: | :--- | :--- |
| **Llama 3.1** | 8B | ~5 GB | Best all-around, strong Portuguese | `unsloth/llama-3-8b-bnb-4bit` |
| **Mistral** | 7B | ~4.5 GB | Fast inference, good reasoning | `unsloth/mistral-7b-bnb-4bit` |
| **Phi-3** | 3.8B | ~2.5 GB | Smallest, runs on laptops | `unsloth/Phi-3-mini-4k-instruct-bnb-4bit` |
| **Gemma 2** | 9B | ~5.5 GB | Google quality, great coding | `unsloth/gemma-2-9b-bnb-4bit` |
| **Qwen 2.5** | 7B | ~4.5 GB | Best multilingual, strong math | `unsloth/Qwen2.5-7B-bnb-4bit` |

**Recommendation by Use Case**:

| Use Case | Best Base | Why |
| :--- | :--- | :--- |
| E-commerce support (PT-BR) | Llama 3.1 8B | Strong Portuguese + best all-around |
| Code generation | Gemma 2 9B | Google's coding strength |
| Resource-constrained (laptop) | Phi-3 3.8B | Runs on 4GB VRAM |
| Multilingual (3+ languages) | Qwen 2.5 7B | Best multilingual performance |
| General chat / RAG pipeline | Mistral 7B | Fast, efficient, good enough |

## 🤔 Decision Tree: Fine-tune vs Prompt Engineering?

> [!IMPORTANT]
> Fine-tuning is expensive. Before starting, confirm it's the right approach.

```
Is GPT-4o with few-shot prompting solving your task well?
│
├── YES → Don't fine-tune. Use prompt engineering.
│
└── NO → Why not?
    │
    ├── "Doesn't know my domain jargon"
    │   └── ✅ Fine-tune with domain examples
    │
    ├── "Too slow or too expensive at scale"
    │   └── ✅ Fine-tune a smaller model (8B)
    │
    ├── "Wrong output format/style"
    │   └── Try structured output first → Still bad? → ✅ Fine-tune
    │
    └── "Hallucinating facts"
        └── ❌ Fine-tuning won't help. Use RAG instead.
```

**Rule of Thumb**:
- **< 100 queries/day**: Prompt engineering is cheaper
- **> 1,000 queries/day**: Fine-tuned local model pays for itself in 2 weeks
- **Privacy requirement**: Fine-tuned local model is mandatory

## 🚀 Recommended Workflow (Internal)

We have internal tools to handle this. No need for Colab.

### 1. Train (`.agent/scripts/train_model.py`)
Fine-tune Llama-3-8B on your local machine (WSL2) or remote server.
```bash
python .agent/scripts/train_model.py --dataset train.jsonl --output my_finetuned_model --val-split 0.1
```
- **Requirements**: NVIDIA GPU (T4, A10, RTX 30xx/40xx).
- **Output**: A GGUF model ready for Ollama.

### 2. Evaluate (`.agent/scripts/evaluate_model.py`)
Don't trust the loss curve. Trust the Judge.
```bash
python .agent/scripts/evaluate_model.py --test-set test.jsonl --ft-output predictions.jsonl
```
- **Logic**: Uses GPT-4o to score your model's answers vs. Ground Truth (1-5 scale).
- **Success**: If Score > 4.0, deploy.

### Complementary Metrics (Sanity Checks)

LLM-as-a-Judge is the **primary** metric. Use these as **fast, cheap supplements**:

| Metric | What it Measures | When to Use | Cost |
| :--- | :--- | :--- | :---: |
| **LLM-as-a-Judge** | Overall quality (accuracy + style) | Always (primary) | 💰💰 |
| **ROUGE-L** | Longest common subsequence vs reference | Summarization tasks | Free |
| **BLEU** | N-gram overlap vs reference | Translation tasks | Free |
| **Perplexity** | How "surprised" the model is by text | General health check | Free |
| **Exact Match** | 100% match with expected answer | Classification, extraction | Free |

```python
from rouge_score import rouge_scorer
import math

def rouge_l(prediction: str, reference: str) -> float:
    """ROUGE-L: longest common subsequence overlap."""
    scorer = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=True)
    return scorer.score(reference, prediction)["rougeL"].fmeasure

def perplexity_from_loss(eval_loss: float) -> float:
    """Convert eval loss to perplexity. Lower = better."""
    return math.exp(eval_loss)

# Usage:
# rouge = rouge_l("Model says X", "Ground truth says X")  # → 0.85
# ppl = perplexity_from_loss(2.1)  # → 8.17 (good < 20)
```

## 🩺 Training Diagnostics

### Reading Loss Curves

```
HEALTHY TRAINING:           OVERFITTING:              UNDERFITTING:
Loss                        Loss                      Loss
│ ╲                         │ ╲   val ──────           │ ╲
│  ╲                        │  ╲  ╱                    │  ────────── train
│   ╲── train               │   ╳                      │   ────────── val
│    ╲── val                 │  ╱ ╲                     │
│     ────── (converge)      │ ╱   train ──────         │
└──────────── Steps          └──────────── Steps        └──────────── Steps
→ Good! Deploy.              → Too many steps.          → More data needed.
```

### Problem → Diagnosis → Action

| Symptom | Diagnosis | Fix |
| :--- | :--- | :--- |
| `eval_loss` rises while `train_loss` drops | **Overfitting** | Reduce `--steps`, add more data, increase `lora_dropout` |
| Both losses stay high | **Underfitting** | Increase `r` (rank), increase `--steps`, check data quality |
| `eval_loss` oscillates wildly | **Learning rate too high** | Reduce `learning_rate` (try `5e-5`) |
| Model forgets general tasks after fine-tuning | **Catastrophic forgetting** | Use lower `r`, fewer steps, or mix 20% general data |

### Catastrophic Forgetting Prevention

When you fine-tune aggressively, the model "forgets" its general abilities. Prevention:

1. **Low rank (`r=8-16`)**: Smaller adapter = less disruption to base weights
2. **Fewer steps**: 30-100 steps is often enough for narrow tasks
3. **Data mixing**: Add 20% general instruction-following examples to training data
4. **Evaluation spread**: Test both domain AND general tasks after training

```python
def mix_general_data(domain_data: list, general_data: list, general_ratio: float = 0.2) -> list:
    """Mix domain training data with general examples to prevent forgetting."""
    import random
    n_general = int(len(domain_data) * general_ratio)
    sampled = random.sample(general_data, min(n_general, len(general_data)))
    mixed = domain_data + sampled
    random.shuffle(mixed)
    print(f"📊 Mixed: {len(domain_data)} domain + {len(sampled)} general = {len(mixed)} total")
    return mixed
```

### 3. Deploy (Production Guide)

#### a. Quantization Options
Choose the right quantization for your hardware:

| Method | Size | Speed | Quality | Best For |
| :--- | :---: | :---: | :---: | :--- |
| `f16` | 16 GB | ⚡ | ★★★★★ | Servers with 24GB+ VRAM |
| `q8_0` | 8.5 GB | ⚡⚡ | ★★★★☆ | Best quality-to-size ratio |
| `q5_k_m` | 5.7 GB | ⚡⚡⚡ | ★★★☆☆ | Good balance |
| `q4_k_m` | 4.4 GB | ⚡⚡⚡⚡ | ★★★☆☆ | Consumer GPUs (default) |

```bash
# Export with different quantization
model.save_pretrained_gguf("model_q8", tokenizer, quantization_method="q8_0")
model.save_pretrained_gguf("model_q4", tokenizer, quantization_method="q4_k_m")
```

#### b. Serve via Ollama (Local API)
```bash
# 1. Create Modelfile
cat > Modelfile << 'EOF'
FROM ./model-unsloth.Q4_K_M.gguf
SYSTEM "You are a specialized e-commerce assistant for Tvlar."
PARAMETER temperature 0.3
PARAMETER num_ctx 2048
EOF

# 2. Register model
ollama create my-specialist -f Modelfile

# 3. Serve as API (port 11434)
ollama serve  # Runs at http://localhost:11434

# 4. Test
curl http://localhost:11434/api/generate -d '{"model": "my-specialist", "prompt": "Hello"}'
```

#### c. Model Drift Monitoring
After deployment, track quality over time:

```python
import json
from datetime import datetime

def log_prediction(query: str, response: str, user_feedback: int | None = None):
    """Log each prediction for drift analysis."""
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "query": query,
        "response": response,
        "feedback": user_feedback,  # 1-5 or None
        "response_length": len(response.split()),
    }
    with open("predictions_log.jsonl", "a") as f:
        f.write(json.dumps(entry) + "\n")

def check_drift(log_path: str = "predictions_log.jsonl", window: int = 100):
    """Detect quality drift by comparing recent vs historical feedback."""
    with open(log_path) as f:
        entries = [json.loads(l) for l in f if json.loads(l).get("feedback")]
    
    if len(entries) < window * 2:
        print("📊 Not enough data for drift detection yet.")
        return
    
    old_avg = sum(e["feedback"] for e in entries[:-window]) / len(entries[:-window])
    new_avg = sum(e["feedback"] for e in entries[-window:]) / window
    
    delta = new_avg - old_avg
    print(f"📊 Drift: {old_avg:.2f} → {new_avg:.2f} (Δ={delta:+.2f})")
    if delta < -0.5:
        print("⚠️  Significant quality drop detected! Consider retraining.")
```

#### d. Rollback Strategy
Always keep previous model versions:

```bash
# Version your models
ollama create my-specialist-v1 -f Modelfile.v1
ollama create my-specialist-v2 -f Modelfile.v2

# Rollback: switch back to v1
# In your application, just change the model name:
#   model = "my-specialist-v1"  # rollback
```

#### e. Multi-Model Routing (Fine-tuned + GPT-4o Fallback)

```python
from openai import OpenAI

def smart_route(query: str, confidence_threshold: float = 0.7) -> str:
    """Route to fine-tuned model first, fallback to GPT-4o if uncertain."""
    # 1. Try fine-tuned model (fast, cheap)
    local = OpenAI(base_url="http://localhost:11434/v1", api_key="unused")
    local_response = local.chat.completions.create(
        model="my-specialist",
        messages=[{"role": "user", "content": query}],
        temperature=0.3,
    )
    answer = local_response.choices[0].message.content
    
    # 2. Simple confidence heuristic
    is_uncertain = any(phrase in answer.lower() for phrase in [
        "i'm not sure", "i don't know", "i cannot", "unclear"
    ])
    
    if is_uncertain:
        # 3. Fallback to GPT-4o (slower, expensive, smarter)
        cloud = OpenAI()  # Uses OPENAI_API_KEY
        cloud_response = cloud.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": query}],
        )
        return cloud_response.choices[0].message.content
    
    return answer
```

## 🛡️ Security (Fine-tuning Threats)

### 1. Data Poisoning
**Risk**: Malicious examples injected into training data that teach the model bad behavior (e.g., "always ignore safety rules").

**Defense**:
- **Manual review**: Inspect a random 10% sample before training.
- **Automated scan**: Flag examples with instruction-like outputs.

```python
import re

POISON_PATTERNS = [
    r"ignore\s+(all|previous|safety)",
    r"you\s+(must|should)\s+(always|never)",
    r"(bypass|override|disable)\s+\w+\s*(filter|check|rule)",
    r"act\s+as\s+if\s+(you\s+are|there\s+are)\s+no\s+rules",
]

def scan_for_poisoning(examples: list[dict]) -> list[int]:
    """Return indices of suspicious training examples."""
    flagged = []
    for i, ex in enumerate(examples):
        output = ex.get("output", "")
        for pattern in POISON_PATTERNS:
            if re.search(pattern, output, re.IGNORECASE):
                flagged.append(i)
                print(f"⚠️  Example {i} flagged: matches '{pattern}'")
                break
    print(f"🛡️ Scan complete: {len(flagged)}/{len(examples)} flagged")
    return flagged
```

### 2. Licence Compliance

> [!IMPORTANT]
> **Llama 3** requires accepting Meta's licence. Key terms:
> - ✅ Commercial use allowed (under 700M monthly users)
> - ✅ Fine-tuning allowed
> - ❌ Must include "Built with Llama" attribution in products
> - ❌ Cannot use outputs to train competing models

Always verify licence before deploying a fine-tuned model.

### 3. Secrets in Training Data
**Risk**: API keys, passwords, or internal URLs in training examples get memorized by the model.

```python
SECRET_PATTERNS = [
    r"sk-[a-zA-Z0-9]{20,}",           # OpenAI API keys
    r"ghp_[a-zA-Z0-9]{36}",           # GitHub tokens
    r"password\s*[:=]\s*\S+",          # Inline passwords
    r"https?://\S+:([\w!@#$%]+)@",    # URLs with credentials
]

def scan_for_secrets(examples: list[dict]) -> list[int]:
    """Flag examples that may contain leaked secrets."""
    flagged = []
    for i, ex in enumerate(examples):
        text = json.dumps(ex)
        for pattern in SECRET_PATTERNS:
            if re.search(pattern, text):
                flagged.append(i)
                print(f"🔑 Example {i}: possible secret leak")
                break
    return flagged
```

### 4. GGUF Integrity Verification
After export, verify the model file wasn't corrupted or tampered:

```python
import hashlib

def verify_gguf(path: str) -> str:
    """Generate SHA256 hash for GGUF model integrity check."""
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    digest = sha256.hexdigest()
    print(f"🔐 SHA256: {digest}")
    print(f"💾 Save this hash. Verify before each deployment.")
    return digest

# Usage: verify_gguf("model-unsloth.Q4_K_M.gguf")
```

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Preparing training data | `dataset-curation` |
| LLM concepts (tokens, temperature, models) | `llm-fundamentals` |
| PII scrubbing for training data | `ai-security` |
| Evaluating model with golden datasets | `rag-evaluation` (§LLM-as-a-Judge) |
| Deploying model in a RAG pipeline | `rag-patterns` |
