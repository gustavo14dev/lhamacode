---
description: Guide to fine-tuning Llama-3-8B for free using Google Colab and Unsloth.
---

# 🚀 Fine-tune Llama-3 on Colab (Free Tier)

You don't need an H100 to fine-tune. You can do it on a T4 GPU (free on Colab) using **Unsloth**.

## Phase 1: Setup Environment
1.  Open [Google Colab](https://colab.research.google.com/).
2.  Runtime -> Change runtime type -> **T4 GPU**.
3.  Install Unsloth:
    ```python
    !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
    !pip install --no-deps "xformers<0.0.26" "trl<0.9.0" peft accelerate bitsandbytes
    ```

## Phase 2: Load Model & Data
1.  Load the 4-bit quantized model (saves memory):
    ```python
    from unsloth import FastLanguageModel
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = "unsloth/llama-3-8b-bnb-4bit",
        max_seq_length = 2048,
        load_in_4bit = True,
    )
    ```
2.  Load directly from your `.jsonl` (created with `prepare-dataset.py`):
    ```python
    from datasets import load_dataset
    dataset = load_dataset("json", data_files="train.jsonl", split="train")
    ```

## Phase 3: Train (LoRA)
We attach Adapters to the model.

```python
model = FastLanguageModel.get_peft_model(
    model,
    r = 16, # Rank (Higher = smarter but slower)
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
)

from trl import SFTTrainer
trainer = SFTTrainer(
    model = model,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = 2048,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        max_steps = 60, # Small run for testing
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        output_dir = "outputs",
    ),
)
trainer.train()
```

## Phase 4: Export (GGUF)
To use this model in Antigravity (or Ollama), export it to GGUF format.

```python
model.save_pretrained_gguf("model", tokenizer, quantization_method = "q4_k_m")
# Download the 'model-unsloth.Q4_K_M.gguf' file
```

## Phase 5: Run Locally
1.  Download [Ollama](https://ollama.com).
2.  Create `Modelfile`:
    ```dockerfile
    FROM ./model-unsloth.Q4_K_M.gguf
    SYSTEM "You are a specialized assistant."
    ```
3.  Run: `ollama create my-fine-tune -f Modelfile`

## 🔗 Related Skills

| Need | Skill |
| :--- | :--- |
| Data preparation & splitting | `dataset-curation` |
| Local training alternative | `llm-finetuning` (§train_model.py) |
| Security checks before training | `llm-finetuning` (§Security) |
| Model evaluation | `rag-evaluation` (§LLM-as-a-Judge) |

