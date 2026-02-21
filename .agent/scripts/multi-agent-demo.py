from typing import TypedDict, Annotated, List, Literal
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

# Usage: python demo.py
# Prerequisite: pip install langgraph langchain-openai

# 1. State
class AgentState(TypedDict):
    messages: Annotated[List[dict], add_messages]
    next_agent: str

# 2. Agents
llm = ChatOpenAI(model="gpt-4o", temperature=0)

def supervisor_node(state: AgentState):
    system_prompt = (
        "You are a Supervisor. You must route the user request to one of the following workers:\n"
        "- 'math_agent': For calculations.\n"
        "- 'writer_agent': For writing poems or essays.\n"
        "Return ONLY the name of the agent to call. If the task is done, return 'FINISH'."
    )
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)
    decision = response.content.strip().lower()
    
    if "math" in decision: return {"next_agent": "math_agent"}
    if "writer" in decision: return {"next_agent": "writer_agent"}
    return {"next_agent": "FINISH"}

def math_node(state: AgentState):
    response = llm.invoke([SystemMessage(content="You are a Math expert. Solve the problem.")] + state["messages"])
    return {"messages": [response]}

def writer_node(state: AgentState):
    response = llm.invoke([SystemMessage(content="You are a Poet. Write beautifully.")] + state["messages"])
    return {"messages": [response]}

# 3. Graph
workflow = StateGraph(AgentState)

workflow.add_node("supervisor", supervisor_node)
workflow.add_node("math_agent", math_node)
workflow.add_node("writer_agent", writer_node)

workflow.set_entry_point("supervisor")

workflow.add_conditional_edges(
    "supervisor",
    lambda state: state["next_agent"],
    {
        "math_agent": "math_agent", 
        "writer_agent": "writer_agent", 
        "FINISH": END
    }
)

workflow.add_edge("math_agent", END)
workflow.add_edge("writer_agent", END)

app = workflow.compile()

# 4. Run
if __name__ == "__main__":
    print("🤖 Multi-Agent Demo Started...")
    print("Question: 'Write a poem about rust.'")
    
    inputs = {"messages": [HumanMessage(content="Write a poem about rust.")]}
    for event in app.stream(inputs):
        for key, value in event.items():
            print(f"\n📍 Node: {key}")
            if "messages" in value:
                print(f"   Response: {value['messages'][-1].content[:50]}...")
