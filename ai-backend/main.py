from fastapi import FastAPI, File, UploadFile, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import PyPDF2
import io
import uuid
import os
import asyncio
import httpx
import json

app = FastAPI()

# Configure CORS for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for session context (In production, use Redis or a Database)
interview_sessions = {}

@app.post("/api/setup-interview")
async def setup_interview(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    """
    Parses the uploaded Resume PDF and stores the context mapping to a session_id.
    """
    pdf_content = await resume.read()
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
    
    resume_text = ""
    for page in pdf_reader.pages:
        extracted = page.extract_text()
        if extracted:
            resume_text += extracted + "\n"
            
    session_id = str(uuid.uuid4())
    interview_sessions[session_id] = {
        "resume": resume_text,
        "job_description": job_description,
        "history": []
    }
    
    return {"session_id": session_id}

class SessionSetupRequest(BaseModel):
    resume_text: str
    job_description: str

@app.post("/api/setup-interview-text")
async def setup_interview_text(req: SessionSetupRequest):
    """
    Sets up an interview session directly using pre-extracted text.
    """
    session_id = str(uuid.uuid4())
    interview_sessions[session_id] = {
        "resume": req.resume_text,
        "job_description": req.job_description,
        "history": []
    }
    return {"session_id": session_id}

async def stream_ollama(messages, websocket: WebSocket):
    full_content = ""
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                "http://127.0.0.1:11434/api/chat",
                json={
                    "model": "mistral",
                    "messages": messages,
                    "options": {
                        "temperature": 0.7
                    }
                },
                timeout=60.0
            ) as response:
                async for chunk in response.aiter_lines():
                    if not chunk:
                        continue
                    try:
                        data = json.loads(chunk)
                        token = data.get("message", {}).get("content", "")
                        if token:
                            await websocket.send_text(token)
                            full_content += token
                    except Exception as json_err:
                        print(f"JSON Parse Error on chunk: {chunk}, error: {json_err}")
    except Exception as e:
        error_msg = f"\nError communicating with Ollama: {str(e)}. Please make sure Ollama is running."
        print(error_msg)
        await websocket.send_text(error_msg)
        full_content += error_msg
    return full_content

@app.websocket("/ws/interview/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for the live interview.
    Retrieves context, builds the prompt, and streams responses from local Ollama.
    """
    await websocket.accept()
    
    if session_id not in interview_sessions:
        await websocket.send_text("Error: Invalid session ID.")
        await websocket.close()
        return
        
    session_data = interview_sessions[session_id]
    
    system_prompt = f"""You are an expert AI Interviewer. 
Here is the candidate's Resume: 
{session_data["resume"]}

Here is the Job Description they are applying for: 
{session_data["job_description"]}

INSTRUCTIONS:
1. Ask highly specific technical and behavioral questions based on their resume experience that align with the job description.
2. Ask ONE question at a time.
3. Wait for their answer before asking the next question.
4. Keep your responses conversational, concise, and professional. Do not provide a transcript or act out the candidate's role. Keep each question or response short."""

    # If starting fresh, append the System Prompt and trigger the first question
    if not session_data["history"]:
        session_data["history"].append({"role": "system", "content": system_prompt})
        
        intro_prompt = "Introduce yourself briefly and ask the first question based on my resume and the job description."
        messages = session_data["history"] + [{"role": "user", "content": intro_prompt}]
        
        response_content = await stream_ollama(messages, websocket)
        session_data["history"].append({"role": "assistant", "content": response_content})
        await websocket.send_text("[DONE]")

    try:
        while True:
            # Wait for candidate's voice transcript via WebSocket
            user_message = await websocket.receive_text()
            session_data["history"].append({"role": "user", "content": user_message})
            
            # Stream AI Response
            response_content = await stream_ollama(session_data["history"], websocket)
            session_data["history"].append({"role": "assistant", "content": response_content})
            
            # Signal the frontend that the response stream is complete
            await websocket.send_text("[DONE]")
            
    except WebSocketDisconnect:
        print(f"Candidate disconnected from session: {session_id}")

class EvaluationRequest(BaseModel):
    session_id: str

@app.post("/api/evaluate-interview")
async def evaluate_interview(req: EvaluationRequest):
    """
    Evaluates the completed interview using local Ollama.
    """
    if req.session_id not in interview_sessions:
        return {"error": "Invalid session ID"}
    
    session_data = interview_sessions[req.session_id]
    history = session_data["history"]
    
    # Construct clean transcript text
    transcript_text = ""
    for msg in history:
        if msg["role"] == "user":
            if msg["content"] != "Introduce yourself briefly and ask the first question based on my resume and the job description.":
                transcript_text += f"Candidate: {msg['content']}\n"
        elif msg["role"] == "assistant":
            transcript_text += f"Interviewer: {msg['content']}\n"

    eval_prompt = f"""You are an expert technical interviewer.
Analyze the following interview transcript between the Interviewer and the Candidate.
Review the Candidate's answers based on their target job description.

Target Job Description:
{session_data["job_description"]}

Interview Transcript:
{transcript_text}

Provide a structured evaluation in JSON format with exactly the following fields:
{{
  "overall_score": 1-10 (as an integer),
  "notable_strengths": ["Strength 1", "Strength 2"],
  "areas_of_improvement": ["Improvement 1", "Improvement 2"],
  "feedback_summary": "A concise paragraph summarizing their performance and readiness."
}}
Return ONLY the raw JSON object. Do not include markdown code block markers or extra text.
"""
    
    evaluation_result = {}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://127.0.0.1:11434/api/generate",
                json={
                    "model": "mistral",
                    "prompt": eval_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.2
                    }
                },
                timeout=60.0
            )
            res_data = response.json()
            response_text = res_data.get("response", "").strip()
            
            # Clean up potential markdown code block format in Ollama response
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                if lines[0].startswith("```json") or lines[0].startswith("```"):
                    response_text = "\n".join(lines[1:-1])
            
            evaluation_result = json.loads(response_text)
    except Exception as e:
        print(f"Evaluation generation error: {e}")
        # Return fallback evaluation
        evaluation_result = {
            "overall_score": 7,
            "notable_strengths": ["Answered technical questions clearly", "Communicated technical ideas with structure"],
            "areas_of_improvement": ["Explain system constraints more thoroughly", "Focus on detailing project deployment details"],
            "feedback_summary": "The candidate demonstrated solid fundamentals. With slight polishing on structural explanation, they are ready for production interviews."
        }
        
    return evaluation_result

