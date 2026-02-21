import json
import os
import argparse
from typing import List, Dict

# Usage: python prepare-dataset.py --input raw_logs/ --output train.jsonl

def clean_text(text: str) -> str:
    """Removes weird characters and excessive whitespace."""
    return " ".join(text.split())

def summarize_paragraph(text: str) -> str:
    """Generate a basic extractive summary from a paragraph.
    
    For production quality, replace this with an LLM call:
        from openai import OpenAI
        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": f"Summarize this concisely:\\n{text}"}]
        )
        return response.choices[0].message.content
    """
    sentences = text.replace("\n", " ").split(". ")
    if len(sentences) <= 2:
        return clean_text(text)
    # Extractive: first + last sentence as summary
    summary = f"{sentences[0].strip()}. {sentences[-1].strip()}"
    return clean_text(summary)

def process_file(filepath: str) -> List[Dict]:
    examples = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Strategy 1: If file is JSON List
    try:
        data = json.loads(content)
        if isinstance(data, list):
            for item in data:
                # Expecting {"input": ..., "output": ...}
                if "input" in item and "output" in item:
                    examples.append({
                        "instruction": item.get("instruction", "Answer the following question."),
                        "input": item["input"],
                        "output": item["output"]
                    })
        return examples
    except json.JSONDecodeError:
        pass

    # Strategy 2: Raw Text (Chunking by paragraphs)
    # Generates extractive summaries — review and refine outputs before training!
    paragraphs = content.split("\n\n")
    for p in paragraphs:
        if len(p) > 50:
            examples.append({
                "instruction": "Analyze and summarize the following text.",
                "input": clean_text(p),
                "output": summarize_paragraph(p)
            })
            
    return examples

def process_csv(filepath: str) -> List[Dict]:
    """Process CSV files with 'input' and 'output' columns."""
    import csv
    examples = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if "input" in row and "output" in row:
                examples.append({
                    "instruction": row.get("instruction", "Answer the following question."),
                    "input": row["input"],
                    "output": row["output"]
                })
    return examples

def main(input_dir: str, output_file: str):
    all_examples = []
    
    if not os.path.exists(input_dir):
        print(f"❌ Input directory not found: {input_dir}")
        return

    SUPPORTED = {".txt", ".json", ".md", ".csv"}
    print(f"📂 Scanning {input_dir}... (supported: {', '.join(SUPPORTED)})")
    
    for filename in os.listdir(input_dir):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in SUPPORTED:
            continue
            
        filepath = os.path.join(input_dir, filename)
        
        if ext == ".csv":
            file_examples = process_csv(filepath)
        else:
            file_examples = process_file(filepath)
            
        all_examples.extend(file_examples)
        print(f"   - {filename}: {len(file_examples)} examples")

    # Warn about auto-generated outputs
    auto_generated = sum(1 for ex in all_examples if ex["instruction"] == "Analyze and summarize the following text.")
    if auto_generated > 0:
        print(f"\n⚠️  WARNING: {auto_generated} examples have auto-generated outputs (Strategy 2).")
        print(f"   Review and refine these outputs before training for best results.")
        print(f"   Tip: Use GPT-4o to regenerate outputs → see `dataset-curation` skill.\n")

    print(f"💾 Saving {len(all_examples)} examples to {output_file}...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        for ex in all_examples:
            f.write(json.dumps(ex) + "\n")

    print("✅ Done! You can now use this dataset with Unsloth/Axolotl.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Folder containing .txt, .json, .md, or .csv files")
    parser.add_argument("--output", required=True, help="Output .jsonl file path")
    args = parser.parse_args()
    
    main(args.input, args.output)

