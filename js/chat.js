import * as dom from './dom.js';
import { displayIntroMessage, addMessage, autoResizeTextarea, clearPendingFilePreview, setGeneratingState } from './ui.js';
import { ROLES, MESSAGE_CLASSES, CONTENT_TYPES, appConfig } from './config.js';

export let chatHistory = {};
export let currentChatId = null;
let currentAbortController = null; // Used to stop generation when switching chats

export function setCurrentAbortController(controller) {
    currentAbortController = controller;
}

export function loadHistoryAndTheme() {
    chatHistory = JSON.parse(localStorage.getItem("cleoHistory")) || {};
    const currentTheme = localStorage.getItem("cleoTheme") || "light";
    // The actual applyTheme call is in main.js's init
    return currentTheme; 
}

export function loadInitialChatState() {
    updateChatHistorySidebar();
    // Only close the sidebar by default on mobile screens
    if (window.innerWidth <= 768) {
        dom.sidebar.classList.add("collapsed");
    }
    if (Object.keys(chatHistory).length === 0) {
        createNewChat();
    } else {
        const mostRecentChatId = Object.keys(chatHistory).sort((a, b) => chatHistory[b].timestamp - chatHistory[a].timestamp)[0];
        loadChat(mostRecentChatId);
    }
}

export function createNewChat() {
    if (currentAbortController) { currentAbortController.abort(); }
    setGeneratingState(false);
    currentChatId = `chat_${new Date().getTime()}`;
    chatHistory[currentChatId] = {
        id: currentChatId, title: "New Consultation",
        messages: [], timestamp: new Date().getTime(),
    };
    saveChatHistory();
    loadChat(currentChatId);
    updateChatHistorySidebar();
}

export function loadChat(chatId) {
    if (!chatHistory[chatId]) {
        createNewChat(); return;
    }
    if (currentAbortController) { currentAbortController.abort(); }
    setGeneratingState(false);
    currentChatId = chatId;
    dom.messagesContainer.innerHTML = "";
    // Re-add the typing indicator to the cleared container
    const typingIndicator = document.querySelector('.typing-indicator');
    if(typingIndicator) dom.messagesContainer.appendChild(typingIndicator);

    const chat = chatHistory[chatId];
    dom.currentChatTitle.textContent = chat.title;
    if (chat.messages.length === 0) {
        displayIntroMessage();
    } else {
        chat.messages.forEach(msg => {
            let textContent = ''; let imageContent = null;
            let messageClass = msg.role === ROLES.USER ? MESSAGE_CLASSES.USER : MESSAGE_CLASSES.AI;
            if (typeof msg.content === 'string') {
                textContent = msg.content;
            } else if (Array.isArray(msg.content)) {
                textContent = msg.content.find(p => p.type === CONTENT_TYPES.TEXT)?.text || '';
                imageContent = msg.content.find(p => p.type === CONTENT_TYPES.IMAGE_URL)?.image_url.url || null;
            }
            addMessage(messageClass, textContent, imageContent);
        });
    }
    dom.userInput.value = ""; autoResizeTextarea();
    clearPendingFilePreview();
    updateChatHistorySidebar(dom.searchHistoryInput.value);
    dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
    if (window.innerWidth <= 768) {
        dom.sidebar.classList.add("collapsed");
        dom.sidebarOverlay.classList.remove("active");
    }
}

export function updateChatHistoryItemTitle(chatId, firstAiResponse) {
    if (chatHistory[chatId] && firstAiResponse) {
        const newTitle = firstAiResponse.substring(0, 40) + (firstAiResponse.length > 40 ? "..." : "");
        chatHistory[chatId].title = newTitle.trim();
        saveChatHistory();
        updateChatHistorySidebar(dom.searchHistoryInput.value);
        if (chatId === currentChatId) {
            dom.currentChatTitle.textContent = newTitle.trim();
        }
    }
}

export function saveChatHistory() {
    if (chatHistory[currentChatId]) {
        chatHistory[currentChatId].timestamp = new Date().getTime();
    }
    localStorage.setItem("cleoHistory", JSON.stringify(chatHistory));
}

function addChatHistoryItemWithOptions(chat) {
    const itemContainer = document.createElement("div");
    itemContainer.classList.add("chat-history-item-container");
    itemContainer.dataset.chatId = chat.id;
    if (chat.id === currentChatId) {
        itemContainer.classList.add("active");
    }

    const item = document.createElement("div");
    item.classList.add("chat-history-item");
    item.addEventListener("click", () => loadChat(chat.id));
    
    const icon = document.createElement("i");
    icon.classList.add("fas", "fa-comments");
    
    const titleSpan = document.createElement("span");
    titleSpan.textContent = chat.title || "Chat Session";
    titleSpan.title = chat.title || "Chat Session";
    
    item.appendChild(icon);
    item.appendChild(titleSpan);

    const actionsContainer = document.createElement("div");
    actionsContainer.classList.add("chat-history-item-actions");

    const renameButton = document.createElement("button");
    renameButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    renameButton.title = "Rename";
    renameButton.classList.add("chat-history-action-button");
    renameButton.addEventListener("click", (e) => {
        e.stopPropagation();
        renameChat(chat.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.title = "Delete";
    deleteButton.classList.add("chat-history-action-button", "delete");
    deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
    });
    
    actionsContainer.appendChild(renameButton);
    actionsContainer.appendChild(deleteButton);
    itemContainer.appendChild(item);
    itemContainer.appendChild(actionsContainer);
    dom.chatHistoryContainer.appendChild(itemContainer);
}

export function updateChatHistorySidebar(searchTerm = "") {
    dom.chatHistoryContainer.innerHTML = "";
    const filteredChats = Object.values(chatHistory).filter(chat => 
        chat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const sortedChats = filteredChats.sort((a, b) => b.timestamp - a.timestamp);

    if (sortedChats.length === 0) {
        dom.chatHistoryContainer.innerHTML = "<p style='color: var(--text-secondary); font-size: 13px; text-align: center; padding: 10px;'>No matching sessions.</p>";
        return;
    }
    sortedChats.forEach(addChatHistoryItemWithOptions);
}

function renameChat(chatId) {
    const newTitle = prompt("Enter new name for this consultation:", chatHistory[chatId].title);
    if (newTitle && newTitle.trim() !== "") {
        chatHistory[chatId].title = newTitle.trim();
        saveChatHistory(); 
        updateChatHistorySidebar(dom.searchHistoryInput.value);
        if (chatId === currentChatId) dom.currentChatTitle.textContent = newTitle.trim();
    }
}

function deleteChat(chatId) {
    if (confirm(`Are you sure you want to delete "${chatHistory[chatId].title}"?`)) {
        delete chatHistory[chatId];
        saveChatHistory();
        if (chatId === currentChatId) {
            const remainingChats = Object.keys(chatHistory);
            if (remainingChats.length > 0) {
                loadChat(Object.keys(chatHistory).sort((a,b) => chatHistory[b].timestamp - chatHistory[a].timestamp)[0]);
            } else { createNewChat(); }
        }
        updateChatHistorySidebar(dom.searchHistoryInput.value);
    }
}

export function clearAllHistory() {
    if (confirm("Are you sure you want to clear all consultation history? This cannot be undone.")) {
        chatHistory = {}; saveChatHistory();
        createNewChat(); updateChatHistorySidebar();
    }
}

export function exportCurrentChat() {
    if (!currentChatId || !chatHistory[currentChatId]) {
        alert("No active consultation to export."); return;
    }
    const chat = chatHistory[currentChatId];
    let chatContent = `Title: ${chat.title}\nDate: ${new Date(chat.timestamp).toLocaleString()}\nModel: ${appConfig.model}\n\n`;
    chat.messages.forEach(msg => {
        const sender = msg.role === ROLES.USER ? "You" : "AI";
        let messageText = "";
        if (typeof msg.content === 'string') {
            messageText = msg.content;
        } else if (Array.isArray(msg.content)) {
            msg.content.forEach(part => {
                if (part.type === CONTENT_TYPES.TEXT) messageText += part.text + "\n";
                if (part.type === CONTENT_TYPES.IMAGE_URL) messageText += "[Image Uploaded]\n";
            });
        }
        chatContent += `${sender}:\n${messageText.trim()}\n\n------------------------------------\n\n`;
    });

    const blob = new Blob([chatContent], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${chat.title.replace(/\s+/g, '_')}.txt`;
    link.click(); URL.revokeObjectURL(link.href);
}