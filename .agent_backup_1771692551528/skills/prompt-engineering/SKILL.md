---
name: prompt-engineering
description: Advanced prompt design patterns for production AI systems. System prompts, few-shot, chain-of-thought, structured output, and anti-hallucination techniques.
---

# 🎯 Prompt Engineering (Production-Grade)

Prompts are the source code of AI. A bad prompt makes a great model look dumb.

## 1. The Anatomy of a Production Prompt

Every production prompt must have these 5 layers:

```
┌────────────────────────────────────────────┐
│  Layer 1: PERSONA                          │
│  "You are a senior tax accountant..."      │
├────────────────────────────────────────────┤
│  Layer 2: CONTEXT                          │
│  <context>{retrieved_docs}</context>       │
├────────────────────────────────────────────┤
│  Layer 3: TASK                             │
│  "Analyze the invoice and extract..."      │
├────────────────────────────────────────────┤
│  Layer 4: CONSTRAINTS                      │
│  "Only use info from the context.          │
│   If unsure, say 'I don't know'."          │
├────────────────────────────────────────────┤
│  Layer 5: OUTPUT FORMAT                    │
│  "Return valid JSON: {schema}"             │
└────────────────────────────────────────────┘
```

### Real-World Example (RAG System Prompt)

```python
SYSTEM_PROMPT = """You are a helpful customer support assistant for TechStore.

## Your Knowledge
<context>
{retrieved_documents}
</context>

## Rules
1. Answer ONLY based on the context above.
2. If the answer is not in the context, say: "I don't have that information. Let me transfer you to a specialist."
3. Never invent product specs, prices, or availability.
4. Be concise. Maximum 3 sentences per answer.
5. If the user asks about competitor products, politely redirect to our catalog.

## Output
Respond in the user's language. Use bullet points for lists."""
```

---

## 2. Advanced Techniques

### Chain-of-Thought (CoT)
Force the model to reason before answering. Critical for math, logic, and multi-step problems.

```
❌ Bad:  "What is the total discount?"
✅ Good: "Think step by step. First, identify the base price. Then, calculate each discount. Finally, sum them."
```

**Variants:**
- **Zero-shot CoT**: Just add "Let's think step by step."
- **Few-shot CoT**: Provide 2-3 examples showing the reasoning process.
- **Auto-CoT**: Let the model generate its own examples.

### Self-Consistency
Generate N answers with temperature > 0, then pick the most frequent. Best for math/logic.

```python
# Pseudo-code
answers = [llm.invoke(query, temperature=0.7) for _ in range(5)]
final_answer = majority_vote(answers)
```

### Structured Output (JSON Mode)
Never parse free-text when you need structured data.

```python
from openai import OpenAI

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Extract: Name, Email, Phone from this text: ..."}],
    response_format={"type": "json_object"}
)
# Guaranteed valid JSON output
```

**Even better — use Pydantic + Instructor:**

```python
import instructor
from pydantic import BaseModel

class ContactInfo(BaseModel):
    name: str
    email: str
    phone: str | None

client = instructor.from_openai(OpenAI())
contact = client.chat.completions.create(
    model="gpt-4o",
    response_model=ContactInfo,
    messages=[{"role": "user", "content": "Extract contact from: ..."}]
)
# contact.name, contact.email — fully typed!
```

---

## 3. Anti-Hallucination Patterns

### Pattern 1: Citation Forcing
Force the model to cite which document chunk it used.

```
"For each claim in your answer, add a citation in the format [Doc N] 
referencing the specific document from the context."
```

### Pattern 2: Confidence Gating
Ask the model to rate its own confidence before answering.

```
"Before answering, rate your confidence (1-10) based on the context provided.
If confidence < 7, respond with: 'I'm not confident enough to answer this accurately.'"
```

### Pattern 3: Retrieval Grounding
Explicitly instruct the model to only use retrieved context.

```
"You MUST answer using ONLY the information in the <context> tags.
Do NOT use your training data. If the context doesn't contain the answer, say so."
```

---

## 4. Prompt Optimization

### Iteration Loop
```
Write Prompt → Test on 10 queries → Measure accuracy → Refine → Repeat
```

### Common Mistakes

| Mistake | Fix |
| :--- | :--- |
| Prompt too long (>2000 tokens) | Split into system + user messages |
| Vague persona ("Be helpful") | Specific persona ("You are a senior AWS Solutions Architect with 10 years experience") |
| No output format | Always specify JSON, markdown, or exact format |
| Temperature too high for factual tasks | Use 0.0-0.2 for extraction, 0.7 for conversation |
| No examples (zero-shot) for complex formats | Add 2-3 few-shot examples |

---

## 5. Delimiters & Security

### XML Tags (Recommended)
```xml
<system_instructions>You are a helpful assistant.</system_instructions>
<context>{retrieved_docs}</context>
<user_input>{user_message}</user_input>
```

**Why XML?** Models trained on XML data understand tag boundaries. This prevents prompt injection because the model distinguishes between instructions and user data.

### Triple Backticks (Alternative)
````
Analyze the following code:
```
{user_code}
```
````

---

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| RAG context assembly | `rag-patterns` |
| Model parameters (temperature, top-p) | `llm-fundamentals` |
| Security (prompt injection defense) | `ai-security` |
| Output validation | `ai-security` (§Output Guardrails) |
