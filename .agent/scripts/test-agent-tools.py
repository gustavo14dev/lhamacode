import sys
import importlib.util
import inspect
from langchain_core.tools import BaseTool

# Usage: python test-agent-tools.py path/to/tools.py

def load_module_from_path(path):
    spec = importlib.util.spec_from_file_location("tools_module", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["tools_module"] = module
    spec.loader.exec_module(module)
    return module

def test_tools(file_path):
    print(f"🔍 Inspecting tools in {file_path}...")
    
    try:
        module = load_module_from_path(file_path)
    except Exception as e:
        print(f"❌ Failed to load module: {e}")
        return

    # Look for ALL_TOOLS list or individual BaseTool instances
    tools_found = []
    
    if hasattr(module, "ALL_TOOLS"):
        tools_found = module.ALL_TOOLS
    else:
        # Scan for tools manually
        for name, obj in inspect.getmembers(module):
            if isinstance(obj, BaseTool):
                tools_found.append(obj)
    
    if not tools_found:
        print("⚠️ No tools found. Ensure you define 'ALL_TOOLS' list or instantiate BaseTool objects.")
        return

    print(f"✅ Found {len(tools_found)} tools.")
    
    errors = 0
    for tool in tools_found:
        print(f"\n🛠️ Testing Tool: {tool.name}")
        
        # Check Description
        if not tool.description or len(tool.description) < 10:
            print(f"   ❌ WEAK DESCRIPTION: '{tool.description}'. LLM needs more context.")
            errors += 1
        else:
            print(f"   ✅ Description ok")

        # Check Args Schema
        if tool.args_schema:
            print(f"   ✅ Pydantic Schema: {tool.args_schema.__name__}")
            # Check field descriptions
            for field_name, field in tool.args_schema.model_fields.items():
                if not field.description:
                    print(f"      ⚠️ Field '{field_name}' missing description. LLM might hallucinate.")
        else:
            print(f"   ❌ MISSING ARG SCHEMA: Uses raw function signature. Highly risky.")
            errors += 1

    if errors == 0:
        print("\n🎉 All tools passed static analysis!")
    else:
        print(f"\n🚫 Found {errors} critical issues.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test-agent-tools.py <path_to_tools.py>")
        sys.exit(1)
    test_tools(sys.argv[1])
