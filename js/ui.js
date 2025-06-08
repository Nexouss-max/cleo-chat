import * as dom from './dom.js';
import { THEMES, MESSAGE_CLASSES, appConfig } from './config.js';
import { handleSendMessage } from './api.js';
import { speak } from './features.js';

let currentTheme = "light";
let typingIndicatorElement = null;

export function applyTheme(themeName) {
    document.body.className = '';
    document.documentElement.className = themeName;

    if (themeName === 'dark') document.body.classList.add('dark-mode');
    else if (themeName === 'mint') document.body.classList.add('theme-mint');
    else if (themeName === 'pink') document.body.classList.add('theme-pink');
    
    localStorage.setItem("cleoTheme", themeName);
    currentTheme = themeName;
    populateThemeDropdown();
}

export function populateThemeDropdown() {
    dom.themeDropdown.innerHTML = '';
    THEMES.forEach(theme => {
        const option = document.createElement('div');
        option.classList.add('theme-option');
        if (theme === currentTheme) {
            option.classList.add('active');
        }
        option.dataset.theme = theme;
        option.innerHTML = `<i class="fas fa-check"></i> ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
        option.addEventListener('click', () => {
            applyTheme(theme);
            dom.themeDropdown.style.display = 'none';
        });
        dom.themeDropdown.appendChild(option);
    });
}

export function autoResizeTextarea() {
    dom.userInput.style.height = "auto";
    dom.userInput.style.height = dom.userInput.scrollHeight + "px";
}

export function displayPendingFilePreview(file, data) {
    let previewHTML = '';
    if (file.type.startsWith('image/')) {
        previewHTML = `<div class="file-preview-item"><img src="${data}" alt="${file.name}"/> <span>${file.name}</span></div>`;
    } else {
        previewHTML = `<div class="file-preview-item"><i class="fas fa-file-alt"></i> <span>${file.name}</span></div>`;
    }
    dom.pendingFilePreviewContainer.innerHTML = previewHTML;
    dom.pendingFilePreviewContainer.style.display = "block";
}

export function clearPendingFilePreview() {
    dom.pendingFilePreviewContainer.innerHTML = "";
    dom.pendingFilePreviewContainer.style.display = "none";
    dom.fileUploadInput.value = "";
}

export function setGeneratingState(isGenerating) {
    if (isGenerating) {
        dom.regenerateResponseButton.style.display = "none";
        dom.stopResponseButton.style.display = "inline-block";
        dom.sendButton.disabled = true;
        dom.userInput.disabled = true;
    } else {
        dom.regenerateResponseButton.style.display = "inline-block";
        dom.stopResponseButton.style.display = "none";
        dom.sendButton.disabled = !appConfig.apiKey;
        dom.userInput.disabled = false;
    }
}

export function createTypingIndicatorElement() {
    if (!typingIndicatorElement) {
        typingIndicatorElement = document.createElement("div");
        typingIndicatorElement.classList.add("typing-indicator");
        typingIndicatorElement.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
        typingIndicatorElement.style.display = "none";
        dom.messagesContainer.appendChild(typingIndicatorElement);
    }
}

export function showTypingIndicator() {
    removeIntroMessage();
    if (typingIndicatorElement) {
        typingIndicatorElement.style.display = "flex";
        dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
    }
}

export function hideTypingIndicator() {
    if (typingIndicatorElement) {
        typingIndicatorElement.style.display = "none";
    }
}

export function displayIntroMessage() {
    dom.messagesContainer.innerHTML = `
      <div class="intro-message">
        <h1>Meet CLEO ✨</h1>
        <p>Your personal AI skincare consultant is here to help! I can analyze your skin concerns, recommend products, create routines, and answer all your beauty questions.</p>
        <div class="suggestion-chips">
            <button class="suggestion-chip">🧴 Recommend a routine for dry skin</button>
            <button class="suggestion-chip">🌟 Best ingredients for anti-aging</button>
            <button class="suggestion-chip">💧 Help with acne-prone skin</button>
            <button class="suggestion-chip">☀️ Daily sun protection tips</button>
        </div>
      </div>`;
    if(typingIndicatorElement) dom.messagesContainer.appendChild(typingIndicatorElement);
    dom.messagesContainer.querySelectorAll(".suggestion-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            dom.userInput.value = chip.textContent;
            handleSendMessage(false);
        });
    });
    dom.currentChatTitle.textContent = "New Skincare Consultation";
}

export function removeIntroMessage() {
    const introMessage = dom.messagesContainer.querySelector(".intro-message");
    if (introMessage) introMessage.remove();
}

function getStableRendering(text) {
    let parts = text.split("```");
    if (parts.length % 2 === 1) {
        return marked.parse(text);
    } else {
        let closedPart = parts.slice(0, parts.length - 1).join("```");
        let openPart = parts[parts.length - 1];
        return marked.parse(closedPart) + marked.parse("```\n" + openPart + "\n```");
    }
}

export function typeMessage(element, textChunk) {
    if (!element.dataset.rawMarkdown) {
        element.dataset.rawMarkdown = "";
    }
    element.dataset.rawMarkdown += textChunk;
    element.innerHTML = getStableRendering(element.dataset.rawMarkdown);
    dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
}

export function addMessage(cssClass, text, base64ImageData = null, isEmptyStreamMessage = false) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", cssClass);

    if (cssClass === MESSAGE_CLASSES.AI) {
        const avatarDiv = document.createElement("div");
        avatarDiv.classList.add("ai-avatar");
        const avatarIcon = document.createElement("i");
        avatarIcon.classList.add("fas", "fa-spa");
        avatarDiv.appendChild(avatarIcon);
        messageDiv.appendChild(avatarDiv);
    }
    
    const contentDiv = document.createElement("div");
    contentDiv.classList.add("message-content");
    
    const innerContentDiv = document.createElement("div");
    innerContentDiv.classList.add("message-content-inner");

    if (cssClass === MESSAGE_CLASSES.USER && base64ImageData) {
        const img = document.createElement("img");
        img.src = base64ImageData;
        img.alt = "User upload";
        img.style.maxWidth = "200px"; img.style.maxHeight = "200px";
        img.style.borderRadius = "8px"; img.style.marginBottom = "10px";
        contentDiv.appendChild(img);
    }

    if (text || (isEmptyStreamMessage && cssClass === MESSAGE_CLASSES.AI)) {
        if (cssClass === MESSAGE_CLASSES.AI) {
            innerContentDiv.innerHTML = isEmptyStreamMessage ? "" : getStableRendering(text);
            innerContentDiv.dataset.rawMarkdown = isEmptyStreamMessage ? "" : text;
        } else {
            innerContentDiv.innerHTML = marked.parse(text);
        }
    }
    contentDiv.appendChild(innerContentDiv);
    messageDiv.appendChild(contentDiv);

    if (cssClass === MESSAGE_CLASSES.AI && text) {
        const ttsButton = document.createElement("button");
        ttsButton.className = "tts-button";
        ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        ttsButton.title = "Read aloud";
        ttsButton.addEventListener("click", () => speak(text, ttsButton));
        contentDiv.appendChild(ttsButton);
    }

    dom.messagesContainer.appendChild(messageDiv);
    dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
    
    if (cssClass === MESSAGE_CLASSES.AI && !isEmptyStreamMessage && text) {
        hljs.highlightAllUnder(innerContentDiv);
        updateCodeCopyButtons(messageDiv);
    }
    return messageDiv;
}

export function updateCodeCopyButtons(container = document) {
    const codeBlocks = container.querySelectorAll("pre");
    codeBlocks.forEach((pre) => {
        if (pre.querySelector('.code-copy-container')) return;
        const code = pre.querySelector('code');
        if (!code) return;
        const copyContainer = document.createElement("div");
        copyContainer.className = "code-copy-container";
        const button = document.createElement("button");
        button.className = "code-copy-button";
        button.innerHTML = '<i class="fas fa-copy"></i>'; button.title = "Copy code";
        button.addEventListener("click", () => {
            navigator.clipboard.writeText(code.innerText).then(() => {
                button.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => { button.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
            });
        });
        copyContainer.appendChild(button);
        pre.style.position = "relative";
        pre.insertBefore(copyContainer, pre.firstChild);
    });
}