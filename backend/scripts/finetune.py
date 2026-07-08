import os
import json
import torch
from transformers import AutoTokenizer, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model, TaskType

# Configuração do dispositivo (Intel GPU xpu ou fallback CUDA/CPU)
try:
    import intel_extension_for_pytorch as ipex
    device = "xpu"
    from ipex_llm.transformers import AutoModelForCausalLM
    print("Suporte a Intel Arc GPU (XPU) ativado via IPEX-LLM!")
except ImportError:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    from transformers import AutoModelForCausalLM
    print(f"IPEX-LLM não encontrado. Rodando em modo de compatibilidade: {device}")

MODEL_ID = "Qwen/Qwen2.5-7B-Instruct"
OUTPUT_DIR = "./finetuned_adapters"

def load_dataset(data_path):
    if not os.path.exists(data_path):
        # Dataset dummy inicial com o contexto do Protheus / RODOL Ltda
        dummy = [
            {
                "instruction": "Qual o nome da empresa e filial padrão do Copilot Protheus?",
                "output": "O nome da empresa padrão é RODOL Ltda (Código: 01) e a filial matriz é 0101 (Belo Horizonte)."
            },
            {
                "instruction": "Como o assistente do Protheus realiza consultas?",
                "output": "O assistente realiza consultas de forma segura e em modo leitura através das APIs REST integradas no ERP."
            }
        ]
        with open(data_path, "w", encoding="utf-8") as f:
            json.dump(dummy, f, ensure_ascii=False, indent=2)
        return dummy
        
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)

def train():
    print("Carregando Tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token

    print(f"Carregando Modelo {MODEL_ID}...")
    if device == "xpu":
        # Carrega o modelo utilizando a otimização de 4-bits nativa para GPU Intel
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            load_in_4bit=True,
            trust_remote_code=True
        )
    else:
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            device_map="auto",
            trust_remote_code=True
        )

    # Configuração do LoRA Adapter (QLoRA)
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=8,
        lora_alpha=32,
        lora_dropout=0.1,
        target_modules=["q_proj", "v_proj"]
    )
    
    model = get_peft_model(model, peft_config)
    print("LoRA Adapter configurado com sucesso!")

    # Carrega dados
    raw_data = load_dataset("training_data.json")
    
    # Tokenização dos pares instrução/resposta
    def tokenize_fn(example):
        text = f"Prompt: {example['instruction']}\nResponse: {example['output']}"
        inputs = tokenizer(text, truncation=True, max_length=512, padding="max_length")
        inputs["labels"] = inputs["input_ids"].copy()
        return inputs

    tokenized_data = [tokenize_fn(item) for item in raw_data]

    # Argumentos do Trainer do Transformers
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=3,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        fp16=(device == "cuda"),
        logging_steps=1,
        save_strategy="epoch",
        report_to="none"
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_data,
    )

    print("Iniciando o treinamento do LoRA Adapter no notebook...")
    trainer.train()

    print(f"Treinamento finalizado! Salvando adaptadores em: {OUTPUT_DIR}")
    model.save_pretrained(OUTPUT_DIR)

if __name__ == "__main__":
    train()
