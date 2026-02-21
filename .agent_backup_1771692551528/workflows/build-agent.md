---
description: Step-by-step guide to scaffolding and implementing a new Autonomous Agent.
---

# 🤖 Build an Autonomous Agent

Follow this workflow to create an agent that can reason and use tools.

## Phase 1: Define the Persona & Goal
1.  **Role**: Who is this agent? (e.g., "Senior Data Analyst").
2.  **Goal**: What is the success condition? (e.g., "Generate a PDF report from SQL data").
3.  **Limitations**: What should it NOT do? (e.g., "Never delete data").

## Phase 2: Tool Construction
Don't start with the agent. Start with the tools.

1.  **Identify Actions**: What APIs or DBs does it need?
2.  **Define Schema**: Create Pydantic models for every tool input.
    ```python
    class SQLQuery(BaseModel):
        query: str = Field(description="The SQL query to run. Read-only only.")
    ```
3.  **Test Tools**: Write unit tests for your tools to ensure they handle errors gracefully.

## Phase 3: Choose the Cognitive Architecture
Select the "Brain" based on complexity:

- **Simple Command**: Zero-shot Prompting.
- **Interactive Task**: **ReAct** (Reason + Act). *Most common*.
- **Complex Project**: **Plan-and-Execute** (Planner -> Executor).
- **Multi-step Research**: **LangGraph** (State Machine).

## Phase 4: Implementation (Pseudocode)

```python
system_prompt = """
You are a Data Analyst.
You have access to: [sql_tool, chart_tool].
Use the following format:
Thought: ...
Action: ...
"""

while not done:
    # 1. Think
    response = llm.chat(history + system_prompt)
    
    # 2. Act
    if response.has_tool_call():
        tool_name = response.tool_name
        result = execute_tool(tool_name, response.tool_args)
        history.append(f"Observation: {result}")
    
    # 3. Answer
    else:
        print(response.content)
        done = True
```

## Phase 5: Evaluation
- **Success Rate**: How often does it reach the goal?
- **Tool Error Rate**: How often does it fail to call tools correctly?
- **Loop Limit**: Ensure it doesn't get stuck in an infinite loop (max_steps=10).
