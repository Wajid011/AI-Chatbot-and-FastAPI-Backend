# AI Chatbot UI & FastAPI Backend

A complete full-stack AI chatbot application featuring a glassmorphism frontend interface and a FastAPI python backend serving the Qwen 2.5 0.5B model.

## Features
- **FastAPI Backend**: Uses HuggingFace `transformers` to load and serve a local quantized model.
- **Sleek UI**: Vanilla HTML/CSS/JS frontend featuring a responsive glassmorphism design with animated background blobs.
- **Streaming Support**: Real-time token streaming using Server-Sent Events (SSE).
- **Conversation Memory**: The chatbot remembers what you've discussed in the current session.

## Prerequisites
- Python 3.10+
- (Optional but recommended) A local GPU or Apple Silicon for faster inference. On a standard CPU, inference will work but may be slower.

## Installation

1. Clone the repository and navigate to the directory.
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate
   
   # Linux/Mac
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install the required Python packages:
   ```bash
   pip install -r backend/requirements.txt
   ```

## Running the Application

### 1. Start the Backend
Navigate to the `backend` folder and run the FastAPI server:
```bash
cd backend
python main.py
```
*Note: The first time you run this, it will download the Qwen2.5-0.5B-Instruct model (approx ~1-2 GB). Please be patient.*

The backend will start on `http://localhost:8000`.

### 2. Open the Frontend
Since the frontend uses vanilla web technologies, you can simply open `frontend/index.html` in your web browser. 
Alternatively, serve it with a simple Python HTTP server:
```bash
cd frontend
python -m http.server 3000
```
Then visit `http://localhost:3000` in your browser.

## API Endpoints
- `POST /generate`: Returns a complete response once text generation finishes.
- `POST /stream`: Streams the response token by token as it generates (used by default in the frontend).

## Pushing to GitHub
This project is already initialized as a Git repository and contains a `.gitignore` configured for Python projects.

To push it:
```bash
git remote add origin https://github.com/yourusername/your-repo-name.git
git push -u origin main
```
