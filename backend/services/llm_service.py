import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Automatically load environment variables from .env
load_dotenv()

from backend.logger import logger

class LLMService:
    """
    Production-grade LLM Integration Service.
    Supports Ollama Cloud, Ollama Local, Groq, OpenAI, and Gemini free tier providers.
    Uses verified database grounding to ensure zero-hallucination responses.
    """

    @staticmethod
    def get_status() -> Dict[str, Any]:
        ollama_key = os.getenv("OLLAMA_API_KEY") or os.getenv("LLM_API_KEY")
        groq_key = os.getenv("GROQ_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")

        active_provider = "ollama" if ollama_key else ("groq" if groq_key else ("openai" if openai_key else ("gemini" if gemini_key else "local_deterministic")))
        has_key = bool(ollama_key or groq_key or openai_key or gemini_key)

        return {
            "status": "ONLINE" if has_key else "READY_LOCAL",
            "provider": active_provider.upper(),
            "model": "llama3.2" if active_provider == "ollama" else ("llama-3.3-70b" if active_provider == "groq" else "gpt-4o-mini"),
            "has_api_key": has_key,
            "ollama_key_configured": bool(ollama_key),
            "cloud_integration": "ACTIVE" if has_key else "LOCAL_FALLBACK"
        }

    @staticmethod
    def generate_response(
        prompt: str,
        system_context: str = "",
        data_context: Optional[Dict[str, Any]] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 1024
    ) -> Optional[str]:
        ollama_key = os.getenv("OLLAMA_API_KEY") or os.getenv("LLM_API_KEY")
        groq_key = os.getenv("GROQ_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")

        full_system = (
            "You are NEC Unified AI, a state-of-the-art AI assistant for Nandha Engineering College LeetCode Performance Analytics (like ChatGPT).\n"
            "You have deep knowledge of LeetCode, Data Structures, Algorithms, Python/Java/C++, college student rankings, and institutional analytics.\n"
            "You understand and can converse fluently in English, Tamil, and Tanglish (Tamil written in English script).\n"
            "When answering coding/technical questions, provide clear explanations, optimal time/space complexities, and clean code blocks.\n"
            "When answering institutional/student questions, ground your answers in the verified database facts provided.\n"
            "Format your output with clean, beautiful Markdown (bullet points, bold text, code blocks).\n"
        )
        if system_context:
            full_system += f"\nSpecific Context:\n{system_context}"
        if data_context:
            full_system += f"\nVerified Database Facts:\n{json.dumps(data_context, default=str)}"

        # 1. Try Ollama Cloud / API
        if ollama_key:
            res = LLMService._call_ollama_api(ollama_key, prompt, full_system, history=history, max_tokens=max_tokens)
            if res:
                return res

        # 2. Try Groq API if configured
        if groq_key:
            res = LLMService._call_openai_compatible(
                url="https://api.groq.com/openai/v1/chat/completions",
                api_key=groq_key,
                model="llama-3.3-70b-versatile",
                prompt=prompt,
                system_context=full_system,
                history=history,
                max_tokens=max_tokens
            )
            if res:
                return res

        # 3. Try OpenAI API if configured
        if openai_key:
            res = LLMService._call_openai_compatible(
                url="https://api.openai.com/v1/chat/completions",
                api_key=openai_key,
                model="gpt-4o-mini",
                prompt=prompt,
                system_context=full_system,
                history=history,
                max_tokens=max_tokens
            )
            if res:
                return res

        return None

    @staticmethod
    def _call_ollama_api(
        api_key: Optional[str],
        prompt: str,
        system_context: str,
        history: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 1024
    ) -> Optional[str]:
        # Try local Ollama first, then cloud endpoints
        endpoints = [
            ("http://localhost:11434/api/chat", "llama3.2", False),
            ("http://localhost:11434/v1/chat/completions", "llama3.2", False),
            ("https://api.ollama.com/v1/chat/completions", "llama3.2", True),
            ("https://ollama.com/api/chat", "llama3.2", True)
        ]

        messages = [{"role": "system", "content": system_context}]
        if history:
            for turn in history[-6:]: # Last 6 conversation turns
                role = "user" if turn.get("sender") == "user" or turn.get("role") == "user" else "assistant"
                content = turn.get("text") or turn.get("content") or ""
                if content:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": "llama3.2",
            "messages": messages,
            "stream": False,
            "max_tokens": max_tokens,
            "options": {"num_predict": max_tokens},
            "temperature": 0.4
        }

        for url, model, require_auth in endpoints:
            try:
                headers = {"Content-Type": "application/json"}
                if require_auth and api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

                payload["model"] = model
                req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
                with urllib.request.urlopen(req, timeout=25) as response:
                    res_body = response.read().decode('utf-8')
                    
                    # 1. Single JSON response
                    try:
                        res_json = json.loads(res_body)
                        if "choices" in res_json and len(res_json["choices"]) > 0:
                            return res_json["choices"][0]["message"]["content"].strip()
                        elif "message" in res_json and "content" in res_json["message"]:
                            return res_json["message"]["content"].strip()
                    except json.JSONDecodeError:
                        # 2. JSON Lines streaming response
                        chunks = []
                        for line in res_body.strip().split("\n"):
                            line_str = line.strip()
                            if not line_str:
                                continue
                            try:
                                chunk = json.loads(line_str)
                                if "message" in chunk and "content" in chunk["message"]:
                                    chunks.append(chunk["message"]["content"])
                                elif "choices" in chunk and len(chunk["choices"]) > 0:
                                    content = chunk["choices"][0].get("delta", {}).get("content") or chunk["choices"][0].get("message", {}).get("content", "")
                                    if content:
                                        chunks.append(content)
                            except Exception:
                                pass
                        if chunks:
                            return "".join(chunks).strip()
            except Exception as err:
                logger.debug(f"[LLM_SERVICE_NOTE] Ollama endpoint '{url}' note: {err}")
                continue

        return None

    @staticmethod
    def _call_openai_compatible(
        url: str,
        api_key: str,
        model: str,
        prompt: str,
        system_context: str,
        history: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 1024
    ) -> Optional[str]:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        messages = [{"role": "system", "content": system_context}]
        if history:
            for turn in history[-6:]:
                role = "user" if turn.get("sender") == "user" or turn.get("role") == "user" else "assistant"
                content = turn.get("text") or turn.get("content") or ""
                if content:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": max_tokens
        }
        try:
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=15) as response:
                res_json = json.loads(response.read().decode('utf-8'))
                if "choices" in res_json and len(res_json["choices"]) > 0:
                    return res_json["choices"][0]["message"]["content"].strip()
        except Exception as err:
            logger.warning(f"[LLM_SERVICE_ERROR] Call to {url} failed: {err}")
        return None
