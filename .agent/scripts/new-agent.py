import os
import sys
import argparse

# Usage: python new-agent.py my_agent_name [--human-check]

TEMPLATE_INIT = """\"\"\"
{agent_name} Agent Package
\"\"\"
"""

TEMPLATE_STATE = """from typing import TypedDict, Annotated, List, Union
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    # The 'messages' key is required for most LangGraph agents
    messages: Annotated[List[dict], add_messages]
    # Add custom state keys here (e.g., 'user_id', 'context_data')
    # context: str
"""

TEMPLATE_TOOLS = """from langchain_core.tools import tool
from pydantic import BaseModel, Field

# Define Input Schema using Pydantic
class SampleToolInput(BaseModel):
    query: str = Field(description="The query to search for.")

@tool("sample_search", args_schema=SampleToolInput)
def sample_search(query: str) -> str:
    \"\"\"Useful for searching for information about X.\"\"\"
    # Implement your logic here
    return f"Results for {{query}}"

ALL_TOOLS = [sample_search]
"""

TEMPLATE_GRAPH = """from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from .state import AgentState
from .tools import ALL_TOOLS

# 1. Setup Model
llm = ChatOpenAI(model="gpt-4o", temperature=0)
llm_with_tools = llm.bind_tools(ALL_TOOLS)

# 2. Define Nodes
def agent_node(state: AgentState):
    return {{"messages": [llm_with_tools.invoke(state["messages"])]}}

tool_node = ToolNode(ALL_TOOLS)

# 3. Define Graph
workflow = StateGraph(AgentState)

workflow.add_node("agent", agent_node)
workflow.add_node("tools", tool_node)

workflow.set_entry_point("agent")

# Conditional Edge: If tool call -> tools, else -> END
def should_continue(state):
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return END

workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")

app = workflow.compile()
"""

TEMPLATE_GRAPH_HUMAN = """from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import ToolMessage
from .state import AgentState
from .tools import ALL_TOOLS

# 1. Setup Model
llm = ChatOpenAI(model="gpt-4o", temperature=0)
llm_with_tools = llm.bind_tools(ALL_TOOLS)

# 2. Define Nodes
def agent_node(state: AgentState):
    return {{"messages": [llm_with_tools.invoke(state["messages"])]}}

def human_review_node(state: AgentState):
    pass # This node does nothing, just a checkpoint to pause

tool_node = ToolNode(ALL_TOOLS)

# 3. Define Graph
workflow = StateGraph(AgentState)

workflow.add_node("agent", agent_node)
workflow.add_node("human_review", human_review_node)
workflow.add_node("tools", tool_node)

workflow.set_entry_point("agent")

# Conditional Logic
def should_continue(state):
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        # If tool called, GO TO HUMAN REVIEW FIRST
        return "human_review"
    return END

workflow.add_conditional_edges("agent", should_continue)

# From Human Review -> Tools
# The graph will PAUSE here if configured with interrupt_before=["human_review"]
workflow.add_edge("human_review", "tools")

workflow.add_edge("tools", "agent")

# Compile with Interrupt
app = workflow.compile(interrupt_before=["human_review"])
"""

def create_agent(agent_name, human_check=False):
    base_dir = f".agent/agents/{agent_name}_package"
    
    if os.path.exists(base_dir):
        print(f"❌ Error: Directory {base_dir} already exists.")
        return

    os.makedirs(base_dir)
    
    graph_content = TEMPLATE_GRAPH_HUMAN if human_check else TEMPLATE_GRAPH

    files = {
        "__init__.py": TEMPLATE_INIT.format(agent_name=agent_name),
        "state.py": TEMPLATE_STATE,
        "tools.py": TEMPLATE_TOOLS,
        "graph.py": graph_content
    }

    for filename, content in files.items():
        with open(os.path.join(base_dir, filename), "w", encoding="utf-8") as f:
            f.write(content)

    print(f"✅ Agent '{agent_name}' created at {base_dir}")
    if human_check:
        print("🛡️  Human-in-the-Loop enabled: Graph will interrupt before executing tools.")
    print("👉 Next steps:")
    print(f"   1. cd {base_dir}")
    print("   2. Edit tools.py to add your custom logic")
    print("   3. Run the graph in your app")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scaffold a new AI Agent")
    parser.add_argument("name", help="Name of the agent (snake_case)")
    parser.add_argument("--human-check", action="store_true", help="Enable Human-in-the-Loop review step before tool use")
    args = parser.parse_args()
    
    create_agent(args.name, args.human_check)
