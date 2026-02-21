---
name: agentic-patterns
description: Core reasoning loops and cognitive architectures for autonomous agents.
---

# 🧠 Agentic Patterns & Reasoning

An "Agent" is an LLM with a **Goal**, **Memory**, and **Tools**. This skill defines *how* the agent thinks.

## 🔄 The Core Loops

### 1. ReAct (Reason + Act)
The standard loop for most agents.
- **Thought**: "I need to check the weather."
- **Action**: `get_weather(city="Manaus")`
- **Observation**: "raining, 28°C"
- **Thought**: "It is raining, so I should recommend an umbrella."
- **Answer**: "Don't forget your umbrella!"

### 2. Plan-and-Execute
Better for complex, multi-step tasks.
- **Planner**: Generates a step-by-step list *before* doing anything.
- **Executor**: Goes through the list one by one.
- **Replanner**: If step 3 fails, updates the plan.

## 💭 Cognitive Architectures (Advanced)

### 1. Chain-of-Thought (CoT)
- Force the model to "show its work" before answering.
- *Prompt*: "Think step by step."

### 2. Self-Consistency
- Generate 5 different chains of thought.
- Pick the answer that appears most frequently (Majority Voting).
- *Best for*: Math, Logic puzzles.

### 3. Tree of Thoughts (ToT)
- Explore multiple "branches" of reasoning. Backtrack if a branch looks unpromising.
- *Best for*: Creative writing, Strategic planning.

## 🏗️ State Management (Graph-based)

Traditional "Chain" agents are hard to control. We recommend **State Machines**.

### LangGraph (Python/JS)
- Define nodes (functions) and edges (transitions).
- **Cyclic Graphs**: Allow loops (e.g., "Review Code" -> "Fix Bugs" -> "Review Code" -> "Approved").
- **Persistence**: Save the state of the graph so humans can interrupt and approve actions.

```python
# Conceptual LangGraph
workflow = StateGraph(AgentState)
workflow.add_node("research", research_node)
workflow.add_node("write", write_node)
workflow.add_edge("research", "write")
app = workflow.compile()
```

## 🧠 Memory & Persistence

Agents are amnésic by default. For persistent memory across sessions, see the dedicated skill:

> **📎 See `agent-memory` skill** for Long-term, Episodic, and Semantic memory patterns.

Key patterns:
- **LangGraph Checkpointer**: Saves graph state between calls.
- **Memory as a Tool**: Agent queries its own memory DB.
- **Memory Injection**: User context injected into system prompt.

Setup: `python .agent/scripts/setup-memory-db.py --backend sqlite --path memories.db`
