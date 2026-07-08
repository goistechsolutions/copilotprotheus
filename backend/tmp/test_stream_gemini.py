import asyncio
import os
import sys
import httpx
import json
from dotenv import load_dotenv

load_dotenv("C:/projeto/copilotprotheus/backend/.env")

async def main():
    print("Iniciando teste de streaming direto do Gemini...")
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={api_key}"
    
    payload = {
        "contents": [{"role": "user", "parts": [{"text": "Escreva um poema curto sobre o mar."}]}]
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream("POST", url, json=payload) as resp:
            print(f"Status: {resp.status_code}")
            buffer = ""
            async for chunk in resp.aiter_text():
                buffer += chunk
                while True:
                    start = buffer.find("{")
                    if start == -1:
                        buffer = ""
                        break
                    
                    brace_count = 0
                    in_string = False
                    escape = False
                    end = -1
                    
                    for i in range(start, len(buffer)):
                        char = buffer[i]
                        if escape:
                            escape = False
                            continue
                        if char == "\\":
                            escape = True
                            continue
                        if char == '"':
                            in_string = not in_string
                            continue
                        if not in_string:
                            if char == '{':
                                brace_count += 1
                            elif char == '}':
                                brace_count -= 1
                                if brace_count == 0:
                                    end = i
                                    break
                    
                    if end != -1:
                        json_str = buffer[start:end+1]
                        buffer = buffer[end+1:]
                        try:
                            data = json.loads(json_str)
                            chunk_parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                            chunk_text = "".join([p.get("text", "") for p in chunk_parts if "text" in p])
                            if chunk_text:
                                print(chunk_text, end="", flush=True)
                        except Exception as e:
                            print(f"\nErro ao parsear JSON: {e}", file=sys.stderr)
                    else:
                        break
            print("\n\nStream finalizado.")

if __name__ == "__main__":
    asyncio.run(main())

if __name__ == "__main__":
    asyncio.run(main())
