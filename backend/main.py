import asyncio
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any

from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
import torch
from threading import Thread

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Chatbot FastAPI Backend", version="1.0.0")

# Allow CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
# Using a smaller Qwen model for reasonable local performance
MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct" 

logger.info(f"Loading '{MODEL_NAME}' model... This may take a moment.")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME, 
    torch_dtype=torch.float16, # Use half-precision to save memory
    device_map="auto"          # Distribute model efficiently across GPU/CPU
)
logger.info("Model loaded successfully.")

# Input Schemas
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    # Optional generation parameters
    max_new_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.9

@app.post("/generate")
async def generate(request: ChatRequest):
    """
    Standard Generation Endpoint (Complete Response).
    Takes a conversation history and generates the assistant's complete response.
    """
    # Convert Pydantic models to dicts for the tokenizer
    conversation = [{"role": msg.role, "content": msg.content} for msg in request.messages]
    
    # Format the messages using the model's chat template
    text = tokenizer.apply_chat_template(
        conversation,
        tokenize=False,
        add_generation_prompt=True
    )
    
    inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    # Generate the response
    with torch.no_grad():
        generated_ids = model.generate(
            **inputs,
            max_new_tokens=request.max_new_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            pad_token_id=tokenizer.eos_token_id
        )
        
    # Extract only the newly generated part (Assistant's reply)
    generated_ids = [
        output_ids[len(input_ids):] for input_ids, output_ids in zip(inputs.input_ids, generated_ids)
    ]
    
    response_text = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
    
    return {"response": response_text}

@app.post("/stream")
async def stream(request: Request):
    """
    Streaming Generation Endpoint.
    Yields tokens directly to the client as Server-Sent Events (SSE).
    """
    body = await request.json()
    chat_request = ChatRequest(**body)
    
    conversation = [{"role": msg.role, "content": msg.content} for msg in chat_request.messages]
    
    text = tokenizer.apply_chat_template(
        conversation,
        tokenize=False,
        add_generation_prompt=True
    )
    
    inputs = tokenizer([text], return_tensors="pt").to(model.device)
    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
    
    generation_kwargs = dict(
        inputs,
        streamer=streamer,
        max_new_tokens=chat_request.max_new_tokens,
        temperature=chat_request.temperature,
        top_p=chat_request.top_p,
        pad_token_id=tokenizer.eos_token_id
    )
    
    # Run generation process in a separate thread so we can yield from the generator
    thread = Thread(target=model.generate, kwargs=generation_kwargs)
    thread.start()

    async def event_generator():
        for text in streamer:
            # Yield as an SSE string
            if text:
                # We yield the text encoded nicely
                yield f"data: {text}\n\n"
            # Hand over control to allow async streaming
            await asyncio.sleep(0.01)
        # Indicate end of stream
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
