/**
 * @name TextExpanderEnhanced
 * @author findert
 * @description Message templates with blanks to fill in: type a command (like ;event), fill in a small form with a live preview, and the finished message is put in your message bar.
 * @version 1.0.1
 */

const DEFAULT_SETTINGS = {
    button: true,
    templates: [
        { name: "Event", trigger: ";event", text: "📅 **{Title}**\n🗓️ {Date} at {Time}\n📝 {Details}\nReact ✅ if you're in!" }
    ]
};

// Les modèles d'exemple de la 1.0.0 utilisaient une syntaxe qui n'existe plus : on les remplace s'ils n'ont pas été modifiés
const OLD_DEFAULT_TEXTS = [
    "📅 **{Title}**\n🗓️ {Date={tomorrow}} at {Time=21:00}\n🎮 Activity: {Activity:Mining|Bounty hunting|Cargo|Exploration|PvP}\n📝 {Details#?}\nReact ✅ if you're in!",
    "**Bug:** {Summary}\n**Steps to reproduce:**\n{Steps#}\n**Expected:** {Expected?}\n**Severity:** {Severity:Low|Medium|High|Critical}",
    "Welcome to {server}, {Name}! 👋 Take a look at the rules and say hi here 🙂"
];

const BLANK = /\{([^{}\n]+)\}/g;

const CSS = `
.tee-button {
    display: flex; align-items: center; justify-content: center; align-self: center; width: 32px; height: 32px; flex: none;
    padding: 0; border: none; border-radius: 4px; background: none; cursor: pointer; color: var(--interactive-normal, #b5bac1);
}
.tee-button:hover { color: var(--interactive-hover, #dbdee1); }

.tee-popup {
    position: fixed; z-index: 1002; box-sizing: border-box; padding: 12px; border-radius: 8px;
    background: var(--background-base-low, var(--background-secondary, #2b2d31)); color: var(--text-normal, #dbdee1);
    border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent);
    box-shadow: 0 8px 24px rgba(0,0,0,.45); font-size: 14px; line-height: 1.4;
    display: flex; flex-direction: column; gap: 10px; max-height: 70vh; overflow-y: auto;
}
.tee-title { display: flex; gap: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #949ba4); }
.tee-title span:last-child { margin-left: auto; font-weight: 500; text-transform: none; }
.tee-fields { display: grid; grid-template-columns: max-content 1fr; gap: 8px 12px; align-items: start; }
.tee-fields label { color: var(--text-muted, #949ba4); font-size: 13px; font-weight: 600; padding-top: 7px; }
.tee-popup textarea, .tee-panel input, .tee-panel textarea {
    box-sizing: border-box; width: 100%;
    background: var(--background-tertiary, #1e1f22); color: var(--text-normal, #dbdee1);
    border: 1px solid var(--background-modifier-accent, #4e5058); border-radius: 4px;
    padding: 7px 8px; font-family: inherit; font-size: 14px; user-select: text;
}
.tee-popup textarea { resize: none; overflow: hidden; line-height: 1.4; }
.tee-popup textarea:focus, .tee-panel input:focus, .tee-panel textarea:focus { outline: none; border-color: var(--brand-500, #5865f2); }
.tee-preview {
    white-space: pre-wrap; word-break: break-word; max-height: 180px; overflow-y: auto;
    padding: 8px; border-radius: 4px; background: var(--background-tertiary, #1e1f22);
}
.tee-preview mark { background: color-mix(in srgb, var(--brand-500, #5865f2) 25%, transparent); color: inherit; border-radius: 3px; padding: 0 2px; }
.tee-preview .tee-blank { color: var(--text-muted, #949ba4); font-style: italic; }
.tee-actions { display: flex; align-items: center; gap: 8px; }
.tee-hint { color: var(--text-muted, #949ba4); font-size: 12px; margin-right: auto; }
.tee-popup button, .tee-panel button {
    border: none; border-radius: 4px; padding: 7px 12px; cursor: pointer; font-size: 14px;
    background: var(--brand-500, #5865f2); color: white;
}
.tee-popup button.tee-secondary { background: var(--background-modifier-accent, #4e5058); }

.tee-menu { padding: 6px; gap: 2px; min-width: 220px; }
.tee-menu-item { display: flex; gap: 12px; padding: 7px 10px; border-radius: 4px; cursor: pointer; }
.tee-menu-item:hover { background: var(--background-modifier-hover, rgba(78,80,88,.3)); }
.tee-menu-item span:last-child { margin-left: auto; color: var(--text-muted, #949ba4); font-family: var(--font-code, monospace); font-size: 13px; }
.tee-menu-empty { padding: 7px 10px; color: var(--text-muted, #949ba4); }

.tee-panel { color: var(--text-normal, #dbdee1); display: flex; flex-direction: column; gap: 14px; }
.tee-help { color: var(--text-muted, #949ba4); font-size: 13px; line-height: 1.5; }
.tee-help code, .tee-detected code { color: var(--text-normal, #dbdee1); }
.tee-template { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 6px; background: var(--background-secondary, #2b2d31); }
.tee-row { display: flex; gap: 8px; }
.tee-row .tee-name { flex: 1; }
.tee-row .tee-trigger { width: 120px; }
.tee-template textarea { min-height: 90px; resize: vertical; font-family: var(--font-code, monospace); font-size: 13px; }
.tee-detected { color: var(--text-muted, #949ba4); font-size: 12px; }
.tee-panel button.tee-delete { background: var(--status-danger, #da373c); }
.tee-check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
`;

module.exports = class TextExpanderEnhanced {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), BdApi.Data.load(this.meta.name, "settings"));
        const kept = this.settings.templates.filter(template => !OLD_DEFAULT_TEXTS.includes(template.text));
        if (kept.length !== this.settings.templates.length) {
            this.settings.templates = kept.length ? kept : structuredClone(DEFAULT_SETTINGS.templates);
            this.saveSettings();
        }
        this.indexTemplates();
        BdApi.DOM.addStyle(this.meta.name, CSS);

        const { Webpack } = BdApi;
        // Ce que Discord utilise pour écrire dans la zone de message (dernier recours)
        this.componentDispatch = Webpack.getModule(m => typeof m?.dispatchToLastSubscribed === "function" && m.emitter, { searchExports: true });

        // Phase de capture : on passe avant Discord (sinon Entrée enverrait le message)
        this.onKeyDown = e => this.handleKey(e);
        this.onMouseDown = e => {
            if (this.popup && !this.popup.node.contains(e.target) && !e.target.closest?.(".tee-button")) this.closePopup(false);
        };
        window.addEventListener("keydown", this.onKeyDown, true);
        document.addEventListener("mousedown", this.onMouseDown, true);

        // Le bouton dans la barre de message : Discord recrée la barre souvent, on le remet à chaque fois
        this.observer = new MutationObserver(() => {
            if (this.injectQueued) return;
            this.injectQueued = true;
            requestAnimationFrame(() => {
                this.injectQueued = false;
                this.injectButtons();
            });
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.injectButtons();
    }

    stop() {
        window.removeEventListener("keydown", this.onKeyDown, true);
        document.removeEventListener("mousedown", this.onMouseDown, true);
        this.observer?.disconnect();
        this.closePopup(false);
        document.querySelectorAll(".tee-button").forEach(button => button.remove());
        BdApi.DOM.removeStyle(this.meta.name);
    }

    indexTemplates() {
        this.byTrigger = new Map();
        for (const template of this.settings.templates) {
            if (template.trigger && !this.byTrigger.has(template.trigger)) this.byTrigger.set(template.trigger, template);
        }
    }

    // --- Déclencheur ---

    // Tab ou Entrée juste après une commande (en fin de message) ouvre le formulaire de son modèle
    handleKey(e) {
        if (this.popup?.node.contains(e.target)) return;
        if (this.popup && e.key === "Escape") {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.closePopup(true);
            return;
        }
        if ((e.key !== "Enter" && e.key !== "Tab") || e.shiftKey || e.ctrlKey || e.altKey || e.isComposing) return;

        const composer = this.getComposer();
        if (!composer) return;
        const text = this.readText(composer);
        const match = text.match(/(^|\s)(\S+)\s*$/);
        const template = match && this.byTrigger.get(match[2]);
        if (!template) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        this.openForm(composer, text.slice(0, match.index + match[1].length), template);
    }

    // --- Bouton et menu ---

    injectButtons() {
        if (!this.settings.button) {
            document.querySelectorAll(".tee-button").forEach(button => button.remove());
            return;
        }
        for (const area of document.querySelectorAll('[class*="channelTextArea"]')) {
            const buttons = area.querySelector('[class*="buttons"]');
            const textbox = area.querySelector('[role="textbox"][contenteditable="true"]');
            if (!buttons || !textbox || buttons.querySelector(".tee-button")) continue;

            const button = el("button", "tee-button");
            button.type = "button";
            button.title = "Message templates";
            // Icône « document à remplir » (Material Icons)
            button.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
            // mousedown : la zone de texte garde le focus et le curseur
            button.addEventListener("mousedown", e => e.preventDefault());
            button.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                if (this.popup?.kind === "menu") return this.closePopup(false);
                const node = area.querySelector('[role="textbox"][contenteditable="true"]');
                if (node) this.openMenu({ kind: "slate", node });
            });
            buttons.prepend(button);
        }
    }

    openMenu(composer) {
        const node = el("div", "tee-popup tee-menu");
        const templates = this.settings.templates.filter(template => template.text?.trim());
        if (!templates.length) node.append(el("div", "tee-menu-empty", "No templates yet: add some in the plugin settings"));
        for (const template of templates) {
            const item = el("div", "tee-menu-item");
            item.append(el("span", "", template.name || "Untitled"), el("span", "", template.trigger || ""));
            item.addEventListener("click", () => this.openForm(composer, this.readText(composer), template));
            node.append(item);
        }
        this.showPopup("menu", node, composer);
    }

    // --- Formulaire ---

    openForm(composer, prefix, template) {
        const text = template.text ?? "";
        const fields = blanksOf(text);

        // Rien à remplir : on insère directement
        if (!fields.length) {
            this.closePopup(false);
            this.writeText(composer, prefix + text);
            return;
        }

        const node = el("div", "tee-popup");
        const title = el("div", "tee-title");
        title.append(el("span", "", template.name || "Template"), el("span", "", template.trigger || ""));

        const grid = el("div", "tee-fields");
        const values = {};
        const inputs = [];
        const preview = el("div", "tee-preview");
        const updatePreview = () => preview.replaceChildren(...renderTemplate(text, values));

        fields.forEach((name, index) => {
            const label = el("label", "", name);
            label.htmlFor = `tee-field-${index}`;
            // Une seule ligne au départ, qui s'agrandit avec Maj+Entrée
            const input = el("textarea");
            input.id = label.htmlFor;
            input.rows = 1;
            input.placeholder = name;
            values[name] = "";
            const fit = () => {
                input.style.height = "auto";
                input.style.height = `${input.scrollHeight + 2}px`;
            };
            input.addEventListener("input", () => {
                values[name] = input.value;
                fit();
                updatePreview();
            });
            inputs.push(input);
            grid.append(label, input);
        });

        const submit = () => {
            const message = prefix + fillTemplate(text, values);
            this.closePopup(false);
            this.writeText(composer, message);
        };

        const actions = el("div", "tee-actions");
        const cancel = el("button", "tee-secondary", "Cancel (Esc)");
        const insert = el("button", "", "Insert (Enter)");
        // mousedown : sinon le formulaire perd le focus avant le clic
        for (const button of [cancel, insert]) button.addEventListener("mousedown", e => e.preventDefault());
        cancel.addEventListener("click", () => this.closePopup(true));
        insert.addEventListener("click", submit);
        actions.append(el("span", "tee-hint", "Tab: next field · Shift+Enter: new line"), cancel, insert);

        // Les touches tapées dans le formulaire ne doivent pas arriver jusqu'à Discord
        node.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "Escape") {
                e.preventDefault();
                this.closePopup(true);
            } else if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                submit();
            }
        });
        for (const type of ["keyup", "keypress", "paste"]) node.addEventListener(type, e => e.stopPropagation());

        node.append(title, grid, preview, actions);
        updatePreview();
        this.showPopup("form", node, composer);
        inputs[0].focus();
    }

    showPopup(kind, node, composer) {
        this.closePopup(false);
        this.popup = { kind, node, composer };
        document.body.append(node);

        // Juste au-dessus de la zone de texte
        const box = composer.node.closest('[class*="channelTextArea"]') ?? composer.node;
        const rect = box.getBoundingClientRect();
        if (kind === "menu") {
            const button = box.querySelector(".tee-button")?.getBoundingClientRect();
            node.style.right = `${Math.max(8, window.innerWidth - (button?.right ?? rect.right))}px`;
        } else {
            node.style.left = `${Math.max(8, rect.left)}px`;
            node.style.width = `${Math.min(Math.max(360, rect.width), window.innerWidth - 16)}px`;
        }
        node.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    }

    closePopup(refocus) {
        if (!this.popup) return;
        const { node, composer } = this.popup;
        this.popup = null;
        node.remove();
        if (refocus) this.findLiveNode(composer)?.focus();
    }

    // --- Lecture et écriture du texte ---

    // La zone de texte où l'on écrit : celle de Discord (Slate) ou un simple textarea (ServerFeed, SideChats…)
    getComposer() {
        const active = document.activeElement;
        if (active?.matches?.("textarea") && !active.closest(".tee-panel, .tee-popup")) return { kind: "textarea", node: active };
        const node = active?.closest?.('[role="textbox"][contenteditable="true"]');
        return node ? { kind: "slate", node } : null;
    }

    findLiveNode(composer) {
        if (composer.node.isConnected) return composer.node;
        return document.querySelector('[class*="channelTextArea"] [role="textbox"][contenteditable="true"]');
    }

    findEditor(node) {
        return walkFiber(node, fiber => {
            const editor = fiber.memoizedProps?.editor;
            return editor?.children && typeof editor.apply === "function" ? editor : null;
        });
    }

    readText(composer) {
        if (composer.kind === "textarea") return composer.node.value;
        // L'éditeur de Discord garde les mentions et emojis comme des objets : on les remet au format du message
        const editor = this.findEditor(composer.node);
        if (Array.isArray(editor?.children)) return serializeEditor(editor);
        return composer.node.innerText.replace(/[​﻿]/g, "").replace(/\n$/, "");
    }

    writeText(composer, text) {
        const node = this.findLiveNode(composer);
        if (!node) return console.warn(`[${this.meta.name}] message bar not found`);
        node.focus();

        if (composer.kind === "textarea") {
            node.value = text;
            // Le plugin qui gère le textarea est prévenu comme si on avait tapé
            node.dispatchEvent(new Event("input", { bubbles: true }));
            node.setSelectionRange(text.length, text.length);
            return;
        }

        // 1. On sélectionne tout le contenu de l'éditeur, puis on colle le message : c'est la façon dont
        //    l'éditeur de Discord gère le mieux un texte sur plusieurs lignes
        const editor = this.findEditor(node);
        if (editor && selectAll(editor)) {
            const data = new DataTransfer();
            data.setData("text/plain", text);
            const paste = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
            node.dispatchEvent(paste);
            if (paste.defaultPrevented) {
                console.log(`[${this.meta.name}] inserted by paste`);
                return;
            }
        }

        // 2. Sinon : sélection de tout le texte et remplacement comme si on l'avait tapé
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        if (document.execCommand("insertText", false, text)) {
            console.log(`[${this.meta.name}] inserted by insertText`);
            return;
        }

        // 3. Dernier recours : les commandes internes de Discord
        if (this.componentDispatch) {
            this.componentDispatch.dispatchToLastSubscribed("CLEAR_TEXT");
            this.componentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: text, rawText: text });
            console.log(`[${this.meta.name}] inserted by ComponentDispatch`);
            return;
        }
        console.warn(`[${this.meta.name}] could not insert the message`);
    }

    // --- Paramètres ---

    saveSettings() {
        BdApi.Data.save(this.meta.name, "settings", this.settings);
        this.indexTemplates();
    }

    getSettingsPanel() {
        const panel = el("div", "tee-panel");
        this.renderPanel(panel);
        return panel;
    }

    renderPanel(panel) {
        const help = el("div", "tee-help");
        help.innerHTML = `
            Write your message and put a blank between braces wherever you want to fill something in: <code>{Title}</code>, <code>{Date}</code>, <code>{Who's coming}</code>...<br>
            Type the template's command at the end of your message and press <b>Tab</b> or <b>Enter</b> (or use the button in the message bar):
            a form opens with one box per blank, and the finished message is put in your message bar. The same blank used twice is filled in once.`;
        panel.replaceChildren(help);

        panel.append(checkbox("Show the templates button in the message bar", this.settings.button, value => {
            this.settings.button = value;
            this.saveSettings();
            this.injectButtons();
        }));

        this.settings.templates.forEach((template, index) => {
            const box = el("div", "tee-template");
            const row = el("div", "tee-row");

            const name = el("input", "tee-name");
            name.placeholder = "Template name";
            name.value = template.name ?? "";
            name.addEventListener("change", () => {
                template.name = name.value.trim();
                this.saveSettings();
            });

            const trigger = el("input", "tee-trigger");
            trigger.placeholder = ";command";
            trigger.value = template.trigger ?? "";
            trigger.addEventListener("change", () => {
                template.trigger = trigger.value.replace(/\s+/g, "");
                trigger.value = template.trigger;
                this.saveSettings();
            });

            const remove = el("button", "tee-delete", "✕");
            remove.title = "Delete this template";
            remove.addEventListener("click", () => {
                this.settings.templates.splice(index, 1);
                this.saveSettings();
                this.renderPanel(panel);
            });
            row.append(name, trigger, remove);

            const text = el("textarea");
            text.placeholder = "Your message, with {Blanks} to fill in";
            text.value = template.text ?? "";
            const detected = el("div", "tee-detected");
            const updateDetected = () => {
                const fields = blanksOf(text.value);
                detected.replaceChildren(fields.length ? "Blanks: " : "No blanks: the text is inserted as is");
                fields.forEach((field, i) => {
                    if (i) detected.append(", ");
                    detected.append(el("code", "", field));
                });
            };
            text.addEventListener("input", updateDetected);
            text.addEventListener("change", () => {
                template.text = text.value;
                this.saveSettings();
            });
            updateDetected();

            box.append(row, text, detected);
            panel.append(box);
        });

        const add = el("button", "", "+ Add template");
        add.style.alignSelf = "flex-start";
        add.addEventListener("click", () => {
            this.settings.templates.push({ name: "", trigger: "", text: "" });
            this.saveSettings();
            this.renderPanel(panel);
        });
        panel.append(add);
    }
};

// --- Modèles ---

// Les noms des blancs, dans l'ordre, sans doublon
function blanksOf(text) {
    const names = [];
    for (const [, inner] of text.matchAll(BLANK)) {
        const name = inner.trim();
        if (name && !names.includes(name)) names.push(name);
    }
    return names;
}

function fillTemplate(text, values) {
    return text.replace(BLANK, (match, inner) => inner.trim() in values ? values[inner.trim()] : match);
}

// L'aperçu : valeurs surlignées, blancs encore vides en gris
function renderTemplate(text, values) {
    const parts = [];
    let position = 0;
    for (const match of text.matchAll(BLANK)) {
        const name = match[1].trim();
        if (!(name in values)) continue;
        parts.push(document.createTextNode(text.slice(position, match.index)));
        parts.push(values[name].trim() ? el("mark", "", values[name]) : el("span", "tee-blank", `[${name}]`));
        position = match.index + match[0].length;
    }
    parts.push(document.createTextNode(text.slice(position)));
    return parts;
}

// --- Éditeur de Discord ---

// Sélectionne tout le contenu de l'éditeur (du premier au dernier morceau de texte)
function selectAll(editor) {
    const leaves = [];
    const visit = (node, path) => {
        if (typeof node?.text === "string") leaves.push({ path, length: node.text.length });
        else (node?.children ?? []).forEach((child, index) => visit(child, [...path, index]));
    };
    editor.children.forEach((line, index) => visit(line, [index]));
    if (!leaves.length) return false;
    const first = leaves[0];
    const last = leaves[leaves.length - 1];
    try {
        editor.apply({
            type: "set_selection",
            properties: editor.selection,
            newProperties: { anchor: { path: first.path, offset: 0 }, focus: { path: last.path, offset: last.length } }
        });
        return true;
    } catch (error) {
        console.warn("[TextExpanderEnhanced] could not select the text", error);
        return false;
    }
}

function walkFiber(node, pick) {
    let fiber = BdApi.ReactUtils.getInternalInstance(node);
    for (let depth = 0; fiber && depth < 80; depth++, fiber = fiber.return) {
        const found = pick(fiber);
        if (found) return found;
    }
    return null;
}

// Le contenu de l'éditeur de Discord au format d'un message (<@id>, <:emoji:id>…)
function serializeEditor(editor) {
    const visit = node => {
        if (typeof node?.text === "string") return node.text;
        switch (node?.type) {
            case "userMention": return `<@${node.userId}>`;
            case "roleMention": return `<@&${node.roleId}>`;
            case "channelMention": return `<#${node.channelId}>`;
            case "emoji": {
                const emoji = node.emoji ?? {};
                return emoji.emojiId ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.emojiId}>` : emoji.surrogate ?? `:${emoji.name}:`;
            }
        }
        return (node?.children ?? []).map(visit).join("");
    };
    return editor.children.map(visit).join("\n");
}

function checkbox(label, checked, onChange) {
    const wrap = el("label", "tee-check");
    const box = el("input");
    box.type = "checkbox";
    box.checked = checked;
    box.addEventListener("change", () => onChange(box.checked));
    wrap.append(box, label);
    return wrap;
}

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}
