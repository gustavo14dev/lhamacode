import argparse
import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# Usage: python evaluate_model.py --test-set test.jsonl --ft-output ft_responses.jsonl

def evaluate(test_set_path: str, ft_responses_path: str):
    print("⚖️  Starting LLM-as-a-Judge Evaluation...")

    # 1. Setup Judge
    judge_llm = ChatOpenAI(model="gpt-4o", temperature=0)
    
    prompt = ChatPromptTemplate.from_template("""
    You are an impartial judge evaluating AI models.
    
    Instruction: {instruction}
    Input: {input}
    
    Ground Truth: {ground_truth}
    
    Model Prediction: {prediction}
    
    Rate the Model Prediction from 1 to 5 based on accuracy and style match with Ground Truth.
    Return ONLY a JSON object: {{"score": int, "reason": "string"}}
    """)

    # 2. Load Data
    test_data = []
    with open(test_set_path, 'r', encoding='utf-8') as f:
        for line in f:
            test_data.append(json.loads(line))
            
    ft_predictions = []
    with open(ft_responses_path, 'r', encoding='utf-8') as f:
         for line in f:
            ft_predictions.append(json.loads(line))

    # 3. Validate alignment
    if len(test_data) != len(ft_predictions):
        print(f"⚠️  WARNING: test set has {len(test_data)} examples but predictions has {len(ft_predictions)}.")
        print(f"   Evaluating only the first {min(len(test_data), len(ft_predictions))} aligned examples.")

    # 4. Eval Loop
    total_score = 0
    results = []
    errors = 0
    n_eval = min(len(test_data), len(ft_predictions))
    
    print(f"📊 Evaluating {n_eval} examples...")
    
    for i in range(n_eval):
        example = test_data[i]
        prediction = ft_predictions[i].get("output", "")
        
        if not prediction:
            print(f"   Row {i}: ⚠️ Empty prediction, skipping")
            errors += 1
            continue
        
        response = judge_llm.invoke(prompt.format(
            instruction=example.get("instruction", ""),
            input=example.get("input", ""),
            ground_truth=example.get("output", ""),
            prediction=prediction
        ))
        
        try:
            eval_result = json.loads(response.content)
            score = eval_result["score"]
            total_score += score
            results.append({
                "example_id": i,
                "score": score,
                "reason": eval_result["reason"]
            })
            print(f"   Row {i}: Score {score}/5")
        except (json.JSONDecodeError, KeyError) as e:
            print(f"   Row {i}: ❌ Error parsing judge response: {e}")
            errors += 1

    evaluated = len(results)
    if evaluated == 0:
        print("❌ No examples were successfully evaluated.")
        return
        
    avg_score = total_score / evaluated
    print(f"\n🏆 Final Average Score: {avg_score:.2f} / 5.0 ({evaluated} evaluated, {errors} errors)")
    
    if avg_score > 4.0:
        print("✅ Outcome: The Fine-tuned model is EXCELLENT.")
    elif avg_score > 3.0:
        print("🟡 Outcome: The model is ACCEPTABLE but could improve with more data.")
    else:
        print("⚠️ Outcome: The model needs more training data or data quality review.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test-set", required=True, help="Path to golden Q&A dataset (.jsonl)")
    parser.add_argument("--ft-output", required=True, help="Path to model predictions (.jsonl)")
    args = parser.parse_args()
    
    evaluate(args.test_set, args.ft_output)

