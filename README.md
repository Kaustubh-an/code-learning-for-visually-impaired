# Accessible Code Learning Platform — MVP

A local, browser-based Python learning prototype with:
- Monaco code editor
- Voice commands through browser speech recognition
- Spoken output through browser speech synthesis
- Local AI tutor through Ollama
- Local Python execution with a short timeout

## Requirements

- Windows 10/11
- Python 3.10 or newer
- Ollama for the AI tutor
- Microsoft Edge or Google Chrome
- Internet connection to load Monaco Editor from its CDN

## 1. Install Ollama and download a small chat model

Install Ollama from https://ollama.com/download

Open PowerShell and run:

```powershell
ollama pull qwen2.5:1.5b
```

Check that it is installed:

```powershell
ollama list
```

Ollama normally runs in the background after installation. If it is not running, start the Ollama application.

The model can be slow on older CPU-only laptops. This MVP uses a short context and a limited answer length to reduce resource use.

## 2. Open the project in VS Code

Extract the ZIP file. In VS Code, choose File > Open Folder and select `code-learning-platform-mvp`.

## 3. Start the application

Double-click `start.bat`.

The first run creates a virtual environment and installs Python packages. When the server starts, open:

http://127.0.0.1:8000

Keep the terminal window open while using the application.

## 4. Try the MVP

- Edit the sample Python code.
- Select **Run Python** or press Ctrl + Enter.
- Ask the tutor: `Explain the for loop in this program.`
- Select **Start voice command** and try:
  - `Read code`
  - `Explain line 2`
  - `Read line 3`
  - `Go to line 2`
  - `Run code`

Allow microphone access when the browser asks.

## 5. Change the Ollama model

The default model is `qwen2.5:1.5b`.

To use a different installed model, set an environment variable in PowerShell before starting the server:

```powershell
$env:OLLAMA_MODEL="llama3.2:1b"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The model name must match a model shown by `ollama list`.

## Accessibility testing

Use Microsoft Edge or Chrome with a screen reader such as NVDA. Monaco has screen-reader support, but the integration still needs testing with actual blind users. Try:
- Tab and Shift+Tab to move between page controls
- F1 inside Monaco to open the command palette
- Ctrl+M inside Monaco to toggle whether Tab moves focus out of the editor
- The voice command controls

## Important limitations and safety

1. Browser speech recognition support varies by browser and may rely on browser/cloud services. It is not guaranteed to work offline.
2. Browser speech synthesis uses voices available on the computer.
3. The Python runner is **not a secure sandbox**. It executes code on your computer with your Windows user's permissions. Only run code you trust. Never expose this prototype to the public internet or use it for multiple untrusted users.
4. This MVP does not have user accounts, saved lessons, progress tracking, a database, or persistent student history.
5. Monaco is loaded from a CDN, so an internet connection is needed to load the editor.

## Project structure

```text
code-learning-platform-mvp/
│
├── app/
│   ├── __init__.py
│   ├── main.py
│   └── static/
│       ├── index.html
│       ├── style.css
│       └── app.js
│
├── requirements.txt
├── start.bat
├── .gitignore
└── README.md
```

## Next development milestones

1. Test with NVDA and actual visually impaired learners.
2. Improve voice navigation and line-by-line code reading.
3. Add a secure isolated code execution service before allowing arbitrary student code.
4. Add student accounts, lesson storage, and progress tracking.
5. Introduce PostgreSQL and a cleaner Pydantic-based API structure.
6. Evaluate local speech-to-text and text-to-speech models after measuring performance on the target hardware.
