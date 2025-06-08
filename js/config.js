import * as dom from './dom.js';

// --- Constants ---
export const ROLES = { USER: "user", AI: "assistant", SYSTEM: "system" };
export const MESSAGE_CLASSES = { USER: "user", AI: "ai" };
export const CONTENT_TYPES = { TEXT: "text", IMAGE_URL: "image_url" };
export const THEMES = ["light", "dark", "mint", "pink"];
export const API_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const MODELS = [
    { name: "Gemini 2.0 Flash", id: "google/gemini-2.0-flash-001" },
    { name: "DeepSeek R1", id: "deepseek/deepseek-r1-0528-qwen3-8b:free" },
    { name: "Llama 3.3 8B", id: "meta-llama/llama-3.3-8b-instruct:free" },
    { name: "Qwen3 30B", id: "qwen/qwen3-30b-a3b:free" },
    { name: "DeepSeek Chat (Default)", id: "deepseek/deepseek-chat" },
];

// --- Default Fallback Configuration ---
const DEFAULT_CONFIG = {
    apiKey: "",
    model: "deepseek/deepseek-chat",
    systemPrompt: `You are CLEO, a knowledgeable and friendly AI skincare consultant. Your expertise includes:\n\n- Analyzing skin types and concerns (dry, oily, combination, sensitive, acne-prone, aging)\n- Recommending skincare routines and products\n- Explaining skincare ingredients and their benefits\n- Providing advice on specific skin conditions\n- Suggesting lifestyle changes for better skin health\n- Sun protection and anti-aging guidance\n\nAlways be helpful, encouraging, and personalized in your responses. Use emojis appropriately to make conversations friendly. When recommending products, focus on ingredients rather than specific brands unless asked. Always remind users to patch test new products and consult dermatologists for serious concerns. If an image is provided, analyze it in the context of the user's query.\n\nBe conversational and supportive - many people feel insecure about their skin, so provide reassurance along with practical advice. Format your responses using Markdown. Code blocks should be used for structured information like routines if appropriate.`,
    userProfile: ""
};

// --- App State ---
export let appConfig = {};

// --- Functions ---
export function loadConfig() {
    const savedConfig = JSON.parse(localStorage.getItem("cleoConfig"));
    appConfig = { ...DEFAULT_CONFIG, ...savedConfig };
    
    dom.apiKeyInput.value = appConfig.apiKey;
    dom.systemPromptInput.value = appConfig.systemPrompt;
    dom.userProfileInput.value = appConfig.userProfile;

    const isPredefinedModel = MODELS.some(m => m.id === appConfig.model);

    if (isPredefinedModel) {
        dom.modelSelect.value = appConfig.model;
        dom.customModelContainer.style.display = 'none';
    } else {
        dom.modelSelect.value = 'custom';
        dom.modelInput.value = appConfig.model;
        dom.customModelContainer.style.display = 'flex';
    }

    const currentModel = MODELS.find(m => m.id === appConfig.model);
    dom.currentModelDisplay.textContent = currentModel ? currentModel.name : appConfig.model;
    
    dom.sendButton.disabled = !appConfig.apiKey;
    if (!appConfig.apiKey) {
        dom.userInput.placeholder = "Please add your API key in settings...";
    }
}

export function saveConfig() {
    let selectedModel = dom.modelSelect.value;
    if (selectedModel === 'custom') {
        selectedModel = dom.modelInput.value.trim();
        if (!selectedModel) {
            alert("Please enter a custom model identifier to save.");
            return;
        }
    }

    const newConfig = {
        apiKey: dom.apiKeyInput.value.trim(),
        model: selectedModel,
        systemPrompt: dom.systemPromptInput.value.trim(),
        userProfile: dom.userProfileInput.value.trim()
    };
    localStorage.setItem("cleoConfig", JSON.stringify(newConfig));
    alert("Settings saved. The app will now reload to apply the changes.");
    window.location.reload();
}