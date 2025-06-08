import * as dom from './dom.js';
import { autoResizeTextarea } from './ui.js';
import { appConfig, API_ENDPOINT } from './config.js';

let speechRecognition = null;
let isRecording = false;

// --- Speech Recognition (STT) ---
export function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = true;
        speechRecognition.interimResults = true;
        speechRecognition.lang = 'en-US';

        speechRecognition.onresult = (event) => {
            let interim_transcript = '';
            let final_transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                } else {
                    interim_transcript += event.results[i][0].transcript;
                }
            }
            dom.userInput.value = final_transcript + interim_transcript;
            autoResizeTextarea();
        };
        
        speechRecognition.onend = () => {
            isRecording = false;
            dom.micButton.classList.remove('recording');
            dom.micButton.title = "Speak";
        };

        speechRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            alert(`Speech recognition error: ${event.error}`);
            isRecording = false;
            dom.micButton.classList.remove('recording');
            dom.micButton.title = "Speak";
        };

    } else {
        dom.micButton.style.display = 'none';
        console.warn("Speech Recognition not supported in this browser.");
    }
}

export function toggleRecording() {
    if (!speechRecognition) return;
    isRecording = !isRecording;
    if (isRecording) {
        speechRecognition.start();
        dom.micButton.classList.add('recording');
        dom.micButton.title = "Stop Speaking";
    } else {
        speechRecognition.stop();
        dom.micButton.classList.remove('recording');
        dom.micButton.title = "Speak";
    }
}

// --- Text to Speech (TTS) ---
export function speak(text, button) {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        document.querySelectorAll('.tts-button.speaking').forEach(b => b.classList.remove('speaking'));
        if (button.dataset.isSpeaking === 'true') {
            button.dataset.isSpeaking = 'false';
            return;
        }
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => {
        button.classList.add('speaking');
        button.dataset.isSpeaking = 'true';
    };
    utterance.onend = () => {
        button.classList.remove('speaking');
        button.dataset.isSpeaking = 'false';
    };
    utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        button.classList.remove('speaking');
        button.dataset.isSpeaking = 'false';
    };
    speechSynthesis.speak(utterance);
}

// --- Ingredient Analyzer ---
export async function handleAnalyzeIngredients() {
    const ingredients = dom.ingredientInput.value.trim();
    if (!ingredients) {
        alert("Please paste an ingredient list first.");
        return;
    }
    if (!appConfig.apiKey) {
        alert("Please set your API key in the settings first.");
        dom.analyzerModal.style.display = "none";
        dom.settingsModal.style.display = "flex";
        return;
    }

    dom.analyzeIngredientsButton.disabled = true;
    dom.analyzeIngredientsButton.textContent = "Analyzing...";
    dom.analyzerResultsContainer.innerHTML = '<div class="loader"></div>';

    const analyzerSystemPrompt = `You are an expert skincare ingredient analyzer named 'The Ingredient Decoder'.
Analyze the following list of cosmetic ingredients. Your audience is a regular consumer, so make your explanations clear, concise, and easy to understand.
Your analysis MUST be formatted in Markdown and follow this exact structure:

### Overall Summary
- **Product Type:** (e.g., Moisturizer, Serum, Cleanser, Sunscreen)
- **Key Benefits:** (e.g., Hydrating, Brightening, Anti-Aging, Soothing)
- **Best For Skin Types:** (e.g., Dry, Oily, Combination, Sensitive, Acne-Prone)
- **Potential Concerns:** (e.g., Contains potential irritants like fragrance, High in alcohol, Contains comedogenic ingredients)

### Hero Ingredients
List the top 3-5 most effective or notable ingredients. For each:
- **[Ingredient Name]:** (Function, e.g., Humectant) - Brief explanation of its role and benefit.

### Full Ingredient Breakdown
Provide a table with three columns: 'Ingredient', 'Function', and 'Notes (Pros/Cons)'.
- The 'Function' column should be a short category (e.g., Emollient, Surfactant, Preservative).
- The 'Notes' column should briefly explain what it does and mention any common concerns (like potential for irritation, comedogenicity, or if it's a great ingredient). Use simple terms.

---
Here is the ingredient list to analyze:`;

    try {
        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${appConfig.apiKey}`,
            },
            body: JSON.stringify({
                model: appConfig.model,
                messages: [
                    { role: "system", content: analyzerSystemPrompt },
                    { role: "user", content: ingredients },
                ],
                stream: false, 
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error ? errorData.error.message : "Failed to get a response from the API.");
        }

        const data = await response.json();
        const resultText = data.choices[0].message.content;

        dom.analyzerResultsContainer.innerHTML = marked.parse(resultText);

    } catch (error) {
        console.error("Ingredient analysis error:", error);
        dom.analyzerResultsContainer.innerHTML = `<p style="color: #e74c3c; text-align: center;"><strong>Error:</strong> ${error.message}</p>`;
    } finally {
        dom.analyzeIngredientsButton.disabled = false;
        dom.analyzeIngredientsButton.textContent = "Analyze Ingredients";
    }
}