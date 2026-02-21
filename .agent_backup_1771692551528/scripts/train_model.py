import os
import argparse
import torch
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import load_dataset

# Usage: python train_model.py --dataset train.jsonl --output my_model_gguf
# With validation: python train_model.py --dataset train.jsonl --output my_model --val-split 0.1

def train(dataset_path: str, output_name: str, max_steps: int = 60, val_split: float = 0.0, eval_steps: int = 10):
    print("🚀 Starting Local Fine-tuning Engine...")

    # 1. Check Hardware
    if not torch.cuda.is_available():
        print("❌ Error: NVIDIA GPU not found. Unsloth requires a GPU (T4, A10, RTX 30xx/40xx).")
        return

    gpu_name = torch.cuda.get_device_name(0)
    print(f"✅ GPU Detected: {gpu_name}")

    # 2. Load Base Model (Unsloth 4-bit)
    print("📦 Loading Llama-3-8B (4-bit)...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = "unsloth/llama-3-8b-bnb-4bit",
        max_seq_length = 2048,
        dtype = None,
        load_in_4bit = True,
    )

    # 3. Add LoRA Adapters
    print("🔧 Attaching LoRA Adapters...")
    model = FastLanguageModel.get_peft_model(
        model,
        r = 16,
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha = 16,
        lora_dropout = 0,
        bias = "none",
        use_gradient_checkpointing = "unsloth", 
        random_state = 3407,
        use_rslora = False,
        loftq_config = None,
    )

    # 4. Load Dataset (with optional validation split)
    print(f"📂 Loading dataset: {dataset_path}")
    dataset = load_dataset("json", data_files=dataset_path, split="train")
    
    eval_dataset = None
    if val_split > 0:
        split = dataset.train_test_split(test_size=val_split, seed=3407)
        dataset = split["train"]
        eval_dataset = split["test"]
        print(f"✂️  Split: {len(dataset)} train / {len(eval_dataset)} val ({val_split*100:.0f}%)")
    else:
        print(f"⚠️  No validation split. Use --val-split 0.1 to monitor overfitting.")

    # 5. Train
    print(f"⚔️  Training for {max_steps} steps...")
    
    training_args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = max_steps,
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
        # Validation monitoring (if split provided)
        eval_strategy = "steps" if eval_dataset else "no",
        eval_steps = eval_steps if eval_dataset else None,
        load_best_model_at_end = True if eval_dataset else False,
        metric_for_best_model = "eval_loss" if eval_dataset else None,
    )
    
    trainer = SFTTrainer(
        model = model,
        tokenizer = tokenizer,
        train_dataset = dataset,
        eval_dataset = eval_dataset,
        dataset_text_field = "text",
        max_seq_length = 2048,
        dataset_num_proc = 2,
        packing = False,
        args = training_args,
    )
    
    trainer_stats = trainer.train()
    
    # Print overfitting warning
    if eval_dataset and hasattr(trainer.state, "best_metric"):
        print(f"📊 Best eval loss: {trainer.state.best_metric:.4f}")
        final_train_loss = trainer_stats.training_loss
        if trainer.state.best_metric > final_train_loss * 1.5:
            print("⚠️  WARNING: Eval loss >> Train loss. Possible overfitting. Consider more data or fewer steps.")

    # 6. Save GGUF
    print(f"💾 Saving to GGUF format ({output_name})...")
    model.save_pretrained_gguf(output_name, tokenizer, quantization_method = "q4_k_m")
    print("✅ Done! You can now use this model in Ollama.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True, help="Path to .jsonl file")
    parser.add_argument("--output", default="model", help="Output folder name")
    parser.add_argument("--steps", type=int, default=60, help="Number of training steps")
    parser.add_argument("--val-split", type=float, default=0.1, help="Fraction for validation (0 = no split, 0.1 = 10%%)")
    parser.add_argument("--eval-steps", type=int, default=10, help="Run validation every N steps")
    args = parser.parse_args()
    
    train(args.dataset, args.output, args.steps, args.val_split, args.eval_steps)

