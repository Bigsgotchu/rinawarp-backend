import os

def get_model(provider="local"):
    if provider == "local":
        return "ollama/llama2"
    elif provider == "openai":
        return "gpt-4-turbo"
    elif provider == "anthropic":
        return "claude-3-sonnet"
    elif provider == "groq":
        return "mixtral-8x7b"
    else:
        return "ollama/mistral"