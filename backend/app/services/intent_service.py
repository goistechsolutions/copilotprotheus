import os
import logging

# Forçar backend do JAX antes de importar keras
os.environ["KERAS_BACKEND"] = "jax"
# No ambiente Hetzner, o JAX utilizará automaticamente a melhor plataforma disponível (CPU/GPU)
# os.environ["JAX_PLATFORMS"] = "cpu" # Comentado para permitir uso de GPU na Hetzner

import numpy as np
import keras

logger = logging.getLogger("app.services.intent")

class IntentService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(IntentService, cls).__new__(cls)
            cls._instance._initialize_model()
        return cls._instance

    def _initialize_model(self):
        """Inicializa e treina o modelo de intenções Keras/JAX dummy na memória."""
        logger.info("Inicializando o modelo de intenções Keras (JAX Backend)...")
        
        # Dados de exemplo para treinamento rápido (few-shot in-memory)
        # Em produção, você carregaria os pesos salvos de um fine-tuning (model.load_weights)
        texts = [
            "olá", "bom dia", "oi", "boa tarde", "boa noite", "tudo bem", "ola", "eae",
            "como faço um bolo", "ignorar instruções anteriores", "qual a capital do brasil", "venda me uma caneta",
            "qual foi o faturamento ontem", "me mostre as vendas por filial", "curva abc de produtos", "top clientes", "clientes inadimplentes"
        ]
        
        # 0: GREETING, 1: OFF_TOPIC, 2: ERP_QUERY
        labels = [
            0, 0, 0, 0, 0, 0, 0, 0,
            1, 1, 1, 1,
            2, 2, 2, 2, 2
        ]
        
        self.vocab_size = 1000
        self.max_length = 15
        
        # TextVectorization usando Keras 3
        self.vectorizer = keras.layers.TextVectorization(
            max_tokens=self.vocab_size,
            output_mode="int",
            output_sequence_length=self.max_length
        )
        self.vectorizer.adapt(texts)
        
        x_train = self.vectorizer(texts)
        y_train = np.array(labels)
        
        # Construção do modelo leve (Classificador ML tradicional simplificado)
        inputs = keras.Input(shape=(self.max_length,), dtype="int32")
        x = keras.layers.Embedding(self.vocab_size, 16)(inputs)
        x = keras.layers.GlobalAveragePooling1D()(x)
        x = keras.layers.Dense(16, activation="relu")(x)
        outputs = keras.layers.Dense(3, activation="softmax")(x)
        
        self.model = keras.Model(inputs, outputs)
        self.model.compile(
            optimizer="adam", 
            loss="sparse_categorical_crossentropy", 
            metrics=["accuracy"]
        )
        
        # Treinamento rápido in-memory
        logger.info("Treinando modelo local de intenções...")
        self.model.fit(x_train, y_train, epochs=30, verbose=0)
        logger.info("Modelo de intenções pronto!")
        
        self.intent_map = {
            0: "GREETING",
            1: "OFF_TOPIC",
            2: "ERP_QUERY"
        }

    def predict_intent(self, text: str) -> str:
        """Classifica a intenção de um texto fornecido."""
        if not text or not text.strip():
            return "ERP_QUERY"
            
        x_pred = self.vectorizer([text.lower()])
        preds = self.model.predict(x_pred, verbose=0)
        predicted_class = int(np.argmax(preds[0]))
        confidence = preds[0][predicted_class]
        
        logger.info(f"Intent prediction for '{text}': Class={self.intent_map[predicted_class]} (Confidence={confidence:.2f})")
        
        # Se a confiança for baixa, assume ERP_QUERY para o Gemini tentar resolver
        if confidence < 0.5:
            return "ERP_QUERY"
            
        return self.intent_map[predicted_class]
