---
name: llm-fundamentals
description: Core concepts and configuration for Large Language Models (LLMs).
---

# LLM Fundamentals & Configuration

This skill covers the essential parameters and concepts needed to effectively work with and configure Large Language Models.

## 🧠 Key Concepts

### 1. Tokens
- **Definition**: The fundamental unit of text for an LLM (roughly 0.75 words).
- **Cost**: APIs charge per 1M input/output tokens.
- **Limit**: Models have a maximum context window (e.g., GPT-4o: 128k tokens).
- **Optimization**: Write concise prompts to save money and latency.

### 2. Context Window
- **Definition**: The maximum amount of text (prompt + completion) the model can "remember" in a single interaction.
- **Sliding Window**: For long conversations, older messages must be dropped or summarized to stay within the limit.
- **Attention**: Models pay more attention to the beginning and end of the context (Primacy/Recency bias).

### 3. Temperature (0.0 - 2.0)
- **Role**: Controls randomness/creativity.
- **Values**:
    - **0.0 - 0.3**: Deterministic, factual, focused. Use for: Data extraction, Code generation, Math.
    - **0.7 - 0.9**: Creative, conversational. Use for: Chatbots, Storytelling.
    - **> 1.0**: Highly random, chaotic. Rarely used.

### 4. Top-P (Nucleus Sampling)
- **Role**: Limits the pool of tokens considered for the next word.
- **Mechanism**: "Consider only the top P% specific probability mass."
- **Advice**: Alter either Temperature OR Top-P, typically not both.

## 🗣️ Prompt Engineering Basics

### Structure of a Good Prompt
1.  **Persona**: "You are an expert in X..."
2.  **Context**: "Reference the following data..."
3.  **Task**: "Analyze the data and extract Y..."
4.  **Constraints**: "Do not use markdown. JSON only."
5.  **Output Format**: "Return a list of objects..."

### Advanced Techniques
- **Zero-Shot**: No examples provided.
- **Few-Shot**: Provide 1-3 examples of Input -> Output. Drastically improves adherence to format.
- **Chain-of-Thought (CoT)**: "Let's think step by step." Encourages reasoning before answering.
- **System Messages**: The hidden instruction that defines the AI's behavior. Always use this for constraints.

## 📊 Model Classes (2025 Standards)

| Class | Examples | Best For |
| :--- | :--- | :--- |
| **Reasoning / SOTA** | GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro | Complex logic, Coding, Creative writing. |
| **Fast / Efficient** | GPT-4o-mini, Claude 3 Haiku, Gemini Flash | High-volume tasks, extraction, simple chatbots. |
| **Open Weight** | Llama 3 (70B/8B), Mistral Large | Local privacy, fine-tuning, specialized tasks. |

## 🛡️ Safety & Alignment

- **Jailbreaking**: Attempts to bypass safety filters.
- **Prompt Injection**: Malicious user input that overrides system instructions.
    - **Defense**: Delimit user input with XML tags (e.g., `<user_input>...</user_input>`) and instruct model to treat it as data, not code.

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Advanced prompt patterns | `prompt-engineering` |
| RAG architectures | `rag-patterns` |
| Security (injection defense, guardrails) | `ai-security` |
| Fine-tuning for specialized models | `llm-finetuning` |
