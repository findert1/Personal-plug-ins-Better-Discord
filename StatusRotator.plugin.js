/**
 * @name StatusRotator
 * @author findert
 * @description Automatically rotates between multiple custom statuses at a set interval. Custom server emojis can be used with Nitro.
 * @version 1.1.0
 */

// Minimum entre deux changements, pour ne pas se faire rate-limit par Discord
const MIN_INTERVAL = 15;

// Type d'activité Discord correspondant au statut personnalisé (les autres : jeu, écoute, stream...)
const CUSTOM_STATUS_TYPE = 4;

// Stores qui émettent un changement quand l'activité de l'utilisateur change
const ACTIVITY_STORES = ["LocalActivityStore", "PresenceStore"];

const DEFAULT_SETTINGS = {
    interval: 60,
    pauseOnActivity: true,
    statuses: [
        { emoji: "👋", text: "Hello World!", presence: "" },
        { emoji: "💻", text: "Coding", presence: "" }
    ]
};

const PRESENCES = {
    "": "Don't change",
    online: "Online",
    idle: "Idle",
    dnd: "Do Not Disturb",
    invisible: "Invisible"
};

const CSS = `
.sr-panel { color: var(--text-normal); display: flex; flex-direction: column; gap: 12px; }
.sr-row { display: flex; gap: 8px; align-items: center; }
.sr-panel input, .sr-panel select {
    background: var(--background-tertiary, #1e1f22);
    color: var(--text-normal, #dbdee1);
    border: 1px solid var(--background-modifier-accent, #4e5058);
    border-radius: 4px; padding: 8px;
    user-select: text; pointer-events: auto;
}
.sr-panel input:focus, .sr-panel select:focus { outline: none; border-color: var(--brand-500, #5865f2); }
.sr-panel button.sr-emoji-btn {
    width: 48px; height: 36px; padding: 0; font-size: 20px;
    display: flex; align-items: center; justify-content: center;
    background: var(--background-tertiary, #1e1f22);
    border: 1px solid var(--background-modifier-accent, #4e5058);
}
.sr-panel button.sr-emoji-btn.sr-empty, .sr-panel button.sr-emoji-btn.sr-locked { opacity: 0.4; }
.sr-emoji-img { width: 22px; height: 22px; object-fit: contain; }
.sr-guild-icon { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; }
.sr-guild-letters { width: 22px; font-size: 10px; font-weight: 600; overflow: hidden; white-space: nowrap; }
.sr-picker {
    display: flex; flex-direction: column; gap: 8px; padding: 8px;
    background: var(--background-secondary, #2b2d31);
    border: 1px solid var(--background-modifier-accent, #4e5058);
    border-radius: 8px;
}
.sr-picker-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.sr-panel .sr-picker-tabs button, .sr-panel .sr-picker-grid button {
    background: transparent; padding: 4px; font-size: 20px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
}
.sr-panel .sr-picker-tabs button { opacity: 0.5; }
.sr-panel .sr-picker-tabs button.sr-active { opacity: 1; background: var(--background-modifier-selected, #404249); }
.sr-panel .sr-picker-grid button:hover, .sr-panel .sr-picker-tabs button:hover { background: var(--background-modifier-hover, #393c41); }
.sr-picker-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: 2px;
    max-height: 220px; overflow-y: auto;
}
.sr-picker-empty { color: var(--text-muted, #949ba4); padding: 8px; }
.sr-text { flex: 1; }
.sr-interval { width: 80px; }
.sr-panel input[type="checkbox"] { width: 16px; height: 16px; padding: 0; margin: 0; cursor: pointer; }
.sr-panel button {
    background: var(--brand-500, #5865f2); color: white;
    border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer;
}
.sr-panel button.sr-delete { background: var(--status-danger, #da373c); }
.sr-panel button.sr-secondary { background: var(--background-modifier-accent, #4e5058); }
`;

module.exports = class StatusRotator {
    constructor(meta) {
        this.meta = meta;
        this.timer = null;
        this.index = 0;
    }

    start() {
        this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), BdApi.Data.load(this.meta.name, "settings"));

        // Module interne de Discord qui gère les paramètres utilisateur (dont le statut)
        this.settingsActions = BdApi.Webpack.getModule(
            m => m?.ProtoClass?.typeName?.endsWith(".PreloadedUserSettings"),
            { searchExports: true }
        );
        if (!this.settingsActions) {
            BdApi.UI.showToast("StatusRotator: settings module not found", { type: "error" });
            return;
        }

        this.saveOriginalStatus();
        BdApi.DOM.addStyle(this.meta.name, CSS);

        this.paused = null;
        this.onActivityChange = () => {
            if (this.hasActivity() !== this.paused) this.startRotation();
        };
        for (const name of ACTIVITY_STORES) BdApi.Webpack.getStore(name)?.addChangeListener(this.onActivityChange);

        this.startRotation();
    }

    stop() {
        for (const name of ACTIVITY_STORES) BdApi.Webpack.getStore(name)?.removeChangeListener(this.onActivityChange);
        this.stopRotation();
        this.restoreOriginalStatus();
        BdApi.DOM.removeStyle(this.meta.name);
    }

    // --- Rotation ---

    startRotation() {
        this.stopRotation();

        // Pendant une activité (jeu, musique...), on retire le statut pour laisser l'activité visible
        this.paused = this.hasActivity();
        if (this.paused) {
            this.clearStatus();
            return;
        }

        if (!this.getValidStatuses().length) return;

        this.index = 0;
        this.applyNext();
        const seconds = Math.max(MIN_INTERVAL, Number(this.settings.interval) || MIN_INTERVAL);
        this.timer = setInterval(() => this.applyNext(), seconds * 1000);
    }

    stopRotation() {
        clearInterval(this.timer);
        this.timer = null;
    }

    applyNext() {
        const statuses = this.getValidStatuses();
        if (!statuses.length) return;

        this.index %= statuses.length;
        this.setStatus(statuses[this.index]);
        this.index++;
    }

    getValidStatuses() {
        return this.settings.statuses.filter(s => s.text || s.emoji || s.presence);
    }

    // --- Activité ---

    getActivities() {
        const local = BdApi.Webpack.getStore("LocalActivityStore")?.getActivities?.();
        if (local) return local;
        const userId = BdApi.Webpack.getStore("UserStore")?.getCurrentUser()?.id;
        return BdApi.Webpack.getStore("PresenceStore")?.getActivities?.(userId) ?? [];
    }

    hasActivity() {
        return !!this.settings.pauseOnActivity
            && this.getActivities().some(a => a.type !== CUSTOM_STATUS_TYPE);
    }

    // --- Statut Discord ---

    setStatus({ text, emoji, presence }) {
        // Emoji de serveur : seulement si Discord l'autorise (Nitro), sinon le statut part sans emoji
        let emojiId = "0", emojiName = "";
        if (isCustomEmoji(emoji)) {
            if (canUseCustomEmoji(emoji)) {
                emojiId = emoji.id;
                emojiName = emoji.name;
            }
        } else if (emoji) {
            emojiName = emoji;
        }

        this.settingsActions.updateAsync("status", s => {
            s.customStatus = (text || emojiName)
                ? { text: text ?? "", emojiId, emojiName, expiresAtMs: "0" }
                : undefined;
            if (presence) s.status = { value: presence };
        }, 0);
    }

    clearStatus() {
        this.settingsActions.updateAsync("status", s => { s.customStatus = undefined; }, 0);
    }

    saveOriginalStatus() {
        const status = BdApi.Webpack.getStore("UserSettingsProtoStore")?.settings?.status;
        this.original = {
            customStatus: status?.customStatus ? structuredClone(status.customStatus) : undefined,
            presence: status?.status?.value
        };
    }

    restoreOriginalStatus() {
        if (!this.original || !this.settingsActions) return;
        const { customStatus, presence } = this.original;
        this.settingsActions.updateAsync("status", s => {
            s.customStatus = customStatus;
            if (presence) s.status = { value: presence };
        }, 0);
    }

    // --- Paramètres ---

    saveSettings() {
        BdApi.Data.save(this.meta.name, "settings", this.settings);
        if (this.settingsActions) this.startRotation();
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "sr-panel";
        this.renderPanel(panel);
        return panel;
    }

    // Ouvre le sélecteur d'emoji sous la ligne du statut, ou le ferme s'il y est déjà
    toggleEmojiPicker(row, current, onSelect) {
        const wasOpen = this.picker?.row === row;
        this.picker?.element.remove();
        this.picker = null;
        if (wasOpen) return;

        const data = loadEmojiData();
        // Emojis de tes serveurs en premier (comme le sélecteur de Discord), seulement avec Nitro
        const categories = [...loadCustomEmojiCategories(), ...data.categories];
        const element = el("div", "sr-picker");
        const close = () => {
            element.remove();
            this.picker = null;
        };
        const select = value => {
            onSelect(value);
            close();
        };

        const grid = el("div", "sr-picker-grid");
        const showEmojis = list => {
            grid.replaceChildren(...list.map(emoji => {
                const button = el("button");
                button.title = emoji.name ? `:${emoji.name}:` : emoji.char;
                button.append(renderEmoji(emoji.value));
                button.addEventListener("click", () => select(emoji.value));
                return button;
            }));
            if (!list.length) grid.append(el("div", "sr-picker-empty", "No emoji found"));
        };

        const tabs = el("div", "sr-picker-tabs");
        const selectCategory = (category, tab) => {
            for (const other of tabs.children) other.classList.remove("sr-active");
            tab.classList.add("sr-active");
            showEmojis(category.emojis);
        };
        for (const category of categories) {
            const tab = el("button");
            tab.title = category.title ?? category.id;
            tab.append(renderIcon(category.icon));
            tab.addEventListener("click", () => {
                if (search) search.value = "";
                selectCategory(category, tab);
            });
            tabs.append(tab);
        }

        let search = null;
        if (data.searchable) {
            search = el("input");
            search.placeholder = "Search emoji";
            search.addEventListener("input", () => {
                const query = search.value.trim().toLowerCase();
                if (!query) return selectCategory(categories[0], tabs.firstChild);
                for (const tab of tabs.children) tab.classList.remove("sr-active");
                const all = categories.flatMap(c => c.emojis);
                showEmojis(all.filter(e => e.names.some(n => n.includes(query))).slice(0, 200));
            });
            element.append(search);
        }

        element.append(tabs, grid);
        if (current) {
            const remove = el("button", "sr-secondary", "Remove emoji");
            remove.addEventListener("click", () => select(""));
            element.append(remove);
        }

        selectCategory(categories[0], tabs.firstChild);
        row.after(element);
        this.picker = { row, element };
        search?.focus();
    }

    renderPanel(panel) {
        panel.replaceChildren();
        this.picker = null;

        // Intervalle
        const intervalRow = el("div", "sr-row");
        const intervalInput = el("input", "sr-interval");
        intervalInput.type = "number";
        intervalInput.min = MIN_INTERVAL;
        intervalInput.value = this.settings.interval;
        intervalInput.addEventListener("change", () => {
            this.settings.interval = Math.max(MIN_INTERVAL, Number(intervalInput.value) || MIN_INTERVAL);
            intervalInput.value = this.settings.interval;
            this.saveSettings();
        });
        intervalRow.append(el("span", "", "Change status every"), intervalInput, el("span", "", "seconds"));
        panel.append(intervalRow);

        // Pause pendant une activité
        const activityRow = el("label", "sr-row");
        const activityToggle = el("input");
        activityToggle.type = "checkbox";
        activityToggle.checked = !!this.settings.pauseOnActivity;
        activityToggle.addEventListener("change", () => {
            this.settings.pauseOnActivity = activityToggle.checked;
            this.saveSettings();
        });
        activityRow.append(activityToggle, el("span", "", "Hide status while playing, listening or streaming"));
        panel.append(activityRow);

        // Liste des statuts
        this.settings.statuses.forEach((status, i) => {
            const row = el("div", "sr-row");

            const emoji = el("button", "sr-emoji-btn");
            fillEmojiButton(emoji, status.emoji);
            emoji.addEventListener("click", () => this.toggleEmojiPicker(row, status.emoji, value => {
                status.emoji = value;
                this.saveSettings();
                fillEmojiButton(emoji, value);
            }));

            const text = el("input", "sr-text");
            text.placeholder = "Status text";
            text.maxLength = 128;
            text.value = status.text ?? "";
            text.addEventListener("change", () => { status.text = text.value; this.saveSettings(); });

            const presence = el("select");
            for (const [value, label] of Object.entries(PRESENCES)) {
                const option = el("option", "", label);
                option.value = value;
                presence.append(option);
            }
            presence.value = status.presence ?? "";
            presence.addEventListener("change", () => { status.presence = presence.value; this.saveSettings(); });

            const remove = el("button", "sr-delete", "✕");
            remove.addEventListener("click", () => {
                this.settings.statuses.splice(i, 1);
                this.saveSettings();
                this.renderPanel(panel);
            });

            row.append(emoji, text, presence, remove);
            panel.append(row);
        });

        // Boutons
        const actions = el("div", "sr-row");
        const add = el("button", "", "+ Add status");
        add.addEventListener("click", () => {
            this.settings.statuses.push({ emoji: "", text: "", presence: "" });
            this.saveSettings();
            this.renderPanel(panel);
        });
        const next = el("button", "sr-secondary", "Skip to next");
        next.addEventListener("click", () => this.settingsActions && this.applyNext());
        actions.append(add, next);
        panel.append(actions);
    }
};

// --- Emojis ---

// Catégories d'emojis de Discord et l'icône de leur onglet
const EMOJI_CATEGORIES = {
    people: "😀", nature: "🐻", food: "🍔", activity: "⚽",
    travel: "🚗", objects: "💡", symbols: "❤️", flags: "🏁"
};

// Utilisée si le module d'emojis de Discord est introuvable
const FALLBACK_EMOJIS = ("😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😛 😜 🤪 😎 🤓 🥳 😏 😴 🤔 🤫 🙄 😬 😮 😱 "
    + "😭 😤 😡 🤯 🥶 🥵 🤒 😈 💀 👻 👽 🤖 💩 👋 👍 👎 👏 🙏 💪 ✌️ 🤞 👀 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ✨ ⭐ 🔥 "
    + "💯 💤 💬 🎉 🎁 🎮 🎧 🎵 🎶 🎬 📺 📚 ✏️ 💻 🖥️ 📱 ☕ 🍕 🍔 🍟 🍿 🍩 🍪 🍺 🍷 🌙 ☀️ 🌈 🌧️ ❄️ 🌸 🌴 🐱 🐶 "
    + "🦊 🐼 🐸 🦄 🚀 ✈️ 🚗 🏠 🏖️ ⚽ 🏀 🏆 💼 💰 🔔 🔒 ⚠️ ✅ ❌ ❓ ❗").split(" ");

let emojiData = null;

function loadEmojiData() {
    if (emojiData) return emojiData;

    // Module interne de Discord qui contient tous les emojis unicode
    const filter = m => typeof m?.getByCategory === "function" && typeof m?.getByName === "function";
    const module = BdApi.Webpack.getModule(filter) ?? BdApi.Webpack.getModule(filter, { searchExports: true });

    const categories = [];
    for (const [id, icon] of Object.entries(EMOJI_CATEGORIES)) {
        let list;
        try { list = module?.getByCategory(id); } catch { list = null; }
        if (!list?.length) continue;
        categories.push({
            id,
            icon,
            emojis: list.map(e => ({
                char: e.surrogates,
                value: e.surrogates,
                name: e.uniqueName ?? e.names?.[0] ?? "",
                names: e.names ?? [],
                url: e.url
            }))
        });
    }

    if (!categories.length) {
        categories.push({
            id: "common",
            icon: "😀",
            emojis: FALLBACK_EMOJIS.map(char => ({ char, value: char, name: "", names: [] }))
        });
    }

    const byChar = new Map();
    for (const category of categories) {
        for (const emoji of category.emojis) byChar.set(emoji.char, emoji);
    }

    emojiData = { categories, byChar, searchable: categories.some(c => c.emojis.some(e => e.names.length)) };
    return emojiData;
}

// Un emoji de serveur est enregistré comme { id, name, animated }, un emoji unicode comme son caractère
function isCustomEmoji(emoji) {
    return typeof emoji === "object" && !!emoji?.id;
}

function hasNitro() {
    return Boolean(BdApi.Webpack.getStore("UserStore")?.getCurrentUser()?.premiumType);
}

// Mêmes règles que Discord : Nitro obligatoire, et l'emoji doit être encore disponible sur son serveur
function canUseCustomEmoji(emoji) {
    if (!hasNitro()) return false;
    const store = BdApi.Webpack.getStore("EmojiStore");
    if (typeof store?.getCustomEmojiById !== "function") return true;
    const found = store.getCustomEmojiById(emoji.id);
    return !!found && found.available !== false;
}

function customEmojiUrl({ id, animated }) {
    return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=48`;
}

// Un onglet par serveur avec ses emojis, aucun sans Nitro
function loadCustomEmojiCategories() {
    if (!hasNitro()) return [];
    const emojiStore = BdApi.Webpack.getStore("EmojiStore");
    const guilds = Object.values(BdApi.Webpack.getStore("GuildStore")?.getGuilds?.() ?? {});

    const categories = [];
    for (const guild of guilds) {
        let list = [];
        try { list = emojiStore?.getGuildEmoji?.(guild.id) ?? []; } catch {}
        const emojis = list.filter(e => e.available !== false).map(e => ({
            char: `:${e.name}:`,
            value: { id: e.id, name: e.name, animated: Boolean(e.animated) },
            name: e.name,
            names: [e.name.toLowerCase()]
        }));
        if (!emojis.length) continue;
        categories.push({
            id: guild.id,
            title: guild.name,
            icon: guild.icon
                ? { url: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=64` }
                : { letters: guild.name.split(/\s+/).map(w => w[0]).join("").slice(0, 3) },
            emojis
        });
    }
    return categories;
}

// Affiche l'emoji avec l'image Discord si disponible (Windows n'affiche pas les drapeaux en texte)
function renderEmoji(value) {
    const custom = isCustomEmoji(value);
    const url = custom ? customEmojiUrl(value) : loadEmojiData().byChar.get(value)?.url;
    if (!url) return el("span", "", value);
    const img = el("img", "sr-emoji-img");
    img.src = url;
    img.alt = custom ? `:${value.name}:` : value;
    img.loading = "lazy";
    return img;
}

// Icône d'onglet : un emoji, l'icône d'un serveur ou ses initiales
function renderIcon(icon) {
    if (typeof icon === "string") return renderEmoji(icon);
    if (icon.url) {
        const img = el("img", "sr-guild-icon");
        img.src = icon.url;
        img.loading = "lazy";
        return img;
    }
    return el("span", "sr-guild-letters", icon.letters);
}

function fillEmojiButton(button, value) {
    button.replaceChildren(renderEmoji(value || "😀"));
    button.classList.toggle("sr-empty", !value);
    // Emoji de serveur sans Nitro (ou retiré du serveur) : grisé, le statut est envoyé sans lui
    const locked = isCustomEmoji(value) && !canUseCustomEmoji(value);
    button.classList.toggle("sr-locked", locked);
    button.title = locked ? "This emoji needs Nitro or is no longer available: the status is set without it" : "Choose an emoji";
}

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}
