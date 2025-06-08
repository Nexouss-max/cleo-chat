import * as dom from './dom.js';
import { loadConfig, saveConfig, ROLES, MESSAGE_CLASSES, MODELS } from './config.js';
import { applyTheme, autoResizeTextarea, createTypingIndicatorElement } from './ui.js';
import { handleSendMessage, stopCurrentGeneration, processPendingFile } from './api.js';
import {
    loadHistoryAndTheme,
    loadInitialChatState,
    createNewChat,
    clearAllHistory,
    exportCurrentChat,
    updateChatHistorySidebar,
    chatHistory,
    currentChatId
} from './chat.js';
import { setupSpeechRecognition, toggleRecording, handleAnalyzeIngredients } from './features.js';

// --- FIX: Add a flag to track if it's the user's first visit ---
let isNewVisitor = false;

// --- Function to handle viewport height from previous fix ---
function setAppHeight() {
    const doc = document.documentElement;
    doc.style.setProperty('--app-height', `${window.innerHeight}px`);
}

// --- Initialization ---
function init() {
    handleWelcomeScreen(); // This will now set the isNewVisitor flag
    populateModelDropdown();
    loadConfig();
    const theme = loadHistoryAndTheme();
    applyTheme(theme);
    setupEventListeners();
    configureMarkdown();
    createTypingIndicatorElement();
    
    // --- FIX: Only load the chat state immediately if it's a returning visitor ---
    if (!isNewVisitor) {
        loadInitialChatState();
    }
    
    setupSpeechRecognition();

    window.addEventListener('resize', setAppHeight);
    setAppHeight();
}

// --- Welcome Screen Logic ---
function handleWelcomeScreen() {
    if (localStorage.getItem('hasVisitedCleo') === 'true') {
        isNewVisitor = false;
        // Returning visitor
        dom.welcomeOverlay.style.display = 'none';
        dom.appContainer.style.display = 'flex';
    } else {
        isNewVisitor = true;
        // First-time visitor
        dom.welcomeOverlay.style.display = 'flex';
        dom.appContainer.style.display = 'none';
        
        const startApp = () => {
            localStorage.setItem('hasVisitedCleo', 'true');
            dom.welcomeOverlay.classList.add('fade-out');
            
            setTimeout(() => {
                dom.welcomeOverlay.style.display = 'none';
                dom.appContainer.style.display = 'flex';
                
                // --- FIX: Load the chat state now that the UI is visible ---
                loadInitialChatState(); 
                
            }, 500); 
        };

        dom.enterChatButton.addEventListener('click', startApp);

        // Also make the ingredient analyzer button on welcome screen functional
        dom.welcomeAnalyzeButton.addEventListener('click', () => {
            startApp();
            // A short delay to allow the main UI to render before opening the modal
            setTimeout(() => {
                dom.analyzerModal.style.display = 'flex';
            }, 600);
        });
    }
}

function populateModelDropdown() {
    dom.modelSelect.innerHTML = '';
    MODELS.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        dom.modelSelect.appendChild(option);
    });
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom...';
    dom.modelSelect.appendChild(customOption);
}

function setupEventListeners() {
    dom.userInput.addEventListener("input", autoResizeTextarea);
    dom.sendButton.addEventListener("click", () => handleSendMessage(false));
    dom.userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(false);
        }
    });

    dom.newChatButton.addEventListener("click", createNewChat);
    dom.clearHistoryButton.addEventListener("click", clearAllHistory);
    dom.exportChatButton.addEventListener("click", exportCurrentChat);
    dom.regenerateResponseButton.addEventListener("click", regenerateLastResponse);
    dom.stopResponseButton.addEventListener("click", stopCurrentGeneration);
    dom.searchHistoryInput.addEventListener("input", (e) => updateChatHistorySidebar(e.target.value));

    // Settings Modal Listeners
    dom.openSettingsButton.addEventListener("click", () => dom.settingsModal.style.display = "flex");
    dom.closeSettingsButton.addEventListener("click", () => dom.settingsModal.style.display = "none");
    dom.saveSettingsButton.addEventListener("click", saveConfig);
    dom.modelSelect.addEventListener('change', () => {
        dom.customModelContainer.style.display = dom.modelSelect.value === 'custom' ? 'flex' : 'none';
    });
    
    // Analyzer Modal Listeners
    dom.openAnalyzerButton.addEventListener("click", () => dom.analyzerModal.style.display = "flex");
    dom.closeAnalyzerButton.addEventListener("click", () => dom.analyzerModal.style.display = "none");
    dom.analyzeIngredientsButton.addEventListener("click", handleAnalyzeIngredients);

    // Theme Dropdown Listeners
    dom.themeMenuButton.addEventListener("click", (e) => {
        e.stopPropagation();
        dom.themeDropdown.style.display = dom.themeDropdown.style.display === 'block' ? 'none' : 'block';
    });
    
    // Global Listeners
    window.addEventListener("click", (e) => {
        if (e.target !== dom.themeMenuButton && !dom.themeMenuButton.contains(e.target)) {
            dom.themeDropdown.style.display = "none";
        }
        if (e.target === dom.settingsModal) {
            dom.settingsModal.style.display = "none";
        }
        if (e.target === dom.analyzerModal) {
            dom.analyzerModal.style.display = "none";
        }
    });

    dom.fileUploadButton.addEventListener("click", () => dom.fileUploadInput.click());
    dom.fileUploadInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            processPendingFile(file);
        }
    });

    dom.micButton.addEventListener("click", toggleRecording);

    // UPDATED SIDEBAR TOGGLE LOGIC
    dom.sidebarToggle.addEventListener("click", () => {
        const isCollapsed = dom.sidebar.classList.toggle("collapsed");
        if (window.innerWidth <= 768) {
            dom.sidebarOverlay.classList.toggle("active", !isCollapsed);
        }
    });

    // Listener to close sidebar when clicking outside on mobile
    dom.sidebarOverlay.addEventListener("click", () => {
        dom.sidebar.classList.add("collapsed");
        dom.sidebarOverlay.classList.remove("active");
    });
}

function configureMarkdown() {
    marked.setOptions({
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        breaks: true,
    });
    hljs.highlightAllUnder = (block) => {
        block.querySelectorAll('pre code').forEach(hljs.highlightElement);
    };
}

function regenerateLastResponse() {
        if (!currentChatId || !chatHistory[currentChatId]) return;
        
        let messages = [...chatHistory[currentChatId].messages];
        let lastUserMessageIndex = -1;
        // Find the last message sent by the user
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === ROLES.USER) {
                lastUserMessageIndex = i;
                break;
            }
        }
    
        // If there are no user messages, we can't regenerate anything
        if (lastUserMessageIndex === -1) {
            alert("Could not find a user message to regenerate a response from.");
            return; 
        }

        
    const allMessageElements = Array.from(dom.messagesContainer.querySelectorAll('.message'));
    let userMessageFound = false;
    for (let i = allMessageElements.length - 1; i >= 0; i--) {
        const el = allMessageElements[i];
        if (el.classList.contains(MESSAGE_CLASSES.USER)) {
            if (userMessageFound) break; 
            userMessageFound = true;
        }
        if(userMessageFound && el.classList.contains(MESSAGE_CLASSES.AI)) {
             el.remove();
        }
    }

    const messagesForRegeneration = messages.slice(0, lastUserMessageIndex + 1);
    chatHistory[currentChatId].messages = [...messagesForRegeneration]; 
    

    loadChat(currentChatId); 
    
    handleSendMessage(true, messagesForRegeneration);
    
    // --- FIX ENDS HERE ---
}
init();