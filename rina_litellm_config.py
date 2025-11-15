import base64
import mimetypes
from typing import Union
import asyncio
from litellm import acompletion, completion

OLLAMA_API = "http://localhost:11434"

async def rina_ollama_stream(prompt, model="ollama/llama2"):
    response = await acompletion(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        api_base=OLLAMA_API,
        stream=True
    )
    async for chunk in response:
        if "choices" in chunk:
            delta = chunk["choices"][0]["delta"]
            if "content" in delta:
                yield delta["content"]

async def rina_ollama_json(prompt, model="ollama/llama2"):
    response = completion(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        api_base=OLLAMA_API,
        format="json"
    )
    return response

async def vision_chat(image_input: Union[str, bytes], text_prompt: str = "What is in this image?", model: str = "ollama/llava"):
    """
    Send an image (path, URL, or base64) + text prompt to Ollama's llava model.
    """
    if isinstance(image_input, str) and not image_input.startswith("data:"):
        # If it's a file path, encode to base64
        try:
            with open(image_input, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            mime = mimetypes.guess_type(image_input)[0] or "image/png"
            image_b64 = f"data:{mime};base64,{b64}"
        except FileNotFoundError:
            image_b64 = image_input
    elif isinstance(image_input, bytes):
        image_b64 = "data:image/png;base64," + base64.b64encode(image_input).decode("utf-8")
    else:
        image_b64 = image_input

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": text_prompt},
                {"type": "image_url", "image_url": {"url": image_b64}},
            ],
        }
    ]

    response = await acompletion(model=model, messages=messages, api_base=OLLAMA_API)
    return response