/**
 * @name TextExpander
 * @author findert
 * @description Define your own commands (like ;gg) that get replaced by full sentences when you send a message, with an optional preview.
 * @version 1.1.0
 */

const DEFAULT_SETTINGS = {
    commands: [
        { trigger: ";gg", text: "GG, well played! See you next time 👋" },
        { trigger: ";shrug", text: "¯\\_(ツ)_/¯" }
    ],
    // "off" : remplacé à l'envoi sans aperçu, "live" : aperçu pendant la frappe, "confirm" : aperçu à valider avant l'envoi
    preview: "off"
};

const PREVIEW_MODES = [
    ["off", "No preview: commands are replaced when you send"],
    ["live", "Show a preview above the message bar while you type"],
    ["confirm", "Show a preview when you press Enter, press Enter again to send"]
];

const TYPING_EVENTS = ["input", "keyup", "paste", "compositionend", "focusin"];

const CSS = `
.te-panel { color: var(--text-normal); display: flex; flex-direction: column; gap: 12px; }
.te-row { display: flex; gap: 8px; align-items: flex-start; }
.te-panel input, .te-panel textarea {
    background: var(--background-tertiary, #1e1f22);
    color: var(--text-normal, #dbdee1);
    border: 1px solid var(--background-modifier-accent, #4e5058);
    border-radius: 4px; padding: 8px; font-family: inherit; font-size: 14px;
    user-select: text; pointer-events: auto;
}
.te-panel input:focus, .te-panel textarea:focus { outline: none; border-color: var(--brand-500, #5865f2); }
.te-trigger { width: 110px; }
.te-text { flex: 1; min-height: 36px; resize: vertical; }
.te-hint { color: var(--text-muted, #949ba4); font-size: 13px; }
.te-panel button {
    background: var(--brand-500, #5865f2); color: white;
    border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer;
}
.te-panel button.te-delete { background: var(--status-danger, #da373c); }
.te-field { display: flex; flex-direction: column; gap: 6px; }
.te-panel select {
    background: var(--background-tertiary, #1e1f22); color: var(--text-normal, #dbdee1);
    border: 1px solid var(--background-modifier-accent, #4e5058); border-radius: 4px; padding: 8px; font-size: 14px;
}
.te-preview {
    position: fixed; z-index: 1002; box-sizing: border-box; padding: 8px 12px; border-radius: 8px;
    background: var(--background-base-low, var(--background-secondary, #2b2d31)); color: var(--text-normal, #dbdee1);
    border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent);
    box-shadow: 0 8px 24px rgba(0,0,0,.45); font-size: 14px; line-height: 1.4; pointer-events: none;
}
.te-preview-title { display: flex; gap: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #949ba4); margin-bottom: 4px; }
.te-preview-title span:last-child { margin-left: auto; font-weight: 500; text-transform: none; }
.te-preview-text { white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow: hidden; }
.te-preview-text mark { background: color-mix(in srgb, var(--brand-500, #5865f2) 25%, transparent); color: inherit; border-radius: 3px; padding: 0 2px; }
`;

module.exports = class TextExpander {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), BdApi.Data.load(this.meta.name, "settings"));
        if (!PREVIEW_MODES.some(([mode]) => mode === this.settings.preview)) this.settings.preview = "off";
        this.buildMatcher();
        BdApi.DOM.addStyle(this.meta.name, CSS);

        // Module interne de Discord qui envoie et modifie les messages
        const MessageActions = BdApi.Webpack.getByKeys("sendMessage", "editMessage");
        if (!MessageActions) {
            BdApi.UI.showToast("TextExpander: message module not found", { type: "error" });
            return;
        }

        // sendMessage(channelId, message, ...) et editMessage(channelId, messageId, message)
        BdApi.Patcher.before(this.meta.name, MessageActions, "sendMessage", (_, args) => this.expandMessage(args[1]));
        BdApi.Patcher.before(this.meta.name, MessageActions, "editMessage", (_, args) => this.expandMessage(args[2]));

        // L'éditeur de Discord (Slate) annule souvent l'événement « input » :
        // on regarde aussi les touches relâchées, le collage et la fin de composition (accents)
        this.onTyping = e => this.queuePreview(e);
        this.onBlur = () => this.hidePreview();
        // Phase de capture : on passe avant Discord pour retenir le premier Entrée en mode « confirm »
        this.onKeyDown = e => this.handleKey(e);
        for (const type of TYPING_EVENTS) document.addEventListener(type, this.onTyping, true);
        document.addEventListener("focusout", this.onBlur, true);
        window.addEventListener("keydown", this.onKeyDown, true);
        window.addEventListener("resize", this.onTyping);
    }

    stop() {
        BdApi.Patcher.unpatchAll(this.meta.name);
        BdApi.DOM.removeStyle(this.meta.name);
        for (const type of TYPING_EVENTS) document.removeEventListener(type, this.onTyping, true);
        document.removeEventListener("focusout", this.onBlur, true);
        window.removeEventListener("keydown", this.onKeyDown, true);
        window.removeEventListener("resize", this.onTyping);
        cancelAnimationFrame(this.previewFrame);
        this.hidePreview();
    }

    // --- Remplacement ---

    // Construit une seule regex pour toutes les commandes. Une commande n'est remplacée que si
    // c'est un mot entier (entourée d'espaces ou en début/fin de message), et les plus longues
    // passent en premier pour que ";gg" ne coupe pas ";ggwp".
    buildMatcher() {
        this.replacements = new Map();
        for (const { trigger, text } of this.settings.commands) {
            if (trigger && !this.replacements.has(trigger)) this.replacements.set(trigger, text ?? "");
        }

        const triggers = [...this.replacements.keys()].sort((a, b) => b.length - a.length);
        this.matcher = triggers.length
            ? new RegExp(`(^|\\s)(${triggers.map(escapeRegex).join("|")})(?=\\s|$)`, "g")
            : null;
    }

    expandMessage(message) {
        if (!this.matcher || typeof message?.content !== "string") return;
        message.content = message.content.replace(
            this.matcher,
            (_, before, trigger) => before + this.replacements.get(trigger)
        );
    }

    // --- Aperçu ---

    // La zone de texte où l'on écrit : celle de Discord ou un simple textarea (ServerFeed, SideChats…)
    getComposer() {
        const active = document.activeElement;
        if (active?.matches?.("textarea") && !active.closest(".te-panel")) return { node: active, text: active.value };
        const node = active?.closest?.('[role="textbox"][contenteditable="true"]');
        // innerText montre les mentions et emojis comme à l'écran ; Slate ajoute des caractères invisibles
        return node ? { node, text: node.innerText.replace(/[\u200B\uFEFF]/g, "").replace(/\n$/, "") } : null;
    }

    // Le texte découpé en morceaux, les commandes remplacées par leur texte (surligné)
    previewParts(text) {
        if (!this.matcher) return [];
        const parts = [];
        let position = 0;
        for (const match of text.matchAll(this.matcher)) {
            const start = match.index + match[1].length;
            parts.push(document.createTextNode(text.slice(position, start)), el("mark", "", this.replacements.get(match[2])));
            position = start + match[2].length;
        }
        if (parts.length) parts.push(document.createTextNode(text.slice(position)));
        return parts;
    }

    handleKey(e) {
        if (this.settings.preview !== "confirm") return;
        const composer = this.getComposer();
        if (!composer) return;

        if (e.key === "Escape" && this.preview) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.hidePreview();
            return;
        }
        if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
        // Deuxième Entrée sur le même texte : on laisse Discord envoyer
        if (this.preview?.dataset.text === composer.text) {
            this.hidePreview();
            return;
        }
        const parts = this.previewParts(composer.text);
        if (!parts.length) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.showPreview(composer, parts, "Enter to send · Esc to edit");
    }

    queuePreview(e) {
        // En mode « confirm », l'aperçu reste tant que le texte ne change pas
        if (this.settings.preview === "confirm") {
            if (e?.type === "keyup" && ["Enter", "Escape", "Shift"].includes(e.key)) return;
            if (this.preview && this.getComposer()?.text !== this.preview.dataset.text) this.hidePreview();
            return;
        }
        cancelAnimationFrame(this.previewFrame);
        this.previewFrame = requestAnimationFrame(() => {
            const composer = this.settings.preview === "live" ? this.getComposer() : null;
            const parts = composer ? this.previewParts(composer.text) : [];
            if (parts.length) this.showPreview(composer, parts, "");
            else this.hidePreview();
        });
    }

    showPreview(composer, parts, hint) {
        if (!this.preview) {
            this.preview = el("div", "te-preview");
            const title = el("div", "te-preview-title");
            title.append(el("span", "", "Message preview"), el("span"));
            this.preview.append(title, el("div", "te-preview-text"));
            document.body.append(this.preview);
        }
        this.preview.dataset.text = composer.text;
        this.preview.firstChild.lastChild.textContent = hint;
        this.preview.lastChild.replaceChildren(...parts);

        // Juste au-dessus de la zone de texte
        const box = composer.node.closest('[class*="channelTextArea"]') ?? composer.node;
        const rect = box.getBoundingClientRect();
        this.preview.style.left = `${Math.max(8, rect.left)}px`;
        this.preview.style.width = `${Math.max(280, rect.width)}px`;
        this.preview.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    }

    hidePreview() {
        this.preview?.remove();
        this.preview = null;
    }

    // --- Paramètres ---

    saveSettings() {
        BdApi.Data.save(this.meta.name, "settings", this.settings);
        this.buildMatcher();
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "te-panel";
        this.renderPanel(panel);
        return panel;
    }

    renderPanel(panel) {
        panel.replaceChildren(el(
            "div", "te-hint",
            "Type a command as a separate word in your message: it gets replaced when you send it. Commands can't contain spaces."
        ));

        const mode = el("select");
        for (const [value, label] of PREVIEW_MODES) {
            const option = el("option", "", label);
            option.value = value;
            mode.append(option);
        }
        mode.value = this.settings.preview;
        mode.addEventListener("change", () => {
            this.settings.preview = mode.value;
            this.saveSettings();
            this.hidePreview();
        });
        const field = el("label", "te-field");
        field.append(el("span", "te-hint", "Preview"), mode);
        panel.append(field);

        this.settings.commands.forEach((command, i) => {
            const row = el("div", "te-row");

            const trigger = el("input", "te-trigger");
            trigger.placeholder = ";command";
            trigger.value = command.trigger ?? "";
            trigger.addEventListener("change", () => {
                command.trigger = trigger.value.replace(/\s+/g, "");
                trigger.value = command.trigger;
                this.saveSettings();
            });

            const text = el("textarea", "te-text");
            text.placeholder = "Text that replaces the command";
            text.rows = 1;
            text.value = command.text ?? "";
            text.addEventListener("change", () => {
                command.text = text.value;
                this.saveSettings();
            });

            const remove = el("button", "te-delete", "✕");
            remove.addEventListener("click", () => {
                this.settings.commands.splice(i, 1);
                this.saveSettings();
                this.renderPanel(panel);
            });

            row.append(trigger, text, remove);
            panel.append(row);
        });

        const add = el("button", "", "+ Add command");
        add.style.alignSelf = "flex-start";
        add.addEventListener("click", () => {
            this.settings.commands.push({ trigger: "", text: "" });
            this.saveSettings();
            this.renderPanel(panel);
        });
        panel.append(add);
    }
};

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}
