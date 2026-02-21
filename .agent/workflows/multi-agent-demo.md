---
description: Multi-agent demo using LangGraph. Supervisor routes tasks to Math and Writer agents.
---

# 🤖 Multi-Agent Demo (LangGraph)

Demonstrates a Supervisor → Worker pattern with LangGraph.

## Prerequisites
```bash
pip install langgraph langchain-openai
```

## Run
```bash
python .agent/scripts/multi-agent-demo.py
```

## Architecture
```
User Request → Supervisor → Routes to:
  ├── math_agent (calculations)
  ├── writer_agent (poems/essays)
  └── FINISH (task complete)
```

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Multi-agent patterns | `multi-agent-orchestration` |
| Agentic reasoning loops | `agentic-patterns` |
| Parallel agent execution | `parallel-agents` |
