import * as dom from './dom.js';
import { appConfig, API_ENDPOINT, ROLES, MESSAGE_CLASSES, CONTENT_TYPES } from './config.js';
import { 
    addMessage, 
    showTypingIndicator, 
    hideTypingIndicator, 
    setGeneratingState, 
    removeIntroMessage,
    autoResizeTextarea,
    clearPendingFilePreview,
    displayPendingFilePreview,
    typeMessage,
    updateCodeCopyButtons
} from './ui.js';
import { 
    chatHistory, 
    currentChatId, 
    saveChatHistory, 
    updateChatHistoryItemTitle,
    setCurrentAbortController
} from './chat.js';


let currentAbortController = null;
let stopGeneration = false;

let pendingFile = null;
let pendingFileBase64 = null;
let pendingFileText = null;

export function stopCurrentGeneration() {
    if (currentAbortController) {
        currentAbortController.abort();
    }
    stopGeneration = true;
    setGeneratingState(false);
}

export async function processPendingFile(file) {
    clearPendingFilePreview(); // from ui.js
    pendingFile = file;
    const reader = new FileReader();

    reader.onload = (e) => {
        if (file.type.startsWith('image/')) {
            pendingFileBase64 = e.target.result;
            displayPendingFilePreview(file, pendingFileBase64); // from ui.js
        } else if (file.type.startsWith('text/') || file.name.endsWith('.js') || file.name.endsWith('.py') || file.name.endsWith('.css') || file.name.endsWith('.json') || file.name.endsWith('.md')) {
            pendingFileText = e.target.result;
            displayPendingFilePreview(file, null); // from ui.js
        } else {
            alert("Unsupported file type. Please upload an image or a text-based file.");
            clearPendingFilePreview(); // from ui.js
            pendingFile = null;
        }
    };
    
    reader.onerror = () => {
        alert("Error reading file.");
        clearPendingFilePreview();
        pendingFile = null;
    };

    if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsText(file);
    }
}


export async function handleSendMessage(isRegeneration = false, messagesForRegen = null) {
    if (!appConfig.apiKey) {
        alert("Please set your API key in the settings first.");
        dom.settingsModal.style.display = "flex";
        return;
    }

    const userInputText = dom.userInput.value.trim();
    if (!isRegeneration && !userInputText && !pendingFile) {
        return;
    }

    setGeneratingState(true);
    stopGeneration = false;
    removeIntroMessage();

    if (!isRegeneration) {
        processUserMessageInput(userInputText);
    }
    
    const currentMessageHistory = messagesForRegen || (chatHistory[currentChatId] ? [...chatHistory[currentChatId].messages] : []);
    
    dom.userInput.value = "";
    autoResizeTextarea();
    if (!isRegeneration) {
        clearPendingFilePreview();
        pendingFile = null;
        pendingFileBase64 = null;
        pendingFileText = null;
    };

    showTypingIndicator();
    const apiMessages = prepareApiMessages(currentMessageHistory);
    currentAbortController = new AbortController();
    setCurrentAbortController(currentAbortController);

    try {
        await streamAndProcessApiResponse(apiMessages, currentMessageHistory, isRegeneration);
    } catch (error) {
        hideTypingIndicator(); 
        handleApiError(error);
    } finally {
        setGeneratingState(false);
        stopGeneration = false;
        currentAbortController = null;
        setCurrentAbortController(null);
        dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
    }
}

function processUserMessageInput(text) {
    let messageText = text;
    if (pendingFileText) {
        messageText = `File Content: "${pendingFile.name}"\n\n\`\`\`\n${pendingFileText}\n\`\`\`\n\n${text}`;
    }

    const imageForMessage = pendingFileBase64;
    addMessage(MESSAGE_CLASSES.USER, messageText, imageForMessage);

    if (chatHistory[currentChatId]) {
        const historyUserContent = [];
        if (messageText) {
            historyUserContent.push({ type: CONTENT_TYPES.TEXT, text: messageText });
        }
        if (imageForMessage && pendingFile.type.startsWith("image/")) {
            historyUserContent.push({
                type: CONTENT_TYPES.IMAGE_URL,
                image_url: { url: imageForMessage },
            });
        }
        chatHistory[currentChatId].messages.push({ 
            role: ROLES.USER, 
            content: historyUserContent.length > 1 ? historyUserContent : (messageText || "") 
        });
    }
}

function prepareApiMessages(messageHistory) {
    const fullSystemPrompt = (appConfig.userProfile ? `---START USER PROFILE---\n${appConfig.userProfile}\n---END USER PROFILE---\n\n` : '') + appConfig.systemPrompt;
    
    const systemPromptMessage = {
        role: ROLES.SYSTEM,
        content: fullSystemPrompt
    };
    
    return [systemPromptMessage, ...messageHistory.map(msg => ({
        role: msg.role,
        content: msg.content
    }))];
}

async function streamAndProcessApiResponse(apiMessages, currentMessageHistory, isRegeneration) {
    const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${appConfig.apiKey}` },
        body: JSON.stringify({ model: appConfig.model, messages: apiMessages, stream: true }),
        signal: currentAbortController.signal,
    });

    hideTypingIndicator();

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage = errorData.error ? errorData.error.message : (errorData.message || "Failed to get response.");
        addMessage(MESSAGE_CLASSES.AI, `**Error:** ${errorMessage}`);
        return;
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiResponseContent = "";
    let aiMessageDiv = addMessage(MESSAGE_CLASSES.AI, "", null, true);
    const aiContentInnerDiv = aiMessageDiv.querySelector('.message-content-inner');
    if (aiContentInnerDiv) aiContentInnerDiv.dataset.rawMarkdown = "";

    while (true) {
        if (stopGeneration) break;
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const jsonData = line.substring(6);
                if (jsonData.trim() === "[DONE]") {
                    stopGeneration = true; break;
                }
                try {
                    const parsed = JSON.parse(jsonData);
                    if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                        const deltaContent = parsed.choices[0].delta.content;
                        aiResponseContent += deltaContent;
                        if (aiContentInnerDiv) typeMessage(aiContentInnerDiv, deltaContent);
                    }
                } catch (e) { /* Ignore parsing errors */ }
            }
        }
        if (stopGeneration) break;
    }
    
    if (aiContentInnerDiv) {
        aiContentInnerDiv.innerHTML = marked.parse(aiResponseContent);
        hljs.highlightAllUnder(aiContentInnerDiv);
        updateCodeCopyButtons(aiMessageDiv);
    }

    if (chatHistory[currentChatId]) {
        if (isRegeneration) {
            // Remove previous AI message before adding new one
            const lastMsgIndex = chatHistory[currentChatId].messages.length - 1;
            if(lastMsgIndex >= 0 && chatHistory[currentChatId].messages[lastMsgIndex].role === ROLES.AI) {
                chatHistory[currentChatId].messages.pop();
            }
        }
        chatHistory[currentChatId].messages.push({ role: ROLES.AI, content: aiResponseContent });
    }
    saveChatHistory();
    
    const isFirstMeaningfulExchange = currentMessageHistory.filter(m => m.role === ROLES.USER || m.role === ROLES.AI).length < 2;
    if (isFirstMeaningfulExchange || (isRegeneration && currentMessageHistory.length <= 2)) {
        updateChatHistoryItemTitle(currentChatId, aiResponseContent);
    }
}

function handleApiError(error) {
    if (error.name === 'AbortError') {
        addMessage(MESSAGE_CLASSES.AI, "Response generation was stopped.");
    } else {
        console.error("Fetch API Error:", error);
        addMessage(MESSAGE_CLASSES.AI, "Oops! There was an error connecting to the API. Please check your settings and network.");
    }
}