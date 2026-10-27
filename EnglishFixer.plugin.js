/**
 * @name EnglishFixer
 * @author findert
 * @description Press a shortcut to preview your message with its English typos and mistakes fixed, then accept or skip the corrections.
 * @version 1.0.0
 */

const DEFAULT_SETTINGS = {
    shortcut: "Ctrl+Shift+G",
    variant: "en-US",
    punctuation: true,
    casing: true,
    style: false,
    button: true,
    ignore: "lol, gg, wp, ez, xd, idk, imo, tbh, brb, afk, ty, np, omg, lmao, wtf, btw, irl, dm, pls, plz, ok"
};

const API_URL = "https://api.languagetool.org/v2/check";

// Ce qu'il ne faut jamais corriger : code, liens, mentions, emojis, dates de Discord
const PROTECTED = /```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|<(?:@[!&]?|#)\d+>|<a?:\w+:\d+>|<t:-?\d+(?::\w)?>|:\w+:/g;

const CSS = `
.ef-preview {
    position: fixed; z-index: 1002; box-sizing: border-box; padding: 10px 12px; border-radius: 8px;
    background: var(--background-base-low, var(--background-secondary, #2b2d31)); color: var(--text-normal, #dbdee1);
    border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent);
    box-shadow: 0 8px 24px rgba(0,0,0,.45); font-size: 14px; line-height: 1.4;
}
.ef-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #949ba4); margin-bottom: 6px; }
.ef-title span:last-child { margin-left: auto; font-weight: 500; text-transform: none; }
.ef-text { white-space: pre-wrap; word-break: break-word; max-height: 240px; overflow-y: auto; }
.ef-change { cursor: pointer; border-radius: 3px; padding: 0 1px; }
.ef-change:hover { background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 15%, transparent); }
.ef-change del { color: var(--status-danger, #f23f43); }
.ef-change ins { color: var(--status-positive, #23a55a); text-decoration: none; font-weight: 600; }
.ef-change.ef-off del { color: inherit; text-decoration: none; }
.ef-change.ef-off ins { display: none; }
.ef-change.ef-off { outline: 1px dashed color-mix(in srgb, var(--interactive-normal, #b5bac1) 40%, transparent); }
.ef-text img { width: 18px; height: 18px; vertical-align: -4px; }
.ef-mention { color: var(--mention-foreground, #c9cdfb); }
.ef-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.ef-hint { font-size: 12px; color: var(--text-muted, #949ba4); margin-right: auto; }
.ef-actions button { border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer; font-size: 13px; font-weight: 500; color: #fff; background: var(--button-secondary-background, #4e5058); }
.ef-actions button.ef-accept { background: var(--brand-500, #5865f2); }

.ef-button {
    display: flex; align-items: center; justify-content: center; align-self: center; width: 32px; height: 32px; flex: none;
    padding: 0; border: none; border-radius: 4px; background: none; cursor: pointer; color: var(--interactive-normal, #b5bac1);
}
.ef-button:hover { color: var(--interactive-hover, #dbdee1); }

.ef-settings { color: var(--text-normal, #dbdee1); display: flex; flex-direction: column; gap: 12px; }
.ef-settings label { display: flex; align-items: center; gap: 8px; }
.ef-settings .ef-field { display: flex; flex-direction: column; gap: 6px; }
.ef-settings input[type="text"], .ef-settings select, .ef-settings textarea {
    background: var(--background-tertiary, #1e1f22); color: var(--text-normal, #dbdee1);
    border: 1px solid var(--background-modifier-accent, #4e5058); border-radius: 4px; padding: 8px; font: inherit; font-size: 14px;
}
.ef-settings input.ef-recording { border-color: var(--brand-500, #5865f2); }
.ef-settings textarea { min-height: 60px; resize: vertical; }
.ef-settings .ef-note { color: var(--text-muted, #949ba4); font-size: 13px; }
`;

module.exports = class EnglishFixer {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        this.settings = Object.assign({ ...DEFAULT_SETTINGS }, BdApi.Data.load(this.meta.name, "settings"));
        BdApi.DOM.addStyle(this.meta.name, CSS);

        const { Webpack } = BdApi;
        this.stores = Object.fromEntries(["UserStore", "GuildMemberStore", "ChannelStore", "GuildRoleStore", "SelectedGuildStore", "DraftStore", "SelectedChannelStore"]
            .map(name => [name, Webpack.getStore(name)]));
        // Ce que Discord utilise pour écrire dans la zone de message (vider le texte, en insérer)
        this.componentDispatch = Webpack.getModule(m => typeof m?.dispatchToLastSubscribed === "function" && m.emitter, { searchExports: true });

        // Phase de capture : on passe avant Discord (sinon Entrée enverrait le message)
        this.onKeyDown = e => this.handleKey(e);
        this.onMouseDown = e => {
            if (this.preview && !this.preview.node.contains(e.target)) this.closePreview();
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
        document.querySelectorAll(".ef-button").forEach(button => button.remove());
        this.closePreview();
        BdApi.DOM.removeStyle(this.meta.name);
    }

    // --- Raccourci ---

    handleKey(e) {
        if (this.preview) {
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                e.stopImmediatePropagation();
                this.accept();
            } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopImmediatePropagation();
                this.closePreview();
            } else if (!["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
                // On reprend l'écriture : la correction ne correspond plus au texte
                this.closePreview();
            }
            return;
        }
        if (this.recording || !this.settings.shortcut || comboOf(e) !== this.settings.shortcut) return;
        const composer = this.getComposer();
        if (!composer) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.check(composer);
    }

    // --- Bouton dans la barre de message ---

    injectButtons() {
        if (!this.settings.button) {
            document.querySelectorAll(".ef-button").forEach(button => button.remove());
            return;
        }
        for (const area of document.querySelectorAll('[class*="channelTextArea"]')) {
            const buttons = area.querySelector('[class*="buttons"]');
            const textbox = area.querySelector('[role="textbox"][contenteditable="true"]');
            if (!buttons || !textbox || buttons.querySelector(".ef-button")) continue;

            const button = el("button", "ef-button");
            button.type = "button";
            button.title = `Check English (${this.settings.shortcut})`;
            // Icône « vérification d'orthographe » (Material Icons)
            button.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.45 16h2.09L9.43 3H7.57L2.46 16h2.09l1.12-3h5.64l1.14 3zm-6.02-5L8.5 5.48 10.57 11H6.43zm15.16.59l-8.09 8.09L9.83 16l-1.41 1.41 5.09 5.09L23 13l-1.41-1.41z"/></svg>`;
            // mousedown : la zone de texte garde le focus et le curseur
            button.addEventListener("mousedown", e => e.preventDefault());
            button.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                const node = area.querySelector('[role="textbox"][contenteditable="true"]');
                if (!node) return;
                node.focus();
                this.check({ kind: "slate", node });
            });
            buttons.prepend(button);
        }
    }

    // La zone de texte où l'on écrit : celle de Discord (Slate) ou un simple textarea (ServerFeed, etc.)
    getComposer() {
        const active = document.activeElement;
        if (active?.matches?.("textarea")) return { kind: "textarea", node: active };
        const node = active?.closest?.('[role="textbox"][contenteditable="true"]');
        return node ? { kind: "slate", node } : null;
    }

    // --- Lecture et écriture du texte ---

    readText(composer) {
        if (composer.kind === "textarea") return composer.node.value;
        // L'éditeur de Discord garde les mentions et emojis comme des objets : on les remet au format du message,
        // en notant où se trouve chaque morceau de texte pour pouvoir le corriger ensuite
        const editor = this.findEditor(composer.node);
        if (Array.isArray(editor?.children)) {
            const { text, leaves } = serializeEditor(editor);
            Object.assign(composer, { editor, leaves });
            return text;
        }
        const channelId = this.findChannelId(composer.node);
        return this.stores.DraftStore?.getDraft?.(channelId, 0) ?? composer.node.innerText;
    }

    writeText(composer, text) {
        if (composer.kind === "textarea") {
            composer.node.value = text;
            // Le plugin qui gère le textarea est prévenu comme si on avait tapé
            composer.node.dispatchEvent(new Event("input", { bubbles: true }));
            composer.node.focus();
            return;
        }
        // Éditeur introuvable : on sélectionne tout le texte et on le remplace comme si on l'avait tapé
        console.warn(`[${this.meta.name}] editor not found, replacing the whole text`);
        composer.node.focus();
        const range = document.createRange();
        range.selectNodeContents(composer.node);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        if (!document.execCommand("insertText", false, text) && this.componentDispatch) {
            this.componentDispatch.dispatchToLastSubscribed("CLEAR_TEXT");
            this.componentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: text, rawText: text });
        }
    }

    // On remonte les composants React depuis la zone de texte jusqu'à trouver l'éditeur ou le salon
    findEditor(node) {
        return walkFiber(node, fiber => {
            const editor = fiber.memoizedProps?.editor;
            return editor?.children && typeof editor.apply === "function" ? editor : null;
        });
    }

    findChannelId(node) {
        return walkFiber(node, fiber => fiber.memoizedProps?.channel?.id ?? null)
            ?? this.stores.SelectedChannelStore?.getChannelId?.();
    }

    // --- Correction ---

    async check(composer) {
        const text = this.readText(composer);
        if (!text?.trim()) return;
        this.showPreview(composer, text, null);
        const checkId = this.checkId = (this.checkId ?? 0) + 1;

        let changes;
        try {
            changes = await this.findChanges(text);
        } catch (error) {
            console.error(`[${this.meta.name}] check failed`, error);
            if (checkId === this.checkId) this.closePreview();
            // 429 : la limite gratuite (20 vérifications par minute) est atteinte
            if (error.status === 429) BdApi.UI.showToast("EnglishFixer: too many checks, wait a minute", { type: "warning" });
            else if (error.status === 413) BdApi.UI.showToast("EnglishFixer: message too long to check", { type: "warning" });
            else BdApi.UI.showToast("EnglishFixer: couldn't reach LanguageTool", { type: "error" });
            return;
        }
        if (checkId !== this.checkId || !this.preview) return;
        if (!changes.length) {
            this.closePreview();
            BdApi.UI.showToast("No mistakes found ✓", { type: "success" });
            return;
        }
        this.showPreview(composer, text, changes);
    }

    async findChanges(text) {
        const body = new URLSearchParams({ text, language: this.settings.variant, level: "default" }).toString();
        const request = { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body };
        // BdApi.Net.fetch passe par BetterDiscord (Discord bloque les requêtes vers d'autres sites)
        const response = await (BdApi.Net?.fetch ?? fetch)(API_URL, request);
        if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
        const data = await response.json();

        const protectedRanges = [...text.matchAll(PROTECTED)].map(match => [match.index, match.index + match[0].length]);
        const ignored = new Set(this.settings.ignore.split(/[\s,]+/).filter(Boolean).map(word => word.toLowerCase()));
        const changes = [];
        let lastStart = Infinity;
        // De la fin vers le début, en sautant les corrections qui se chevauchent
        const matches = (data.matches ?? []).filter(match => match.replacements?.length).sort((a, b) => b.offset - a.offset);
        for (const match of matches) {
            const start = match.offset;
            const end = match.offset + match.length;
            const from = text.slice(start, end);
            if (end > lastStart || !this.wanted(match, text)) continue;
            if (protectedRanges.some(([s, e]) => start < e && end > s)) continue;
            if (ignored.has(from.toLowerCase())) continue;
            // LanguageTool propose parfois le mot tel quel : ce n'est pas une correction
            let options = match.replacements.slice(0, 5).map(item => item.value).filter(value => value !== from);
            if (!options.length) continue;
            // Faute de frappe : le mot le plus proche d'abord. Grammaire : l'ordre de LanguageTool est le bon
            if (match.rule?.issueType === "misspelling") options = rankReplacements(from, options);
            changes.unshift({ start, end, from, options, choice: 0, to: options[0], reason: match.shortMessage || match.message, enabled: true });
            lastStart = start;
        }
        return changes;
    }

    wanted(match, text) {
        const category = match.rule?.category?.id;
        const type = match.rule?.issueType;
        if (category === "CASING") return this.settings.casing;
        if (category === "PUNCTUATION" || category === "TYPOGRAPHY" || type === "whitespace") return this.settings.punctuation;
        if (category === "STYLE" || category === "REDUNDANCY" || category === "PLAIN_ENGLISH" || type === "style" || type === "locale-violation") return this.settings.style;
        if (type === "misspelling") {
            // Un mot avec une majuscule au milieu d'une phrase, des chiffres ou des _ : sûrement un pseudo ou un nom
            const word = text.slice(match.offset, match.offset + match.length);
            if (/[\d_]/.test(word) || /[A-Z]/.test(word.slice(1))) return false;
            const sentenceStart = /(^|[.!?]\s+|\n\s*)$/.test(text.slice(0, match.offset));
            if (/^[A-Z]/.test(word) && !sentenceStart) return false;
        }
        return true;
    }

    // --- Aperçu ---

    showPreview(composer, text, changes) {
        if (!this.preview) {
            const node = el("div", "ef-preview");
            node.addEventListener("click", e => {
                const change = e.target.closest("[data-index]");
                if (change) {
                    // Chaque clic passe à la suggestion suivante, puis à « ne pas corriger »
                    const item = this.preview.changes[Number(change.dataset.index)];
                    item.choice = (item.choice + 1) % (item.options.length + 1);
                    item.enabled = item.choice < item.options.length;
                    if (item.enabled) item.to = item.options[item.choice];
                    change.classList.toggle("ef-off", !item.enabled);
                    change.querySelector("ins")?.remove();
                    if (item.to) change.insertAdjacentHTML("beforeend", `<ins>${escapeHtml(item.to)}</ins>`);
                    this.updateCount();
                } else if (e.target.closest(".ef-accept")) this.accept();
                else if (e.target.closest(".ef-cancel")) this.closePreview();
            });
            document.body.append(node);
            this.preview = { node };
        }
        Object.assign(this.preview, { composer, text, changes });
        const node = this.preview.node;

        if (!changes) {
            node.innerHTML = `<div class="ef-title"><span>Checking your English…</span></div>`;
        } else {
            let html = "";
            let position = 0;
            changes.forEach((change, index) => {
                html += this.renderText(text.slice(position, change.start));
                html += `<span class="ef-change" data-index="${index}" title="${escapeHtml(change.reason ?? "")}">`
                    + (change.from ? `<del>${escapeHtml(change.from)}</del>` : "")
                    + (change.to ? `<ins>${escapeHtml(change.to)}</ins>` : "") + `</span>`;
                position = change.end;
            });
            html += this.renderText(text.slice(position));
            node.innerHTML = `
                <div class="ef-title"><span>Corrected message</span><span class="ef-count"></span></div>
                <div class="ef-text">${html}</div>
                <div class="ef-actions">
                    <span class="ef-hint">Click a change for other suggestions or to skip it</span>
                    <button class="ef-cancel">Cancel (Esc)</button>
                    <button class="ef-accept">Accept (Enter)</button>
                </div>`;
            this.updateCount();
        }

        // Juste au-dessus de la zone de texte
        const box = composer.node.closest('[class*="channelTextArea"]') ?? composer.node;
        const rect = box.getBoundingClientRect();
        node.style.left = `${Math.max(8, rect.left)}px`;
        node.style.width = `${Math.max(320, rect.width)}px`;
        node.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    }

    updateCount() {
        const count = this.preview.changes.filter(change => change.enabled).length;
        const label = this.preview.node.querySelector(".ef-count");
        if (label) label.textContent = `${count} fix${count === 1 ? "" : "es"}`;
    }

    // Texte de l'aperçu : les mentions et emojis s'affichent comme dans Discord
    renderText(text) {
        const { UserStore, GuildMemberStore, ChannelStore, GuildRoleStore, SelectedGuildStore } = this.stores;
        const guildId = SelectedGuildStore?.getGuildId?.();
        return text.split(/(<@!?\d+>|<@&\d+>|<#\d+>|<a?:\w+:\d+>)/).map((part, index) => {
            if (index % 2 === 0) return escapeHtml(part);
            let match;
            if ((match = part.match(/^<@!?(\d+)>$/))) {
                const user = UserStore?.getUser?.(match[1]);
                const name = GuildMemberStore?.getNick?.(guildId, match[1]) ?? user?.globalName ?? user?.username ?? "user";
                return `<span class="ef-mention">@${escapeHtml(name)}</span>`;
            }
            if ((match = part.match(/^<@&(\d+)>$/))) {
                const roles = GuildRoleStore?.getRolesSnapshot?.(guildId) ?? GuildRoleStore?.getRoles?.(guildId) ?? {};
                const role = Array.isArray(roles) ? roles.find(item => item.id === match[1]) : roles[match[1]];
                return `<span class="ef-mention">@${escapeHtml(role?.name ?? "role")}</span>`;
            }
            if ((match = part.match(/^<#(\d+)>$/))) return `<span class="ef-mention">#${escapeHtml(ChannelStore?.getChannel?.(match[1])?.name ?? "channel")}</span>`;
            match = part.match(/^<(a?):(\w+):(\d+)>$/);
            return `<img alt=":${escapeHtml(match[2])}:" src="https://cdn.discordapp.com/emojis/${match[3]}.${match[1] ? "gif" : "webp"}?size=48">`;
        }).join("");
    }

    accept() {
        const preview = this.preview;
        if (!preview?.changes) return;
        const { editor, leaves } = preview.composer;
        if (editor && leaves) {
            this.closePreview();
            this.applyToEditor(editor, leaves, preview.changes.filter(change => change.enabled));
            preview.composer.node.focus();
            return;
        }
        let text = preview.text;
        // Depuis la fin, pour que les positions du début restent justes
        for (const change of [...preview.changes].reverse()) {
            if (change.enabled) text = text.slice(0, change.start) + change.to + text.slice(change.end);
        }
        this.closePreview();
        this.writeText(preview.composer, text);
    }

    // Chaque correction devient une modification du morceau de texte concerné dans l'éditeur de Discord
    // (les mentions et emojis autour restent intacts, et Ctrl+Z annule)
    applyToEditor(editor, leaves, changes) {
        for (const change of [...changes].sort((a, b) => b.start - a.start)) {
            const leaf = leaves.find(item => change.start >= item.start && change.end <= item.start + item.text.length);
            if (!leaf) continue;
            const offset = change.start - leaf.start;
            try {
                if (change.from) editor.apply({ type: "remove_text", path: leaf.path, offset, text: change.from });
                if (change.to) editor.apply({ type: "insert_text", path: leaf.path, offset, text: change.to });
            } catch (error) {
                console.error(`[${this.meta.name}] couldn't apply a fix`, error);
            }
        }
    }

    closePreview() {
        this.checkId = (this.checkId ?? 0) + 1;
        this.preview?.node.remove();
        this.preview = null;
    }

    // --- Paramètres ---

    saveSettings() {
        BdApi.Data.save(this.meta.name, "settings", this.settings);
        // Le bouton suit les réglages (affiché ou non, raccourci dans l'infobulle)
        document.querySelectorAll(".ef-button").forEach(button => button.remove());
        this.injectButtons();
    }

    getSettingsPanel() {
        const panel = el("div", "ef-settings");

        // Raccourci : on clique dans la case puis on appuie sur la combinaison voulue
        const shortcut = el("input");
        shortcut.type = "text";
        shortcut.readOnly = true;
        shortcut.value = this.settings.shortcut;
        shortcut.addEventListener("focus", () => {
            this.recording = true;
            shortcut.classList.add("ef-recording");
            shortcut.value = "Press a key combination…";
        });
        shortcut.addEventListener("blur", () => {
            this.recording = false;
            shortcut.classList.remove("ef-recording");
            shortcut.value = this.settings.shortcut;
        });
        shortcut.addEventListener("keydown", e => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "Escape") return shortcut.blur();
            const combo = comboOf(e);
            if (!combo) return;
            this.settings.shortcut = combo;
            this.saveSettings();
            shortcut.blur();
        });
        panel.append(field("Shortcut (click, then press the keys)", shortcut));

        const variant = el("select");
        for (const [value, label] of [["en-US", "English (US)"], ["en-GB", "English (UK)"]]) {
            const option = el("option", "", label);
            option.value = value;
            option.selected = this.settings.variant === value;
            variant.append(option);
        }
        variant.addEventListener("change", () => {
            this.settings.variant = variant.value;
            this.saveSettings();
        });
        panel.append(field("Language", variant));

        panel.append(
            this.checkbox("Show a button in the message bar", "button"),
            this.checkbox("Fix punctuation and spacing", "punctuation"),
            this.checkbox("Fix capitalization (\"i\" → \"I\", start of sentences)", "casing"),
            this.checkbox("Suggest style improvements (wordiness, repeated words…)", "style")
        );

        const ignore = el("textarea");
        ignore.value = this.settings.ignore;
        ignore.addEventListener("change", () => {
            this.settings.ignore = ignore.value;
            this.saveSettings();
        });
        panel.append(field("Words never corrected (separated by commas or spaces)", ignore));

        panel.append(el("div", "ef-note", "Your message is sent to LanguageTool (languagetool.org) only when you press the shortcut. Spelling and grammar mistakes are always fixed."));
        return panel;
    }

    checkbox(label, key) {
        const row = el("label");
        const input = el("input");
        input.type = "checkbox";
        input.checked = Boolean(this.settings[key]);
        input.addEventListener("change", () => {
            this.settings[key] = input.checked;
            this.saveSettings();
        });
        row.append(input, document.createTextNode(label));
        return row;
    }
};

// « Ctrl+Shift+G » à partir d'un appui de touche (rien si on n'appuie que sur Ctrl, Shift…)
function comboOf(e) {
    if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return null;
    const key = e.code.startsWith("Key") ? e.code.slice(3)
        : e.code.startsWith("Digit") ? e.code.slice(5)
        : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    return [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Meta", key].filter(Boolean).join("+");
}

// Les suggestions les plus proches du mot tapé d'abord (« realy » → « really » plutôt que « real »)
function rankReplacements(from, options) {
    const lower = from.toLowerCase();
    const score = option => {
        const target = option.toLowerCase();
        // Bonus quand on n'a fait qu'oublier des lettres : toutes celles tapées sont dans la suggestion, dans l'ordre
        let i = 0;
        for (const char of target) if (char === lower[i]) i++;
        return distance(lower, target) - (i === lower.length ? 0.5 : 0);
    };
    return options.map((option, index) => ({ option, index, score: score(option) }))
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .map(item => item.option);
}

// Nombre de fautes de frappe entre deux mots (lettre en trop, en moins, changée ou deux lettres inversées)
function distance(a, b) {
    const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) rows[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
        }
    }
    return rows[a.length][b.length];
}

// Remonte l'arbre React depuis un élément jusqu'à ce que « pick » trouve quelque chose
function walkFiber(node, pick) {
    let fiber = BdApi.ReactUtils.getInternalInstance(node);
    for (let depth = 0; fiber && depth < 80; depth++, fiber = fiber.return) {
        const found = pick(fiber);
        if (found) return found;
    }
    return null;
}

// Le contenu de l'éditeur de Discord au format d'un message (<@id>, <:emoji:id>…),
// avec la position de chaque morceau de texte (son chemin dans l'éditeur et où il commence dans le message)
function serializeEditor(editor) {
    let text = "";
    const leaves = [];
    const visit = (node, path) => {
        if (typeof node?.text === "string") {
            leaves.push({ path, start: text.length, text: node.text });
            text += node.text;
            return;
        }
        const token = tokenOf(node);
        if (token !== null) {
            text += token;
            return;
        }
        (node?.children ?? []).forEach((child, index) => visit(child, [...path, index]));
    };
    editor.children.forEach((line, index) => {
        if (index) text += "\n";
        visit(line, [index]);
    });
    return { text, leaves };
}

function tokenOf(node) {
    switch (node?.type) {
        case "userMention": return `<@${node.userId}>`;
        case "roleMention": return `<@&${node.roleId}>`;
        case "channelMention": return `<#${node.channelId}>`;
        case "emoji": {
            const emoji = node.emoji ?? {};
            return emoji.emojiId ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.emojiId}>` : emoji.surrogate ?? `:${emoji.name}:`;
        }
        default: return null;
    }
}

function field(label, input) {
    const wrap = el("div", "ef-field");
    wrap.append(el("span", "", label), input);
    return wrap;
}

function escapeHtml(text) {
    return String(text ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}
