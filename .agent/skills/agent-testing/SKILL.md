---
name: agent-testing
description: Best practices for testing AI agents, from unit testing tools to mocking LLM responses.
---

# 🧪 Agent Testing Strategies

Testing non-deterministic AI is hard. Isolate the logic from the "Magic".

## 1. Unit Testing Tools (The "Logic")
Tools are just Python functions. Test them without the LLM.

```python
# test_tools.py
from my_agent.tools import calculate_tax

def test_calculate_tax_logic():
    # Assert the math is right
    assert calculate_tax(100, "BR") == 120
    
def test_calculate_tax_error():
    # Assert it handles invalid input gracefully
    result = calculate_tax(100, "MARS")
    assert "Invalid country" in result
```

## 2. Integration Testing (The "Graph")
Test if the agent moves from State A to State B correctly.

**Mocking the LLM**: Use `langchain.llms.fake.FakeListLLM` to force specific outputs.

```python
def test_graph_transition():
    # Force LLM to say "I need to use the tool"
    fake_llm = FakeListLLM(responses=['Action: Search("Python")'])
    agent = create_graph(llm=fake_llm)
    
    result = agent.invoke({"messages": ["Hi"]})
    # Assert the graph complied and routed to Tools
    assert result["next_node"] == "tools"
```

## 3. Evaluation (The "Vibe Check")
For the final output quality, use **Eval Sets** (see `generate-eval-set.py`).
- Run 50 golden questions.
- Use an "Auto-Grader" (GPT-4o) to score the answers.

## 4. End-to-End Testing (The Full Flow)

Test the **complete agent journey**: user input → reasoning → tool calls → final answer.

```python
# test_agent_e2e.py
import pytest
from langchain.llms.fake import FakeListLLM
from my_agent.graph import create_agent_graph
from my_agent.tools import search_kb, get_order_status

class TestAgentE2E:
    """End-to-end tests for the complete agent flow."""
    
    def test_agent_calls_correct_tool(self):
        """Agent should route 'order status' queries to get_order_status tool."""
        fake_llm = FakeListLLM(responses=[
            'Action: get_order_status\nAction Input: {"order_id": "12345"}',
            'Your order #12345 is being shipped and will arrive tomorrow.'
        ])
        agent = create_agent_graph(llm=fake_llm)
        
        result = agent.invoke({"messages": ["Where is my order 12345?"]})
        
        # Assert the correct tool was called
        tool_calls = [m for m in result["messages"] if hasattr(m, "tool_calls")]
        assert any("get_order_status" in str(tc) for tc in tool_calls)
        
        # Assert the final answer contains order info
        final_answer = result["messages"][-1].content
        assert "12345" in final_answer
    
    def test_agent_handles_tool_failure_gracefully(self):
        """Agent should apologize if a tool returns an error, not crash."""
        fake_llm = FakeListLLM(responses=[
            'Action: get_order_status\nAction Input: {"order_id": "99999"}',
            "I'm sorry, I couldn't find that order. Please check the number."
        ])
        agent = create_agent_graph(llm=fake_llm)
        
        result = agent.invoke({"messages": ["Order 99999 status?"]})
        
        final_answer = result["messages"][-1].content
        assert "sorry" in final_answer.lower() or "couldn't" in final_answer.lower()
    
    def test_agent_stays_on_topic(self):
        """Agent should refuse off-topic queries."""
        fake_llm = FakeListLLM(responses=[
            "I'm a customer support assistant and can only help with store-related questions."
        ])
        agent = create_agent_graph(llm=fake_llm)
        
        result = agent.invoke({"messages": ["Write me a poem about cats"]})
        
        final_answer = result["messages"][-1].content
        # No tool should be called for off-topic input
        tool_calls = [m for m in result["messages"] if hasattr(m, "tool_calls")]
        assert len(tool_calls) == 0

    def test_agent_max_iterations(self):
        """Agent should not loop forever — circuit breaker at N iterations."""
        agent = create_agent_graph(llm=real_llm, max_iterations=5)
        
        result = agent.invoke({"messages": ["Solve world hunger"]})
        
        # Assert it stopped within the iteration limit
        assert len(result["messages"]) <= 5 * 2  # Each iteration = 1 thought + 1 action
```

### Best Practices for E2E
1. **Mock the LLM, keep tools real** — Test tool logic, not LLM creativity.
2. **Assert on tool selection** — Did the agent choose the right tool?
3. **Assert on final answer** — Does it contain expected keywords?
4. **Test failure paths** — Tool errors, off-topic, infinite loops.

## 🛡️ CI/CD Pipeline
1.  **Lint**: Check Pydantic schemas (`test-agent-tools.py`).
2.  **Unit**: Run Pytest on all tools.
3.  **Integration**: Run graph transition tests with mocked LLM.
4.  **Eval**: Run a mini-eval set (5 questions) on every PR.

```yaml
# .github/workflows/agent-tests.yml
name: Agent CI
on: [push, pull_request]

jobs:
  agent-tests:
    runs-on: ubuntu-latest
    env:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      
      - name: Install dependencies
        run: pip install -r requirements.txt -r requirements-test.txt
      
      # Stage 1: Lint tool schemas
      - name: Lint Pydantic Schemas
        run: python -m pytest tests/test_tool_schemas.py -v
      
      # Stage 2: Unit test tools (no LLM calls)
      - name: Unit Test Tools
        run: python -m pytest tests/test_tools/ -v --no-header
      
      # Stage 3: Integration test graph (mocked LLM)
      - name: Integration Test Graph
        run: python -m pytest tests/test_graph/ -v --no-header
      
      # Stage 4: E2E with mocked LLM
      - name: E2E Agent Flow
        run: python -m pytest tests/test_agent_e2e.py -v --no-header
      
      # Stage 5: Mini-eval (uses real LLM — optional, gated)
      - name: Mini Evaluation Set
        if: github.event_name == 'pull_request'
        run: |
          python scripts/generate-eval-set.py --file docs/knowledge.md --count 5
          python -m pytest tests/test_eval.py -v --no-header
```

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Tools to test | `tool-construction` |
| Graph architecture to test | `agentic-patterns` (§State Management) |
| RAG evaluation datasets | `rag-evaluation` |
| Multi-agent flows to test | `multi-agent-orchestration` |
