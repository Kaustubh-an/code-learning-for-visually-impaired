let editor = null;

const outputBox = document.getElementById("output");
const tutorAnswer = document.getElementById("tutorAnswer");
const voiceStatus = document.getElementById("voiceStatus");
const connectionStatus = document.getElementById("connectionStatus");

const sampleCode = `name = "Student"
for number in range(1, 4):
    print("Hello", name, number)
`;

function setStatus(message) {
    connectionStatus.textContent = message;
}

function speak(text) {
    if (!("speechSynthesis" in window)) {
        voiceStatus.textContent = "Speech output is not supported in this browser.";
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
    voiceStatus.textContent = "Speech stopped.";
}

function getCode() {
    return editor ? editor.getValue() : "";
}

async function checkHealth() {
    try {
        const response = await fetch("/api/health");
        const data = await response.json();

        if (data.model_available) {
            setStatus("Ollama connected. Tutor model is ready.");
        } else if (data.ollama === "connected") {
            setStatus(`Ollama is running, but ${data.configured_model} is not installed.`);
        } else {
            setStatus("Ollama is not reachable. Start Ollama to use the AI tutor.");
        }
    } catch {
        setStatus("Could not check the backend connection.");
    }
}

async function runCode() {
    if (!editor) return;

    const code = getCode();
    outputBox.textContent = "Running your Python program...";
    document.getElementById("runButton").disabled = true;

    try {
        const response = await fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Could not run the program.");
        }

        let result = "";
        if (data.stdout) result += "Program output:\n" + data.stdout;
        if (data.stderr) result += "\nErrors or warnings:\n" + data.stderr;
        if (!result.trim()) result = "The program finished without printing anything.";
        if (data.return_code !== null) result += `\nExit code: ${data.return_code}`;

        outputBox.textContent = result;
        speak(result);
    } catch (error) {
        outputBox.textContent = "Error: " + error.message;
        speak("There was an error running your program. " + error.message);
    } finally {
        document.getElementById("runButton").disabled = false;
    }
}

async function askTutor(question) {
    if (!question || !question.trim()) {
        tutorAnswer.textContent = "Enter or speak a question first.";
        return;
    }

    tutorAnswer.textContent = "The AI tutor is preparing an explanation...";
    document.getElementById("askButton").disabled = true;

    try {
        const response = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: question.trim(),
                code: getCode()
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "The tutor request failed.");
        }

        tutorAnswer.textContent = data.answer;
        speak(data.answer);
    } catch (error) {
        tutorAnswer.textContent = "Tutor error: " + error.message;
        speak("Tutor error. " + error.message);
    } finally {
        document.getElementById("askButton").disabled = false;
    }
}

function getLineText(lineNumber) {
    const model = editor.getModel();
    if (!model || lineNumber < 1 || lineNumber > model.getLineCount()) {
        return null;
    }
    return model.getLineContent(lineNumber);
}

function readCode() {
    const lines = getCode().split("\n");
    const spoken = lines.map((line, index) => `Line ${index + 1}. ${line || "Blank line."}`).join(". ");
    speak(spoken);
    voiceStatus.textContent = "Reading the code aloud.";
}

function handleVoiceCommand(rawText) {
    const command = rawText.toLowerCase().trim();
    voiceStatus.textContent = `Heard: ${rawText}`;

    if (command.includes("stop speaking") || command === "stop") {
        stopSpeaking();
        return;
    }

    if (command.includes("read code")) {
        readCode();
        return;
    }

    if (command.includes("run code") || command === "run") {
        runCode();
        return;
    }

    const explainMatch = command.match(/explain line (\d+)/);
    if (explainMatch) {
        const lineNumber = Number(explainMatch[1]);
        const line = getLineText(lineNumber);
        if (line === null) {
            speak(`There is no line ${lineNumber}.`);
            return;
        }
        askTutor(`Explain line ${lineNumber}: ${line}`);
        return;
    }

    const readMatch = command.match(/read line (\d+)/);
    if (readMatch) {
        const lineNumber = Number(readMatch[1]);
        const line = getLineText(lineNumber);
        if (line === null) {
            speak(`There is no line ${lineNumber}.`);
        } else {
            speak(`Line ${lineNumber}. ${line || "Blank line."}`);
        }
        return;
    }

    const goMatch = command.match(/go to line (\d+)/);
    if (goMatch) {
        const lineNumber = Number(goMatch[1]);
        const model = editor.getModel();
        if (lineNumber >= 1 && lineNumber <= model.getLineCount()) {
            editor.revealLineInCenter(lineNumber);
            editor.setPosition({ lineNumber, column: 1 });
            editor.focus();
            speak(`Moved to line ${lineNumber}.`);
        } else {
            speak(`There is no line ${lineNumber}.`);
        }
        return;
    }

    askTutor(rawText);
}

function setupVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        document.getElementById("micButton").disabled = true;
        voiceStatus.textContent =
            "Speech recognition is not available in this browser. Try a recent version of Microsoft Edge or Chrome.";
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        voiceStatus.textContent = "Listening. Speak a command.";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceCommand(transcript);
    };

    recognition.onerror = (event) => {
        voiceStatus.textContent = `Microphone error: ${event.error}`;
    };

    recognition.onend = () => {
        if (!voiceStatus.textContent.startsWith("Heard:")) {
            voiceStatus.textContent += " Listening stopped.";
        }
    };

    document.getElementById("micButton").addEventListener("click", () => {
        try {
            recognition.start();
        } catch {
            voiceStatus.textContent = "Voice recognition is already starting or active.";
        }
    });
}

document.getElementById("runButton").addEventListener("click", runCode);
document.getElementById("readButton").addEventListener("click", readCode);
document.getElementById("stopButton").addEventListener("click", stopSpeaking);
document.getElementById("askButton").addEventListener("click", () => {
    askTutor(document.getElementById("questionInput").value);
});

document.getElementById("questionInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        askTutor(event.target.value);
    }
});

require(["vs/editor/editor.main"], function () {
    editor = monaco.editor.create(document.getElementById("editor"), {
        value: sampleCode,
        language: "python",
        theme: "vs-dark",
        automaticLayout: true,
        accessibilitySupport: "on",
        ariaLabel: "Python code editor. Use arrow keys to navigate lines.",
        minimap: { enabled: false },
        fontSize: 16,
        lineNumbers: "on",
        wordWrap: "on",
        scrollBeyondLastLine: false
    });

    editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        runCode
    );

    editor.focus();
    checkHealth();
});

setupVoiceRecognition();
