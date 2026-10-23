/**
 * @name TextExpander
 * @author findert
 * @description Define your own commands (like ;gg) that get replaced by full sentences when you send a message.
 * @version 1.0.0
 */

// Événements que Discord intercepte pour garder le focus dans ses paramètres
const GUARDED_EVENTS = [
    "keydown", "keypress", "keyup", "beforeinput", "paste",
    "mousedown", "pointerdown", "focusin", "focusout"
];

const DEFAULT_SETTINGS = {
    commands: [
        { trigger: ";gg", text: "GG, well played! See you next time 👋" },
        { trigger: ";shrug", text: "¯\\_(ツ)_/¯" }
    ]
};

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
`;

module.exports = class TextExpander {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        // Le focus-lock des paramètres Discord renvoie le focus vers la recherche des plugins.
        // On intercepte ses événements dès la phase de capture sur window, avant ses listeners.
        // Pour focusout, la cible est l'élément qui perd le focus : on regarde donc relatedTarget.
        this.eventGuard = e => {
            const node = e.type === "focusout" ? e.relatedTarget : e.target;
            if (node?.closest?.(".te-panel")) e.stopImmediatePropagation();
        };
        for (const type of GUARDED_EVENTS) window.addEventListener(type, this.eventGuard, true);

        this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), BdApi.Data.load(this.meta.name, "settings"));
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
    }

    stop() {
        BdApi.Patcher.unpatchAll(this.meta.name);
        BdApi.DOM.removeStyle(this.meta.name);
        for (const type of GUARDED_EVENTS) window.removeEventListener(type, this.eventGuard, true);
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

    // --- Paramètres ---

    saveSettings() {
        BdApi.Data.save(this.meta.name, "settings", this.settings);
        this.buildMatcher();
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "te-panel";
        // Le focus-lock des paramètres Discord renvoie le focus vers la recherche des plugins :
        // cet attribut indique à react-focus-lock d'ignorer cette zone
        panel.setAttribute("data-no-focus-lock", "true");
        this.renderPanel(panel);
        return panel;
    }

    renderPanel(panel) {
        panel.replaceChildren(el(
            "div", "te-hint",
            "Type a command as a separate word in your message: it gets replaced when you send it. Commands can't contain spaces."
        ));

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
