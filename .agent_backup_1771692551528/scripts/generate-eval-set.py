import os
import argparse
from typing import List
from openai import OpenAI

# Usage: python generate_eval_set.py --file ./my_docs.md --count 10

def generate_qa_pairs(text_chunk: str, count: int, client: OpenAI) -> str:
    prompt = f"""
    You are an expert at creating evaluation datasets for RAG systems.
    
    Context:
    {text_chunk[:4000]} # Truncate to avoid context limit
    
    Task:
    Generate {count} question-answer pairs based STRICTLY on the context above.
    Format your output as a valid JSON list of objects:
    [
        {{
            "question": "The question text",
            "answer": "The ground truth answer",
            "context_excerpt": "The exact sentence from the text used to answer"
        }}
    ]
    """
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        response_format={"type": "json_object"}
    )
    
    return response.choices[0].message.content

def main():
    parser = argparse.ArgumentParser(description="Generate synthetic evaluation data for RAG.")
    parser.add_argument("--file", required=True, help="Path to the text file to generate QA from")
    parser.add_argument("--count", type=int, default=5, help="Number of Q&A pairs to generate")
    parser.add_argument("--api_key", help="OpenAI API Key (optional, defaults to env var)", default=os.getenv("OPENAI_API_KEY"))
    
    args = parser.parse_args()
    
    if not args.api_key:
        print("Error: OPENAI_API_KEY not found. Set it in env or pass --api_key")
        return

    try:
        with open(args.file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: File {args.file} not found.")
        return

    print(f"🤖 Generating {args.count} Q&A pairs from {args.file}...")
    
    client = OpenAI(api_key=args.api_key)
    result = generate_qa_pairs(content, args.count, client)
    
    output_file = f"eval_dataset_{os.path.basename(args.file)}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(result)
        
    print(f"✅ Requirements generated! Saved to {output_file}")

if __name__ == "__main__":
    main()
