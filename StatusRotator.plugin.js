/**
 * @name StatusRotator
 * @author findert
 * @description Automatically rotates between multiple custom statuses at a set interval.
 * @version 1.0.0
 */

// Minimum entre deux changements, pour ne pas se faire rate-limit par Discord
const MIN_INTERVAL = 15;

// Événements que Discord intercepte pour garder le focus dans ses paramètres
const GUARDED_EVENTS = [
    "keydown", "keypress", "keyup", "beforeinput", "paste",
    "mousedown", "pointerdown", "focusin", "focusout"
];

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
.sr-emoji { width: 48px; text-align: center; }
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
        // Le focus-lock des paramètres Discord renvoie le focus vers la recherche des plugins.
        // On intercepte ses événements dès la phase de capture sur window, avant ses listeners.
        // Pour focusout, la cible est l'élément qui perd le focus : on regarde donc relatedTarget.
        this.eventGuard = e => {
            const node = e.type === "focusout" ? e.relatedTarget : e.target;
            if (node?.closest?.(".sr-panel")) e.stopImmediatePropagation();
        };
        for (const type of GUARDED_EVENTS) window.addEventListener(type, this.eventGuard, true);

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
        for (const type of GUARDED_EVENTS) window.removeEventListener(type, this.eventGuard, true);
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
        this.settingsActions.updateAsync("status", s => {
            s.customStatus = (text || emoji)
                ? { text: text ?? "", emojiId: "0", emojiName: emoji ?? "", expiresAtMs: "0" }
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
        // Le focus-lock des paramètres Discord renvoie le focus vers la recherche des plugins :
        // cet attribut indique à react-focus-lock d'ignorer cette zone
        panel.setAttribute("data-no-focus-lock", "true");
        this.renderPanel(panel);
        return panel;
    }

    renderPanel(panel) {
        panel.replaceChildren();

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

            const emoji = el("input", "sr-emoji");
            emoji.placeholder = "😀";
            emoji.value = status.emoji ?? "";
            emoji.addEventListener("change", () => { status.emoji = emoji.value.trim(); this.saveSettings(); });

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

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}
