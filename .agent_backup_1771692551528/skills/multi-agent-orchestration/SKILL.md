---
name: multi-agent-orchestration
description: Patterns for coordinating multiple specialized agents to solve complex tasks.
---

# 🤖 Multi-Agent Orchestration

One giant prompt cannot do everything. Break complex tasks into sub-tasks handled by specialized agents.

## 🎭 Common Architectures

### 1. The Supervisor (Router)
- **Role**: Traffic Controller.
- **Flow**: User -> Supervisor -> (Route) -> Research Agent / Coding Agent / Writing Agent.
- **Pros**: Simple, easy to debug.
- **Cons**: The supervisor can become a bottleneck.

### 2. Hierarchical Teams (Boss-Worker)
- **Role**: Management structure.
- **Flow**:
    - **Product Manager**: "Build a Tetris game."
    - **Tech Lead**: Break it down → "Dev, write the engine. Designer, make the assets."
    - **Developer**: Writes code.
- **Pros**: Good for large projects.
- **Cons**: High latency / token cost.

```python
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI

# Boss: decomposes the task, delegates to workers
def boss_node(state):
    """The Tech Lead breaks down the task and assigns to specialists."""
    llm = ChatOpenAI(model="gpt-4o")
    plan = llm.invoke(
        f"You are a Tech Lead. Break this task into sub-tasks and assign to: "
        f"developer, designer, tester.\nTask: {state['task']}"
    )
    return {"plan": plan.content, "sub_tasks": parse_plan(plan.content)}

# Workers: execute their assigned sub-task
def developer_node(state):
    llm = ChatOpenAI(model="gpt-4o")
    code = llm.invoke(f"You are a Developer. Write code for:\n{state['current_task']}")
    return {"results": state.get("results", []) + [{"agent": "developer", "output": code.content}]}

def designer_node(state):
    llm = ChatOpenAI(model="gpt-4o")
    design = llm.invoke(f"You are a Designer. Create assets for:\n{state['current_task']}")
    return {"results": state.get("results", []) + [{"agent": "designer", "output": design.content}]}

# Router: boss decides which worker handles each sub-task
def route_to_worker(state) -> str:
    current = state["sub_tasks"][state.get("task_index", 0)]
    if "code" in current.lower() or "implement" in current.lower():
        return "developer"
    elif "design" in current.lower() or "asset" in current.lower():
        return "designer"
    return "developer"  # default

workflow = StateGraph(BossWorkerState)
workflow.add_node("boss", boss_node)
workflow.add_node("developer", developer_node)
workflow.add_node("designer", designer_node)
workflow.set_entry_point("boss")
workflow.add_conditional_edges("boss", route_to_worker)
workflow.add_edge("developer", END)
workflow.add_edge("designer", END)
app = workflow.compile()
```

### 3. Sequential Chain (Assembly Line)
- **Flow**: Output of A is Input of B.
- **Example**: Researcher (Finds facts) → Writer (Drafts blog) → Editor (Fixes grammar).
- **Pros**: Deterministic.
- **Cons**: If step 1 fails, the whole chain fails.

### 4. Joint Collaboration (The "Meeting")
- Agents "talk" to each other in a shared scratchpad until they agree.
- *Best for*: Brainstorming, specialized debates.

```python
# Shared Scratchpad Collaboration Pattern
def collaboration_loop(state):
    """Two agents debate until they reach consensus."""
    agents = {"optimist": ChatOpenAI(model="gpt-4o"), "critic": ChatOpenAI(model="gpt-4o")}
    scratchpad = state["messages"]
    max_rounds = 3
    
    for round_num in range(max_rounds):
        # Optimist proposes
        optimist_msg = agents["optimist"].invoke(
            f"You are an optimistic strategist. Propose a solution.\n\nHistory:\n{scratchpad}"
        )
        scratchpad.append(f"[Optimist R{round_num+1}]: {optimist_msg.content}")
        
        # Critic challenges
        critic_msg = agents["critic"].invoke(
            f"You are a critical reviewer. Challenge the proposal's weaknesses.\n\nHistory:\n{scratchpad}"
        )
        scratchpad.append(f"[Critic R{round_num+1}]: {critic_msg.content}")
        
        # Check consensus (simple keyword heuristic)
        if "agree" in critic_msg.content.lower() or "approved" in critic_msg.content.lower():
            break
    
    return {"messages": scratchpad, "consensus_reached": round_num < max_rounds - 1}
```

## 🤝 Handoffs & State Sharing

How do agents pass data?

1.  **Shared Scratchpad**: A global variable `messages=[]` that everyone appends to.
2.  **Structured Handoff**: Agent A returns a specific object `Result(data=..., next_agent="Agent B")`.

## ⚠️ When NOT to use Multi-Agent?

- **Simple Tasks**: If GPT-4o can do it in one shot, don't over-engineer.
- **Latency Critical**: Each agent hop adds 2-3 seconds.
- **Cost Sensitive**: Multi-agent systems burn tokens fast (chat history grows exponentially).

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Native Antigravity orchestration | `parallel-agents` |
| Individual agent reasoning loops | `agentic-patterns` |
| Tool design for agents | `tool-construction` |
| Agent memory & state sharing | `agent-memory` |
| Testing multi-agent flows | `agent-testing` |
