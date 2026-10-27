/**
 * @name ServerFeed
 * @author findert
 * @description Shows every unread message of the server in one feed, grouped by channel with context, like a timeline. Mark channels as read as you go.
 * @version 1.5.0
 */

const DEFAULT_SETTINGS = {
    hideBots: false,
    hideMuted: true
};

// Salons qui ont des messages : texte, annonces, vocaux et scènes (leur chat)
const MESSAGE_TYPES = new Set([0, 2, 5, 13]);
const VIEW_CHANNEL = 1n << 10n;
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const CONTEXT_SIZE = 3;
const MORE_CONTEXT_SIZE = 10;
const GAP_MINUTES = 10;
const REQUEST_DELAY = 250;
const DISCORD_EPOCH = 1420070400000n;

const STORES = [
    "ChannelStore", "GuildChannelStore", "GuildStore", "SelectedGuildStore", "SelectedChannelStore", "ReadStateStore",
    "UserGuildSettingsStore", "PermissionStore", "GuildMemberStore", "UserStore", "EmojiStore", "GuildRoleStore"
];
const EMOJI_CATEGORIES = {
    people: "😀", nature: "🐻", food: "🍔", activity: "⚽",
    travel: "🚗", objects: "💡", symbols: "❤️", flags: "🏁"
};
const RECENT_LIMIT = 24;

const CSS = `
[data-sf-host] { position: relative; }
.sf-panel {
    position: absolute; inset: 0; z-index: 150; display: flex; flex-direction: column;
    background: var(--background-base-lower, var(--background-primary, #313338)); color: var(--text-normal, #dbdee1);
}
.sf-header {
    flex: none; display: flex; align-items: center; gap: 10px; padding: 10px 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent);
}
.sf-title { font-size: 16px; font-weight: 700; color: var(--header-primary, #f2f3f5); }
.sf-status { flex: 1; min-width: 0; font-size: 13px; color: var(--text-muted, #949ba4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-btn {
    flex: none; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; font-weight: 500;
    color: var(--interactive-active, #fff); background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent);
}
.sf-btn:hover { background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 24%, transparent); }
.sf-btn.sf-primary { background: var(--brand-500, #5865f2); }
.sf-btn.sf-primary:hover { filter: brightness(1.1); }
.sf-btn:disabled { opacity: .5; cursor: default; }
.sf-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 16px; }
.sf-feed { width: 100%; max-width: max(760px, min(1200px, 85%)); margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.sf-empty { text-align: center; color: var(--text-muted, #949ba4); padding: 60px 0; font-size: 15px; }

.sf-card {
    border-radius: 12px; overflow: hidden;
    background: var(--background-base-low, var(--background-secondary, #2b2d31));
    border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 10%, transparent);
}
.sf-card-head {
    display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer;
    border-bottom: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 8%, transparent);
}
.sf-card-head:hover .sf-channel { text-decoration: underline; }
.sf-channel { font-weight: 700; color: var(--header-primary, #f2f3f5); }
.sf-category { font-size: 12px; color: var(--text-muted, #949ba4); }
.sf-count { margin-left: auto; font-size: 12px; font-weight: 600; color: #fff; background: var(--brand-500, #5865f2); border-radius: 10px; padding: 1px 8px; }
.sf-messages { padding: 6px 0; }
.sf-msg { position: relative; display: flex; gap: 10px; padding: 4px 14px; cursor: pointer; }
.sf-msg.sf-replying { background: color-mix(in srgb, var(--brand-500, #5865f2) 12%, transparent); box-shadow: inset 2px 0 0 var(--brand-500, #5865f2); }
.sf-msg-tools {
    position: absolute; top: -6px; right: 14px; display: none; gap: 2px; padding: 2px; border-radius: 6px;
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22)); box-shadow: 0 1px 4px rgba(0,0,0,.3);
}
.sf-msg:hover .sf-msg-tools { display: flex; }
.sf-msg-tools button {
    border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; background: none;
    font-size: 12px; font-weight: 600; color: var(--interactive-active, #fff);
}
.sf-msg-tools button:hover { background: var(--brand-500, #5865f2); }
.sf-reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.sf-reaction {
    display: flex; align-items: center; gap: 4px; border-radius: 8px; padding: 2px 6px; cursor: pointer; font-size: 13px; font-weight: 600;
    color: var(--interactive-normal, #b5bac1); background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
    border: 1px solid transparent;
}
.sf-reaction:hover { border-color: color-mix(in srgb, var(--interactive-normal, #b5bac1) 30%, transparent); }
.sf-reaction.sf-me { color: var(--interactive-active, #fff); background: color-mix(in srgb, var(--brand-500, #5865f2) 25%, transparent); border-color: var(--brand-500, #5865f2); }
.sf-reaction img, .sf-picker img { width: 18px; height: 18px; object-fit: contain; }
.sf-reaction-add { opacity: 0; }
.sf-msg:hover .sf-reaction-add { opacity: 1; }

.sf-picker {
    position: fixed; z-index: 1000; width: 420px; height: 400px; display: flex; flex-direction: column; overflow: hidden;
    border-radius: 10px; background: var(--background-base-low, var(--background-secondary, #2b2d31));
    box-shadow: 0 8px 24px rgba(0,0,0,.45); border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 12%, transparent);
}
.sf-picker-search {
    margin: 8px; border: none; outline: none; border-radius: 6px; padding: 6px 10px; font: inherit; font-size: 14px;
    color: var(--text-normal, #dbdee1); background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sf-picker-main { flex: 1; min-height: 0; display: flex; }
.sf-picker-tabs {
    flex: none; width: 52px; overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
    display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px 0;
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sf-picker-tabs::-webkit-scrollbar { display: none; }
.sf-picker-body { scrollbar-width: thin; scrollbar-color: var(--scrollbar-thin-thumb, #1a1b1e) transparent; }
.sf-picker-body::-webkit-scrollbar { width: 8px; }
.sf-picker-body::-webkit-scrollbar-thumb { border-radius: 4px; background: var(--scrollbar-thin-thumb, #1a1b1e); }
.sf-picker-tabs button { width: 36px; height: 36px; min-width: 36px; min-height: 36px; flex: none; border: none; border-radius: 50%; padding: 0; cursor: pointer; background: none; opacity: .6; font-size: 18px; overflow: hidden; color: var(--text-normal, #dbdee1); }
.sf-picker-tabs button.sf-active, .sf-picker-tabs button:hover { opacity: 1; background: var(--background-modifier-selected, #404249); }
.sf-picker-tabs button img { display: block; width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
.sf-picker-tabs .sf-letter { font-size: 11px; font-weight: 700; }
.sf-picker-body { flex: 1; min-width: 0; overflow-y: auto; padding: 4px 8px 8px; }
.sf-picker-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #949ba4); margin: 6px 2px 4px; }
.sf-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, 36px); gap: 2px; }
.sf-picker-grid button { width: 36px; height: 36px; border: none; border-radius: 6px; padding: 0; cursor: pointer; background: none; font-size: 22px; }
.sf-picker-grid button:hover { background: var(--background-modifier-hover, #393c41); }
.sf-picker-grid button img { width: 28px; height: 28px; }
.sf-picker-empty { color: var(--text-muted, #949ba4); padding: 12px 4px; font-size: 13px; }
.sf-text .sf-mention[data-action] { cursor: pointer; }
.sf-text .sf-mention[data-action]:hover { background: var(--brand-500, #5865f2); color: #fff; }

.sf-suggest {
    position: fixed; z-index: 1000; max-height: 300px; overflow-y: auto; padding: 6px; border-radius: 8px;
    background: var(--background-base-low, var(--background-secondary, #2b2d31)); box-shadow: 0 8px 24px rgba(0,0,0,.45);
    border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 12%, transparent);
}
.sf-suggest-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #949ba4); padding: 2px 6px 6px; }
.sf-suggest-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; cursor: pointer; font-size: 14px; color: var(--text-normal, #dbdee1); }
.sf-suggest-item.sf-active { background: var(--background-modifier-selected, #404249); }
.sf-suggest-item img { width: 24px; height: 24px; border-radius: 50%; flex: none; }
.sf-suggest-item .sf-role-dot { width: 12px; height: 12px; border-radius: 50%; flex: none; margin: 0 6px; }
.sf-suggest-item .sf-channel-icon { width: 24px; text-align: center; flex: none; font-size: 16px; color: var(--text-muted, #949ba4); }
.sf-suggest-item small { margin-left: auto; color: var(--text-muted, #949ba4); font-size: 12px; }
.sf-msg:hover { background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 6%, transparent); }
.sf-msg.sf-grouped { padding-top: 0; }
.sf-msg.sf-grouped .sf-avatar { visibility: hidden; height: 0; }
.sf-msg.sf-context { opacity: .5; }
.sf-avatar { width: 32px; height: 32px; border-radius: 50%; flex: none; cursor: pointer; }
.sf-body { flex: 1; min-width: 0; }
.sf-meta { display: flex; align-items: baseline; gap: 8px; }
.sf-author { font-weight: 600; font-size: 14px; color: var(--header-primary, #f2f3f5); cursor: pointer; }
.sf-author:hover { text-decoration: underline; }
.sf-bot { font-size: 10px; font-weight: 700; color: #fff; background: var(--brand-500, #5865f2); border-radius: 3px; padding: 0 4px; }
.sf-time { font-size: 11px; color: var(--text-muted, #949ba4); }
.sf-text { font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word; }
.sf-text a { color: var(--text-link, #00a8fc); }
.sf-text .sf-mention { color: var(--mention-foreground, #c9cdfb); background: var(--mention-background, rgba(88,101,242,.3)); border-radius: 3px; padding: 0 2px; }
.sf-text .sf-emoji { width: 20px; height: 20px; vertical-align: -5px; }
.sf-text .sf-h { font-weight: 700; line-height: 1.25; margin: 6px 0 2px; color: var(--header-primary, #f2f3f5); }
.sf-text .sf-h1 { font-size: 22px; }
.sf-text .sf-h2 { font-size: 18px; }
.sf-text .sf-h3 { font-size: 16px; }
.sf-text .sf-subtext { font-size: 12px; color: var(--text-muted, #949ba4); }
.sf-text .sf-quote { border-left: 4px solid var(--background-modifier-accent, #4e5058); padding-left: 10px; margin: 2px 0; }
.sf-text .sf-li { display: flex; gap: 6px; }
.sf-text .sf-bullet { flex: none; min-width: 10px; }
.sf-text .sf-code, .sf-text .sf-codeblock {
    font-family: var(--font-code, Consolas, "Courier New", monospace); font-size: 85%;
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sf-text .sf-code { padding: 1px 4px; border-radius: 4px; }
.sf-text .sf-codeblock {
    display: block; margin: 4px 0; padding: 8px 10px; border-radius: 6px; white-space: pre-wrap; overflow-x: auto;
    border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 12%, transparent);
}
.sf-text .sf-spoiler { border-radius: 3px; cursor: pointer; background: var(--background-base-lowest, #1e1f22); color: transparent; }
.sf-text .sf-spoiler:not(.sf-revealed) * { visibility: hidden; }
.sf-text .sf-spoiler.sf-revealed { cursor: auto; color: inherit; background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 15%, transparent); }
.sf-text .sf-timestamp { border-radius: 3px; padding: 0 2px; background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 12%, transparent); }
.sf-edited { font-size: 10px; color: var(--text-muted, #949ba4); }
.sf-deleted .sf-text { text-decoration: line-through; opacity: .6; }
.sf-reply { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted, #949ba4); margin-bottom: 2px; min-width: 0; }
.sf-reply span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-reply b { font-weight: 600; color: var(--interactive-normal, #b5bac1); }
.sf-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.sf-attachments img, .sf-attachments video { max-width: min(400px, 100%); max-height: 300px; border-radius: 6px; cursor: zoom-in; }
.sf-attachments video.sf-video { max-width: 400px; max-height: 260px; cursor: auto; background: #000; }
.sf-viewer {
    position: fixed; inset: 0; z-index: 1001; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    background: rgba(0,0,0,.85);
}
.sf-viewer img, .sf-viewer video { max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: 4px; }
.sf-viewer-bar { display: flex; align-items: center; gap: 14px; font-size: 14px; color: #dbdee1; }
.sf-viewer-bar a { color: #dbdee1; opacity: .8; text-decoration: none; }
.sf-viewer-bar a:hover { opacity: 1; text-decoration: underline; }
.sf-viewer-nav {
    position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border: none; border-radius: 50%; cursor: pointer;
    font-size: 22px; color: #fff; background: rgba(0,0,0,.5);
}
.sf-viewer-nav:hover { background: rgba(0,0,0,.8); }
.sf-viewer-prev { left: 24px; }
.sf-viewer-next { right: 24px; }
.sf-file { font-size: 13px; color: var(--text-link, #00a8fc); }
.sf-separator {
    display: flex; align-items: center; gap: 8px; padding: 4px 14px; font-size: 11px; font-weight: 600;
    color: var(--text-muted, #949ba4);
}
.sf-separator::before, .sf-separator::after { content: ""; flex: 1; height: 1px; background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent); }
.sf-separator.sf-new { color: var(--status-danger, #f23f43); }
.sf-separator.sf-new::before, .sf-separator.sf-new::after { background: var(--status-danger, #f23f43); opacity: .6; }
.sf-composer { padding: 6px 14px 0; }
.sf-replybar {
    display: flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 12px; border-radius: 8px 8px 0 0;
    color: var(--text-muted, #949ba4); background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sf-replybar b { color: var(--interactive-normal, #b5bac1); }
.sf-replybar span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-replybar button { border: none; background: none; cursor: pointer; color: inherit; font-size: 14px; padding: 0 2px; }
.sf-replybar button:hover { color: var(--interactive-active, #fff); }
.sf-input-row { display: flex; gap: 8px; align-items: flex-end; }
.sf-input-row .sf-emoji-btn { font-size: 18px; padding: 3px 10px; }
.sf-input, .sf-edit-input {
    flex: 1; min-width: 0; resize: none; max-height: 140px; border: none; outline: none; border-radius: 8px; padding: 8px 10px;
    font: inherit; font-size: 14px; line-height: 1.35; color: var(--text-normal, #dbdee1);
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sf-replybar + .sf-input-row .sf-input { border-top-left-radius: 0; border-top-right-radius: 0; }
.sf-own .sf-author { color: var(--brand-360, #949cf7); }
.sf-msg.sf-mentioned { background: var(--background-mentioned, rgba(240, 177, 50, .1)); box-shadow: inset 2px 0 0 var(--info-warning-foreground, #f0b232); }
.sf-msg.sf-mentioned:hover { background: var(--background-mentioned-hover, rgba(240, 177, 50, .14)); }
.sf-card.sf-has-mention { border-color: color-mix(in srgb, var(--info-warning-foreground, #f0b232) 55%, transparent); }
.sf-mention-badge { font-size: 12px; font-weight: 700; color: #fff; background: var(--status-danger, #f23f43); border-radius: 10px; padding: 1px 7px; }
.sf-stickers { display: flex; gap: 6px; margin-top: 4px; }
.sf-sticker { width: 160px; height: 160px; object-fit: contain; }
.sf-lottie:not(.sf-ready) { width: auto; height: auto; }
.sf-edit { margin-top: 4px; cursor: auto; }
.sf-edit-input { display: block; width: 100%; box-sizing: border-box; }
.sf-edit-hint { font-size: 12px; color: var(--text-muted, #949ba4); margin-top: 3px; }
.sf-edit-hint span { color: var(--text-link, #00a8fc); cursor: pointer; }
.sf-card-actions {
    display: flex; gap: 8px; padding: 8px 14px; justify-content: flex-end;
    border-top: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 8%, transparent);
}
.sf-card-actions .sf-btn { padding: 4px 10px; font-size: 12px; }

.sf-toggle {
    flex: none; align-self: center; margin: 0 8px; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer;
    font-size: 13px; font-weight: 600; white-space: nowrap; color: #fff; background: var(--brand-500, #5865f2);
}
.sf-toggle:hover { filter: brightness(1.1); }
/* Si la barre de Discord n'est pas trouvée, le bouton flotte en haut à droite */
.sf-toggle.sf-floating { position: absolute; top: 10px; right: 16px; z-index: 40; margin: 0; }

.sf-settings { color: var(--text-normal); display: flex; flex-direction: column; gap: 12px; }
.sf-settings label { display: flex; align-items: center; gap: 8px; }
.sf-hint { color: var(--text-muted, #949ba4); font-size: 13px; }
`;

module.exports = class ServerFeed {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        const { Webpack } = BdApi;
        this.settings = { ...DEFAULT_SETTINGS, ...BdApi.Data.load(this.meta.name, "settings") };
        this.stores = Object.fromEntries(STORES.map(name => [name, Webpack.getStore(name)]));
        this.dispatcher = this.stores.UserStore?._dispatcher;
        // Module de Discord qui fait les requêtes à son API (avec ton compte déjà connecté)
        // (on écarte « superagent », la librairie brute qui a les mêmes fonctions mais sans l'adresse de l'API)
        this.http = Webpack.getByKeys("getAPIBaseURL", "get")
            ?? Webpack.getModule(m => typeof m?.get === "function" && typeof m?.post === "function"
                && typeof m?.put === "function" && typeof m?.patch === "function" && typeof m?.del === "function"
                && !m.Request && !m.agent,
            { searchExports: true });
        this.ackActions = Webpack.getByKeys("ack", "bulkAck") ?? Webpack.getByKeys("ack", "localAck");
        this.transitionTo = Webpack.getByStrings("transitionTo - Transitioning to", { searchExports: true })
            ?? Webpack.getByKeys("transitionTo")?.transitionTo;
        this.profileActions = Webpack.getByKeys("openUserProfileModal");
        this.memberActions = Webpack.getByKeys("requestMembersById");

        if (!this.dispatcher || !this.http || !this.stores.ReadStateStore) {
            BdApi.UI.showToast("ServerFeed: Discord modules not found", { type: "error" });
            return;
        }
        BdApi.DOM.addStyle(this.meta.name, CSS);

        this.open = false;
        this.cards = new Map();

        // Un seul panneau, rempli en HTML : un listener délégué gère tous les clics
        this.panel = document.createElement("div");
        this.panel.className = "sf-panel";
        this.panel.addEventListener("click", e => this.onClick(e));
        this.panel.addEventListener("input", e => this.onInput(e));
        this.panel.addEventListener("keydown", e => this.onKeyDown(e));
        this.panel.addEventListener("focusout", e => {
            if (this.suggest?.input === e.target) this.closeSuggestions();
        });
        this.drafts = new Map();
        this.replyTo = new Map();

        this.onMessageCreate = action => this.addLiveMessage(action);
        this.onMessageUpdate = action => this.updateMessage(action.message);
        this.onMessageDelete = action => this.deleteMessage(action.channelId, action.id);
        this.onReactionAdd = action => this.applyReaction(action, 1);
        this.onMembers = action => {
            if (action.guildId !== this.guildId) return;
            this.render();
            if (this.suggest) this.updateSuggestions(this.suggest.input, false);
        };
        this.onReactionRemove = action => this.applyReaction(action, -1);
        // Ouvrir un salon (ou changer de serveur) ferme le fil
        this.onChannelChange = () => {
            if (this.open && this.stores.SelectedChannelStore?.getChannelId() !== this.openedChannel) this.close();
        };
        this.stores.SelectedChannelStore?.addChangeListener?.(this.onChannelChange);

        this.onKey = e => {
            if (e.ctrlKey && e.shiftKey && e.code === "KeyF") {
                e.preventDefault();
                this.toggle();
            }
        };
        document.addEventListener("keydown", this.onKey);

        // Le bouton « Feed » est ajouté dans la barre de ChannelGrid, recréée régulièrement
        this.observer = new MutationObserver(() => this.schedule());
        this.observer.observe(document.getElementById("app-mount") ?? document.body, { childList: true, subtree: true });
        this.schedule();
    }

    stop() {
        this.observer?.disconnect();
        if (this.frame) cancelAnimationFrame(this.frame);
        this.frame = 0;
        document.removeEventListener("keydown", this.onKey);
        this.stores?.SelectedChannelStore?.removeChangeListener?.(this.onChannelChange);
        this.close();
        document.querySelectorAll(".sf-toggle").forEach(node => node.remove());
        document.querySelectorAll("[data-sf-host]").forEach(node => node.removeAttribute("data-sf-host"));
        BdApi.DOM.removeStyle(this.meta.name);
    }

    schedule() {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            this.ensure();
        });
    }

    // --- Insertion dans la page ---

    // La zone du chat est la voisine de la barre latérale qui contient la liste des salons
    getHost() {
        return document.getElementById("channels")?.closest('[class*="sidebar_"]')?.nextElementSibling ?? null;
    }

    ensure() {
        const host = this.getHost();
        this.ensureButton(host);

        if (!this.open) return;
        if (!host) {
            this.close();
            return;
        }
        if (this.panel.parentElement !== host) {
            this.host?.removeAttribute("data-sf-host");
            this.host = host;
            host.setAttribute("data-sf-host", "");
            host.append(this.panel);
        }
        // Le panneau commence sous l'en-tête du salon, pour garder le bouton Feed accessible
        const bar = host.querySelector('[class*="toolbar_"]')?.closest("section");
        const top = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom - host.getBoundingClientRect().top)) : 0;
        if (this.panel.style.top !== `${top}px`) this.panel.style.top = `${top}px`;
    }

    // Le bouton « Feed » va en haut à droite de la zone des messages, avec les icônes de Discord.
    // Discord recrée cette barre en changeant de salon : on le remet à chaque fois
    ensureButton(host) {
        const toolbar = host?.querySelector('section [class*="toolbar_"]') ?? host?.querySelector('[class*="toolbar_"]');
        const button = this.button ??= this.createButton();
        if (toolbar) {
            if (button.parentElement !== toolbar) toolbar.prepend(button);
            button.classList.remove("sf-floating");
        }
        else if (host) {
            if (button.parentElement !== host) host.append(button);
            host.setAttribute("data-sf-host", "");
            button.classList.add("sf-floating");
        }
        else button.remove();
    }

    createButton() {
        const button = document.createElement("button");
        button.className = "sf-toggle";
        button.textContent = "☰ Feed";
        button.title = "Server feed (Ctrl+Shift+F)";
        button.addEventListener("click", () => this.toggle());
        return button;
    }

    toggle() {
        if (this.open) this.close();
        else this.show();
    }

    show() {
        if (!this.getHost()) {
            BdApi.UI.showToast("ServerFeed: open a server first", { type: "info" });
            return;
        }
        this.open = true;
        this.openedChannel = this.stores.SelectedChannelStore?.getChannelId();
        this.dispatcher.subscribe("MESSAGE_CREATE", this.onMessageCreate);
        this.dispatcher.subscribe("MESSAGE_UPDATE", this.onMessageUpdate);
        this.dispatcher.subscribe("MESSAGE_DELETE", this.onMessageDelete);
        this.dispatcher.subscribe("MESSAGE_REACTION_ADD", this.onReactionAdd);
        this.dispatcher.subscribe("GUILD_MEMBERS_CHUNK", this.onMembers);
        this.dispatcher.subscribe("MESSAGE_REACTION_REMOVE", this.onReactionRemove);
        this.ensure();
        this.refresh();
    }

    close() {
        if (!this.open) return;
        this.open = false;
        this.loadId = (this.loadId ?? 0) + 1;
        this.dispatcher?.unsubscribe("MESSAGE_CREATE", this.onMessageCreate);
        this.dispatcher?.unsubscribe("MESSAGE_UPDATE", this.onMessageUpdate);
        this.dispatcher?.unsubscribe("MESSAGE_DELETE", this.onMessageDelete);
        this.dispatcher?.unsubscribe("MESSAGE_REACTION_ADD", this.onReactionAdd);
        this.dispatcher?.unsubscribe("GUILD_MEMBERS_CHUNK", this.onMembers);
        this.dispatcher?.unsubscribe("MESSAGE_REACTION_REMOVE", this.onReactionRemove);
        this.closePicker();
        this.closeViewer();
        this.closeSuggestions();
        this.editing = null;
        this.panel?.remove();
        this.host?.removeAttribute("data-sf-host");
        this.host = null;
        this.schedule();
    }

    // --- Chargement des non-lus ---

    getUnreadChannels(guildId) {
        const { GuildChannelStore, ReadStateStore, PermissionStore } = this.stores;
        const lists = GuildChannelStore?.getChannels?.(guildId) ?? {};
        return [...(lists.SELECTABLE ?? []), ...(lists.VOCAL ?? [])]
            .map(entry => entry.channel)
            .filter(channel => channel && MESSAGE_TYPES.has(channel.type)
                && PermissionStore?.can?.(VIEW_CHANNEL, channel) !== false
                && ReadStateStore.hasUnread?.(channel.id)
                && !(this.settings.hideMuted && this.isMuted(channel)));
    }

    // Un salon est en sourdine directement, ou parce que sa catégorie l'est
    isMuted(channel) {
        const { UserGuildSettingsStore } = this.stores;
        const guildId = channel.guild_id;
        return Boolean(UserGuildSettingsStore?.isChannelMuted?.(guildId, channel.id)
            || (channel.parent_id && UserGuildSettingsStore?.isChannelMuted?.(guildId, channel.parent_id)));
    }

    // Recharge tout le fil : pour chaque salon non lu, les messages depuis la dernière lecture
    // et quelques messages déjà lus juste avant, pour le contexte
    async refresh() {
        const loadId = this.loadId = (this.loadId ?? 0) + 1;
        this.guildId = this.stores.SelectedGuildStore?.getGuildId();
        this.cards = new Map();
        if (!this.guildId) return;

        const channels = this.getUnreadChannels(this.guildId);
        this.loading = { done: 0, total: channels.length };
        this.render();

        for (const channel of channels) {
            if (loadId !== this.loadId) return;
            try {
                await this.loadChannel(channel);
            } catch (error) {
                console.error(`[${this.meta.name}] couldn't load #${channel.name}`, error);
                this.reportError(`couldn't load #${channel.name}`, error);
            }
            this.loading.done++;
            this.render();
        }
        if (loadId === this.loadId) {
            // Ordre figé une fois le chargement fini : du salon le plus récemment actif au plus ancien
            const sorted = [...this.cards.values()].sort((a, b) => compareIds(b.unread[b.unread.length - 1], a.unread[a.unread.length - 1]));
            sorted.forEach((card, index) => card.order = index);
            this.lastOrder = sorted.length;
            this.loading = null;
            this.render();
        }
    }

    async loadChannel(channel) {
        const ackId = this.stores.ReadStateStore.ackMessageId?.(channel.id) ?? null;
        const card = this.getCard(channel.id);

        // Messages non lus, du plus ancien au plus récent
        let after = ackId ?? "0";
        for (let page = 0; page < MAX_PAGES; page++) {
            const batch = await this.fetchMessages(channel.id, ackId || page ? { after } : {});
            if (!batch.length) break;
            card.unread.push(...batch);
            after = batch[batch.length - 1].id;
            card.truncated = batch.length === PAGE_SIZE && page === MAX_PAGES - 1;
            if (batch.length < PAGE_SIZE || !ackId) break;
        }
        card.unread = dedupe(card.unread);
        if (!card.unread.length) {
            this.cards.delete(channel.id);
            return;
        }

        // Quelques messages déjà lus juste avant le premier non lu
        card.context = await this.fetchMessages(channel.id, { before: card.unread[0].id }, CONTEXT_SIZE);
    }

    // Les messages arrivent du plus récent au plus ancien : on les remet dans l'ordre
    async fetchMessages(channelId, query, limit = PAGE_SIZE) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const response = await this.http.get({
                    url: `/channels/${channelId}/messages`,
                    query: { ...query, limit }
                });
                await wait(REQUEST_DELAY);
                const messages = Array.isArray(response?.body) ? response.body : JSON.parse(response?.text ?? "null");
                if (!Array.isArray(messages)) throw new Error("unexpected answer from Discord");
                return messages.slice().sort(compareIds);
            } catch (error) {
                // Trop de requêtes : on attend le délai demandé par Discord puis on réessaie
                if (error?.status !== 429) throw error;
                await wait(((error.body?.retry_after ?? 1) * 1000) + 100);
            }
        }
        return [];
    }

    getCard(channelId) {
        let card = this.cards.get(channelId);
        if (!card) {
            // Les cartes gardent leur place : une carte qui apparaît après le chargement va en bas
            card = { channelId, unread: [], context: [], truncated: false, order: this.loading ? null : (this.lastOrder = (this.lastOrder ?? 0) + 1) };
            this.cards.set(channelId, card);
        }
        return card;
    }

    // --- Messages en direct ---

    addLiveMessage({ guildId, channelId, message, optimistic }) {
        if (optimistic || !message || this.loading) return;
        const channel = this.stores.ChannelStore?.getChannel?.(channelId ?? message.channel_id);
        if (!channel || (guildId ?? channel.guild_id) !== this.guildId || !MESSAGE_TYPES.has(channel.type)) return;
        if (this.settings.hideMuted && this.isMuted(channel)) return;
        const own = message.author?.id === this.stores.UserStore?.getCurrentUser?.()?.id;
        if (own && !this.cards.has(channel.id)) return;

        // Un salon déjà marqué lu repart avec les derniers messages lus comme contexte
        const isNew = !this.cards.has(channel.id);
        const card = this.getCard(channel.id);
        if (isNew) card.context = (this.readHistory?.get(channel.id) ?? []).slice(-CONTEXT_SIZE);
        if (card.unread.some(existing => existing.id === message.id)) return;
        card.unread.push(message);
        this.render();
    }

    updateMessage(message) {
        const card = message && this.cards.get(message.channel_id);
        const existing = card && [...card.unread, ...card.context].find(item => item.id === message.id);
        if (!existing) return;
        Object.assign(existing, message);
        this.render();
    }

    deleteMessage(channelId, id) {
        const card = this.cards.get(channelId);
        const existing = card && [...card.unread, ...card.context].find(item => item.id === id);
        if (!existing) return;
        existing.sfDeleted = true;
        this.render();
    }

    // --- Actions ---

    async loadMoreContext(channelId) {
        const card = this.cards.get(channelId);
        const first = card?.context[0] ?? card?.unread[0];
        if (!first) return;
        try {
            const older = await this.fetchMessages(channelId, { before: first.id }, MORE_CONTEXT_SIZE);
            card.context = dedupe([...older, ...card.context]);
            this.lastHtml = "";
            this.render();
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't load more context`, error);
            this.reportError("couldn't load more context", error);
        }
    }

    // Une seule notification par chargement, pour ne pas en afficher une par salon
    reportError(text, error) {
        if (this.errorShown === this.loadId) return;
        this.errorShown = this.loadId;
        const reason = error?.status ? `HTTP ${error.status}` : error?.message ?? String(error);
        BdApi.UI.showToast(`ServerFeed: ${text} (${reason})`, { type: "error" });
    }

    async loadMoreUnread(channelId) {
        const card = this.cards.get(channelId);
        const last = card?.unread[card.unread.length - 1];
        if (!last) return;
        const batch = await this.fetchMessages(channelId, { after: last.id });
        card.unread = dedupe([...card.unread, ...batch]);
        card.truncated = batch.length === PAGE_SIZE;
        this.render();
    }

    // Marque le salon comme lu dans Discord (pastilles comprises) et retire sa carte du fil
    async markRead(channelId) {
        const card = this.cards.get(channelId);
        if (!card) return;
        const last = card.unread[card.unread.length - 1];

        this.readHistory ??= new Map();
        this.readHistory.set(channelId, [...card.context, ...card.unread].filter(m => !m.sfDeleted));
        this.cards.delete(channelId);
        this.render();

        try {
            if (this.ackActions?.ack) this.ackActions.ack(channelId);
            else await this.http.post({ url: `/channels/${channelId}/messages/${last.id}/ack`, body: { token: null } });
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't mark #${channelId} as read`, error);
            BdApi.UI.showToast("ServerFeed: couldn't mark this channel as read", { type: "error" });
        }
    }

    async markAllRead() {
        for (const channelId of [...this.cards.keys()]) await this.markRead(channelId);
    }

    jumpTo(channelId, messageId, guildId = this.guildId) {
        this.close();
        this.transitionTo?.(`/channels/${guildId}/${channelId}${messageId ? `/${messageId}` : ""}`);
    }

    openProfile(userId) {
        try {
            this.profileActions?.openUserProfileModal({
                userId, guildId: this.guildId, analyticsLocation: { section: "Server Feed" }
            });
        } catch {
            BdApi.UI.showToast("ServerFeed: couldn't open this profile", { type: "error" });
        }
    }

    onClick(e) {
        // Un lien dans un message s'ouvre normalement, sans aller au salon
        if (e.target.closest("a")) return;
        const action = e.target.closest("[data-action]");
        if (!action) return;
        e.stopPropagation();
        const { action: name, channel, message, user } = action.dataset;

        if (name === "spoiler") action.classList.add("sf-revealed");
        else if (name === "image") this.openViewer(channel, message, Number(action.dataset.index));
        else if (name === "close") this.close();
        else if (name === "refresh") this.refresh();
        else if (name === "read-all") this.markAllRead();
        else if (name === "read") this.markRead(channel);
        else if (name === "context") this.loadMoreContext(channel);
        else if (name === "more") this.loadMoreUnread(channel);
        else if (name === "profile") this.openProfile(user);
        else if (name === "jump") this.jumpTo(channel, message, action.dataset.guild);
        else if (name === "reply") this.startReply(channel, message);
        else if (name === "cancel-reply") this.cancelReply(channel);
        else if (name === "edit") this.startEdit(channel, message);
        else if (name === "cancel-edit") this.cancelEdit();
        else if (name === "save-edit") this.saveEdit();
        else if (name === "send") this.send(channel);
        else if (name === "emoji") {
            const input = this.panel.querySelector(`.sf-input[data-channel="${channel}"]`);
            // On retient la position du curseur avant que le sélecteur prenne le focus
            const range = input ? [input.selectionStart, input.selectionEnd] : null;
            this.openPicker(action, `input:${channel}`, emoji => this.insertEmoji(channel, emoji, range));
        }
        else if (name === "react") this.toggleReaction(channel, message, JSON.parse(action.dataset.emoji));
        else if (name === "add-reaction") {
            try {
                this.openPicker(action, `react:${message}`, emoji => this.toggleReaction(channel, message, emoji));
            } catch (error) {
                console.error(`[${this.meta.name}] couldn't open the emoji picker`, error);
                BdApi.UI.showToast(`ServerFeed: couldn't open the emoji picker (${error?.message ?? error})`, { type: "error" });
            }
        }
    }

    // --- Visionneuse d'images ---

    // Comme Discord : l'image s'ouvre en grand, avec les flèches s'il y en a plusieurs dans le message
    openViewer(channelId, messageId, index) {
        const message = this.findMessage(channelId, messageId);
        const images = message ? getImages(message) : [];
        if (!images.length) return;
        this.closeViewer();

        const viewer = el("div", "sf-viewer");
        let img = el("img");
        const bar = el("div", "sf-viewer-bar");
        const counter = el("span");
        const link = el("a", "", "Open in Browser");
        link.target = "_blank";
        link.rel = "noreferrer";
        bar.append(counter, link);
        viewer.append(img, bar);

        let current = Math.min(Math.max(0, index || 0), images.length - 1);
        const show = step => {
            current = (current + step + images.length) % images.length;
            const media = el(images[current].video ? "video" : "img");
            if (images[current].video) Object.assign(media, { autoplay: true, loop: true, muted: true, playsInline: true });
            media.src = images[current].full;
            img.replaceWith(media);
            img = media;
            link.href = images[current].original;
            counter.textContent = images.length > 1 ? `${current + 1} / ${images.length}` : "";
        };
        if (images.length > 1) {
            for (const [className, step, text] of [["sf-viewer-prev", -1, "‹"], ["sf-viewer-next", 1, "›"]]) {
                const button = el("button", `sf-viewer-nav ${className}`, text);
                button.addEventListener("click", e => {
                    e.stopPropagation();
                    show(step);
                });
                viewer.append(button);
            }
        }
        show(0);

        // Un clic à côté de l'image (ou Échap) ferme la visionneuse
        viewer.addEventListener("click", e => {
            if (e.target === viewer) this.closeViewer();
        });
        const onKey = e => {
            if (!["Escape", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "Escape") this.closeViewer();
            else if (images.length > 1) show(e.key === "ArrowLeft" ? -1 : 1);
        };
        document.addEventListener("keydown", onKey, true);
        document.body.append(viewer);
        this.viewer = { element: viewer, onKey };
    }

    closeViewer() {
        if (!this.viewer) return;
        document.removeEventListener("keydown", this.viewer.onKey, true);
        this.viewer.element.remove();
        this.viewer = null;
    }

    // --- Réactions ---

    // Ajoute ou retire une réaction quand Discord nous l'annonce (la nôtre comme celles des autres)
    applyReaction({ channelId, messageId, userId, emoji }, delta) {
        const message = this.findMessage(channelId, messageId);
        if (!message || !emoji) return;
        const mine = userId === this.stores.UserStore?.getCurrentUser?.()?.id;
        const reactions = message.reactions ??= [];
        let reaction = reactions.find(item => sameEmoji(item.emoji, emoji));
        if (!reaction) {
            if (delta < 0) return;
            reaction = { emoji: { id: emoji.id ?? null, name: emoji.name, animated: Boolean(emoji.animated) }, count: 0, me: false };
            reactions.push(reaction);
        }
        // On ignore un évènement déjà appliqué (le nôtre est affiché dès le clic)
        if (mine && reaction.me === delta > 0) return;
        reaction.count = Math.max(0, reaction.count + delta);
        if (mine) reaction.me = delta > 0;
        if (!reaction.count) reactions.splice(reactions.indexOf(reaction), 1);
        this.render();
    }

    async toggleReaction(channelId, messageId, emoji) {
        const message = this.findMessage(channelId, messageId);
        if (!message) return;
        const remove = Boolean(message.reactions?.find(item => sameEmoji(item.emoji, emoji))?.me);
        const me = this.stores.UserStore?.getCurrentUser?.()?.id;
        this.applyReaction({ channelId, messageId, userId: me, emoji }, remove ? -1 : 1);
        if (!remove) this.rememberEmoji(emoji);

        const code = encodeURIComponent(emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name);
        const url = `/channels/${channelId}/messages/${messageId}/reactions/${code}/@me`;
        try {
            await (remove ? this.http.del({ url }) : this.http.put({ url, query: { location: "Message", type: 0 } }));
        } catch (error) {
            // Échec : on annule l'affichage
            this.applyReaction({ channelId, messageId, userId: me, emoji }, remove ? 1 : -1);
            console.error(`[${this.meta.name}] couldn't react`, error);
            BdApi.UI.showToast(`ServerFeed: couldn't react (${error?.body?.message ?? error?.message ?? error?.status ?? error})`, { type: "error" });
        }
    }

    rememberEmoji(emoji) {
        const recent = (BdApi.Data.load(this.meta.name, "recentEmojis") ?? []).filter(item => !sameEmoji(item, emoji));
        recent.unshift({ id: emoji.id ?? null, name: emoji.name, animated: Boolean(emoji.animated) });
        BdApi.Data.save(this.meta.name, "recentEmojis", recent.slice(0, RECENT_LIMIT));
    }

    // --- Sélecteur d'emoji ---

    // Emojis unicode (module interne de Discord) et emojis de tous tes serveurs (Nitro : utilisables partout)
    getEmojiGroups() {
        const groups = [];
        const recent = BdApi.Data.load(this.meta.name, "recentEmojis") ?? [];
        if (recent.length) groups.push({ id: "recent", icon: { text: "🕘" }, title: "Recently used", emojis: recent });

        const user = this.stores.UserStore?.getCurrentUser?.();
        const nitro = Boolean(user?.premiumType);
        const guilds = Object.values(this.stores.GuildStore?.getGuilds?.() ?? {})
            .sort((a, b) => (b.id === this.guildId) - (a.id === this.guildId));
        for (const guild of guilds) {
            if (!nitro && guild.id !== this.guildId) continue;
            let emojis = [];
            try { emojis = this.stores.EmojiStore?.getGuildEmoji?.(guild.id) ?? []; } catch {}
            emojis = emojis.filter(emoji => emoji.available !== false && (nitro || !emoji.animated))
                .map(emoji => ({ id: emoji.id, name: emoji.name, animated: Boolean(emoji.animated) }));
            if (!emojis.length) continue;
            groups.push({
                id: guild.id,
                icon: guild.icon ? { url: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=64` } : { letters: guild.name },
                title: guild.name,
                emojis
            });
        }

        for (const category of loadUnicodeEmojis()) groups.push(category);
        return groups;
    }

    openPicker(button, key, onPick) {
        const reopening = this.picker?.key === key;
        this.closePicker();
        if (reopening) return;

        const groups = this.getEmojiGroups();
        const picker = el("div", "sf-picker");
        const search = el("input", "sf-picker-search");
        search.placeholder = "Search emoji";
        const main = el("div", "sf-picker-main");
        const tabs = el("div", "sf-picker-tabs");
        const body = el("div", "sf-picker-body");
        main.append(tabs, body);
        picker.append(search, main);

        const pick = emoji => {
            this.closePicker();
            onPick(emoji);
        };
        const grid = emojis => {
            const node = el("div", "sf-picker-grid");
            for (const emoji of emojis) {
                const item = el("button");
                item.title = `:${emoji.label ?? emoji.name}:`;
                item.innerHTML = emojiHtml(emoji);
                item.addEventListener("click", () => pick(emoji));
                node.append(item);
            }
            return node;
        };
        const showGroup = group => {
            body.replaceChildren(el("div", "sf-picker-title", group.title), grid(group.emojis));
            body.scrollTop = 0;
            tabs.querySelectorAll("button").forEach(tab => tab.classList.toggle("sf-active", tab.dataset.group === group.id));
        };
        for (const group of groups) {
            const tab = el("button");
            tab.dataset.group = group.id;
            tab.title = group.title;
            if (group.icon.url) tab.innerHTML = `<img src="${escapeHtml(group.icon.url)}" alt="" loading="lazy">`;
            else if (group.icon.letters) tab.append(el("span", "sf-letter", group.icon.letters.split(/\s+/).map(word => word[0]).join("").slice(0, 3)));
            else tab.innerHTML = emojiHtml({ name: group.icon.text });
            tab.addEventListener("click", () => {
                search.value = "";
                showGroup(group);
            });
            tabs.append(tab);
        }
        search.addEventListener("input", () => {
            const query = search.value.trim().toLowerCase().replace(/:/g, "");
            if (!query) return showGroup(groups[0]);
            const seen = new Set();
            const found = groups.filter(group => group.id !== "recent").flatMap(group => group.emojis)
                .filter(emoji => (emoji.names ?? [emoji.name]).some(name => name?.toLowerCase().includes(query)))
                .filter(emoji => {
                    const key = emoji.id ?? emoji.name;
                    return !seen.has(key) && seen.add(key);
                })
                .slice(0, 300);
            body.replaceChildren(found.length ? grid(found) : el("div", "sf-picker-empty", "No emoji found"));
        });
        search.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "Escape") this.closePicker();
            if (e.key === "Enter") body.querySelector(".sf-picker-grid button")?.click();
        });
        if (groups.length) showGroup(groups[0]);
        else body.append(el("div", "sf-picker-empty", "No emoji found"));

        // Placé à côté du bouton, sans sortir de l'écran
        document.body.append(picker);
        const rect = button.getBoundingClientRect();
        const left = Math.min(Math.max(8, rect.right - 420), window.innerWidth - 428);
        const top = rect.bottom + 408 > window.innerHeight ? Math.max(8, rect.top - 408) : rect.bottom + 6;
        picker.style.left = `${left}px`;
        picker.style.top = `${top}px`;
        search.focus();

        const onOutside = e => {
            if (!picker.contains(e.target) && !e.target.closest?.("[data-action='add-reaction'], [data-action='emoji']")) this.closePicker();
        };
        setTimeout(() => document.addEventListener("mousedown", onOutside, true));
        this.picker = { element: picker, key, onOutside };
    }

    closePicker() {
        if (!this.picker) return;
        document.removeEventListener("mousedown", this.picker.onOutside, true);
        this.picker.element.remove();
        this.picker = null;
    }

    // --- Répondre depuis le fil ---

    onInput(e) {
        const edit = e.target.closest(".sf-edit-input");
        if (edit && this.editing) {
            this.editing.draft = edit.value;
            autoSize(edit);
            return;
        }
        const input = e.target.closest(".sf-input");
        if (!input) return;
        this.drafts.set(input.dataset.channel, input.value);
        autoSize(input);
        this.updateSuggestions(input, true);
    }

    onKeyDown(e) {
        // Modification d'un message : Entrée enregistre, Échap annule
        if (e.target.closest(".sf-edit-input")) {
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.saveEdit();
            } else if (e.key === "Escape") {
                e.preventDefault();
                this.cancelEdit();
            }
            return;
        }
        const input = e.target.closest(".sf-input");
        if (!input) return;
        // Les raccourcis de Discord ne doivent pas intercepter ce qu'on tape ici
        if (!(e.ctrlKey && e.shiftKey && e.code === "KeyF")) e.stopPropagation();
        const channelId = input.dataset.channel;
        // Liste des @ ouverte : les flèches, Entrée, Tab et Échap servent à la liste
        if (this.suggest?.items.length) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const count = this.suggest.items.length;
                this.suggest.index = (this.suggest.index + (e.key === "ArrowDown" ? 1 : -1) + count) % count;
                this.drawSuggestions();
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                this.chooseSuggestion(this.suggest.index);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                this.closeSuggestions();
                return;
            }
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this.send(channelId);
        } else if (e.key === "Escape" && this.replyTo.has(channelId)) {
            e.preventDefault();
            this.cancelReply(channelId);
        } else if (e.key === "ArrowUp" && !input.value) {
            // Comme Discord : flèche du haut dans une zone vide = modifier son dernier message
            const me = this.stores.UserStore?.getCurrentUser?.()?.id;
            const card = this.cards.get(channelId);
            const last = card && [...card.context, ...card.unread].reverse()
                .find(message => message.author?.id === me && !message.sfDeleted && !message.webhook_id);
            if (last) {
                e.preventDefault();
                this.startEdit(channelId, last.id);
            }
        }
    }

    // --- Modification de ses messages ---

    startEdit(channelId, messageId) {
        const message = this.findMessage(channelId, messageId);
        if (!message) return;
        // Les mentions s'affichent « @Pseudo » pendant la modification et redeviennent de vraies mentions à l'enregistrement
        (this.mentions ??= new Map());
        const list = this.mentions.get(channelId) ?? [];
        const remember = (text, value) => {
            if (!list.some(mention => mention.text === text)) list.push({ text, value });
            return text;
        };
        const draft = String(message.content ?? "")
            .replace(/<@!?(\d+)>/g, (value, id) => {
                const user = this.stores.UserStore?.getUser?.(id) ?? normalizeUser(message.mentions?.find(item => item.id === id));
                return user ? remember(`@${this.getName(user)}`, value) : value;
            })
            .replace(/<@&(\d+)>/g, (value, id) => {
                const role = this.getRoles()[id];
                return role ? remember(`@${role.name}`, value) : value;
            });
        this.mentions.set(channelId, list);
        this.editing = { channelId, messageId, draft };
        this.lastHtml = "";
        this.render();
        const input = this.panel.querySelector(".sf-edit-input");
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    cancelEdit() {
        const channelId = this.editing?.channelId;
        this.editing = null;
        this.lastHtml = "";
        this.render();
        if (channelId) this.focusInput(channelId);
    }

    async saveEdit() {
        const editing = this.editing;
        if (!editing || this.saving) return;
        const message = this.findMessage(editing.channelId, editing.messageId);
        const content = this.applyMentions(editing.channelId, editing.draft.trim());
        // Texte vide : Discord propose de supprimer, ici on annule simplement
        if (!message || !content || content === message.content) return this.cancelEdit();

        this.saving = true;
        try {
            await this.http.patch({ url: `/channels/${editing.channelId}/messages/${editing.messageId}`, body: { content } });
            // Mise à jour tout de suite, sans attendre l'évènement de Discord
            Object.assign(message, { content, edited_timestamp: new Date().toISOString() });
            this.cancelEdit();
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't edit the message`, error);
            BdApi.UI.showToast("ServerFeed: couldn't edit the message", { type: "error" });
        } finally {
            this.saving = false;
        }
    }

    // --- Mentions @ ---

    // Cherche un « @texte » ou « #texte » juste avant le curseur et propose les personnes, rôles, @everyone et @here,
    // ou les salons du serveur
    updateSuggestions(input, askDiscord) {
        const before = input.value.slice(0, input.selectionStart);
        const match = before.match(/(^|\s)([@#])([^\s@#]{0,32})$/);
        if (!match) return this.closeSuggestions();
        const [, , trigger, typed] = match;
        const query = typed.toLowerCase();
        const channelId = input.dataset.channel;
        const items = trigger === "#" ? this.findChannels(query) : this.findMentionables(channelId, query);

        // Les membres pas encore chargés : Discord les cherche, la liste se met à jour quand ils arrivent
        if (askDiscord && query && trigger === "@") {
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => {
                try {
                    if (this.memberActions?.requestMembers) this.memberActions.requestMembers([this.guildId], query, 10);
                    else this.dispatcher.dispatch({ type: "GUILD_MEMBERS_REQUEST", guildIds: [this.guildId], query, limit: 10, presences: false });
                } catch {}
            }, 250);
        }

        const start = before.length - typed.length - 1;
        const sameSpot = this.suggest?.input === input && this.suggest.start === start;
        this.suggest = { input, channelId, trigger, start, end: before.length, items, index: sameSpot ? Math.min(this.suggest.index, Math.max(0, items.length - 1)) : 0 };
        this.drawSuggestions();
    }

    // Salons du serveur qu'on peut voir, dans l'ordre de la liste de Discord
    findChannels(query) {
        const lists = this.stores.GuildChannelStore?.getChannels?.(this.guildId) ?? {};
        const { ChannelStore } = this.stores;
        return [...(lists.SELECTABLE ?? []), ...(lists.VOCAL ?? [])]
            .map(entry => entry.channel)
            .filter(channel => channel?.name && (!query || channel.name.toLowerCase().includes(query)))
            // Ceux qui commencent par le texte tapé d'abord
            .sort((a, b) => (query && !a.name.toLowerCase().startsWith(query)) - (query && !b.name.toLowerCase().startsWith(query)))
            .slice(0, 10)
            .map(channel => ({
                type: "channel", id: channel.id, label: channel.name, voice: channel.type === 2 || channel.type === 13,
                tag: channel.parent_id ? ChannelStore?.getChannel?.(channel.parent_id)?.name : ""
            }));
    }

    findMentionables(channelId, query) {
        const { GuildMemberStore, UserStore } = this.stores;
        const matches = (...names) => !query || names.some(name => name?.toLowerCase().includes(query));
        const seen = new Set();
        const users = [];
        const addUser = (user, member) => {
            if (!user || seen.has(user.id) || users.length >= 10) return;
            const nick = member?.nick ?? GuildMemberStore?.getNick?.(this.guildId, user.id);
            if (!matches(nick, user.globalName ?? user.global_name, user.username)) return;
            seen.add(user.id);
            users.push({
                type: "user", id: user.id, label: nick ?? user.globalName ?? user.global_name ?? user.username, tag: user.username,
                avatar: getAvatar(user, member ?? GuildMemberStore?.getMember?.(this.guildId, user.id), this.guildId)
            });
        };

        // Les gens de la conversation d'abord, du plus récent au plus ancien
        const card = this.cards.get(channelId);
        const recent = card ? [...card.context, ...card.unread].reverse() : [];
        for (const message of recent) {
            if (message.webhook_id) continue;
            addUser(UserStore?.getUser?.(message.author?.id) ?? normalizeUser(message.author));
        }
        for (const member of GuildMemberStore?.getMembers?.(this.guildId) ?? []) {
            if (users.length >= 10) break;
            addUser(UserStore?.getUser?.(member.userId), member);
        }

        const roles = Object.values(this.getRoles())
            .filter(role => role.id !== this.guildId && role.mentionable && matches(role.name))
            .slice(0, 5)
            .map(role => ({ type: "role", id: role.id, label: role.name, color: role.colorString }));
        const special = ["everyone", "here"].filter(name => matches(name)).map(name => ({ type: "special", id: name, label: name }));
        return [...users, ...roles, ...special];
    }

    drawSuggestions() {
        const suggest = this.suggest;
        if (!suggest?.items.length) {
            this.suggestEl?.remove();
            this.suggestEl = null;
            return;
        }
        if (!this.suggestEl) {
            this.suggestEl = el("div", "sf-suggest");
            // mousedown : on choisit avant que la zone de texte perde le focus
            this.suggestEl.addEventListener("mousedown", e => {
                const item = e.target.closest("[data-index]");
                if (!item) return;
                e.preventDefault();
                this.chooseSuggestion(Number(item.dataset.index));
            });
            document.body.append(this.suggestEl);
        }
        const channels = suggest.trigger === "#";
        this.suggestEl.innerHTML = `<div class="sf-suggest-title">${channels ? "Channels" : "Members"}</div>` + suggest.items.map((item, index) => {
            const icon = item.type === "user" ? `<img src="${escapeHtml(item.avatar)}" alt="">`
                : item.type === "channel" ? `<span class="sf-channel-icon">${item.voice ? "🔊" : "#"}</span>`
                : `<span class="sf-role-dot" style="background: ${escapeHtml(item.color ?? "#99aab5")}"></span>`;
            const extra = item.type === "user" || item.type === "channel" ? item.tag : item.type === "role" ? "role" : "";
            return `<div class="sf-suggest-item${index === suggest.index ? " sf-active" : ""}" data-index="${index}">
                ${icon}<span>${item.type === "channel" ? "" : "@"}${escapeHtml(item.label)}</span><small>${escapeHtml(extra ?? "")}</small></div>`;
        }).join("");

        // Juste au-dessus de la zone de texte, de la même largeur
        const rect = suggest.input.getBoundingClientRect();
        this.suggestEl.style.left = `${rect.left}px`;
        this.suggestEl.style.width = `${Math.max(260, rect.width)}px`;
        this.suggestEl.style.top = "";
        this.suggestEl.style.bottom = `${window.innerHeight - rect.top + 6}px`;
        this.suggestEl.querySelector(".sf-active")?.scrollIntoView({ block: "nearest" });
    }

    chooseSuggestion(index) {
        const suggest = this.suggest;
        const item = suggest?.items[index];
        if (!item) return;
        const { channelId } = suggest;
        // Le fil a pu être réaffiché entre-temps : on reprend la zone de texte actuelle
        const input = this.panel.querySelector(`.sf-input[data-channel="${channelId}"]`) ?? suggest.input;
        const text = `${item.type === "channel" ? "#" : "@"}${item.label}`;
        const value = item.type === "user" ? `<@${item.id}>` : item.type === "role" ? `<@&${item.id}>`
            : item.type === "channel" ? `<#${item.id}>` : `@${item.id}`;
        (this.mentions ??= new Map());
        const list = this.mentions.get(channelId) ?? [];
        if (!list.some(mention => mention.text === text)) list.push({ text, value });
        this.mentions.set(channelId, list);

        input.value = `${input.value.slice(0, suggest.start)}${text} ${input.value.slice(suggest.end)}`;
        const cursor = suggest.start + text.length + 1;
        input.setSelectionRange(cursor, cursor);
        this.drafts.set(channelId, input.value);
        autoSize(input);
        this.closeSuggestions();
        input.focus();
    }

    closeSuggestions() {
        this.suggest = null;
        this.suggestEl?.remove();
        this.suggestEl = null;
    }

    // Les « @Pseudo » choisis dans la liste deviennent de vraies mentions (les plus longs d'abord)
    applyMentions(channelId, content) {
        const list = [...(this.mentions?.get(channelId) ?? [])].sort((a, b) => b.text.length - a.text.length);
        for (const { text, value } of list) content = content.split(text).join(value);
        return content;
    }

    startReply(channelId, messageId) {
        this.replyTo.set(channelId, messageId);
        this.render();
        this.focusInput(channelId);
    }

    cancelReply(channelId) {
        this.replyTo.delete(channelId);
        this.render();
        this.focusInput(channelId);
    }

    focusInput(channelId) {
        const input = this.panel.querySelector(`.sf-input[data-channel="${channelId}"]`);
        if (!input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }

    // Unicode tel quel, emoji personnalisé au format de Discord (<:nom:id> ou <a:nom:id> s'il est animé)
    insertEmoji(channelId, emoji, range) {
        const text = emoji.id ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>` : emoji.name;
        const draft = this.drafts.get(channelId) ?? "";
        const [start, end] = range ?? [draft.length, draft.length];
        const before = draft.slice(0, start);
        const insert = (before && !/\s$/.test(before) && emoji.id ? " " : "") + text;
        this.drafts.set(channelId, before + insert + draft.slice(end));
        this.rememberEmoji(emoji);

        const input = this.panel.querySelector(`.sf-input[data-channel="${channelId}"]`);
        if (!input) return;
        input.value = this.drafts.get(channelId);
        autoSize(input);
        input.focus();
        const cursor = start + insert.length;
        input.setSelectionRange(cursor, cursor);
    }

    findMessage(channelId, messageId) {
        const card = this.cards.get(channelId);
        return card && [...card.context, ...card.unread].find(message => message.id === messageId);
    }

    async send(channelId) {
        const content = (this.drafts.get(channelId) ?? "").trim();
        if (!content || this.sending) return;
        const replyId = this.replyTo.get(channelId);
        const reference = replyId ? { guild_id: this.guildId, channel_id: channelId, message_id: replyId } : null;

        // L'envoi de Discord attend que le salon soit ouvert : on passe directement par l'API.
        // TextExpander ne voit donc pas passer le message, on lui demande de le remplacer nous-mêmes
        const message = { content: this.applyMentions(channelId, content) };
        try {
            if (BdApi.Plugins.isEnabled("TextExpander")) BdApi.Plugins.get("TextExpander")?.instance?.expandMessage?.(message);
        } catch {}

        this.sending = true;
        try {
            await this.http.post({
                url: `/channels/${channelId}/messages`,
                body: {
                    content: message.content,
                    nonce: String((BigInt(Date.now() - 1420070400000) << 22n)),
                    tts: false,
                    ...(reference ? { message_reference: reference, allowed_mentions: { parse: ["users", "roles", "everyone"], replied_user: true } } : {})
                }
            });
            this.drafts.delete(channelId);
            this.mentions?.delete(channelId);
            this.closeSuggestions();
            this.replyTo.delete(channelId);
            this.lastHtml = "";
            this.render();
            this.focusInput(channelId);
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't send the message`, error);
            BdApi.UI.showToast("ServerFeed: couldn't send the message", { type: "error" });
        } finally {
            this.sending = false;
        }
    }

    // --- Rendu ---

    render() {
        if (!this.open) return;
        const guild = this.stores.GuildStore?.getGuild?.(this.guildId);
        const cards = [...this.cards.values()]
            .filter(card => this.visibleMessages(card.unread).length)
            // Les salons où l'on est mentionné passent en premier
            .sort((a, b) => (this.countMentions(b) > 0) - (this.countMentions(a) > 0) || (a.order === null || b.order === null
                ? compareIds(b.unread[b.unread.length - 1], a.unread[a.unread.length - 1])
                : a.order - b.order));
        const total = cards.reduce((sum, card) => sum + this.countUnread(card), 0);

        const status = this.loading
            ? `Loading unread messages… ${this.loading.done}/${this.loading.total} channels`
            : `${total} unread message${total === 1 ? "" : "s"} in ${cards.length} channel${cards.length === 1 ? "" : "s"}`;

        const feed = cards.length
            ? cards.map(card => this.renderCard(card)).join("")
            : `<div class="sf-empty">${this.loading ? "Loading…" : "All caught up! 🎉"}</div>`;

        const html = `
            <div class="sf-header">
                <span class="sf-title">${escapeHtml(guild?.name ?? "Server")} · Feed</span>
                <span class="sf-status">${escapeHtml(status)}</span>
                <button class="sf-btn" data-action="refresh" ${this.loading ? "disabled" : ""}>⟳ Refresh</button>
                <button class="sf-btn sf-primary" data-action="read-all" ${cards.length && !this.loading ? "" : "disabled"}>✓ Mark all read</button>
                <button class="sf-btn" data-action="close" title="Close (Ctrl+Shift+F)">✕</button>
            </div>
            <div class="sf-scroll"><div class="sf-feed">${feed}</div></div>`;
        if (html === this.lastHtml) return;

        // On garde la carte en cours de lecture au même endroit à l'écran
        const scroll = this.panel.querySelector(".sf-scroll");
        const anchor = scroll && [...scroll.querySelectorAll(".sf-card")]
            .find(node => node.getBoundingClientRect().bottom > scroll.getBoundingClientRect().top);
        const anchorId = anchor?.dataset.channel;
        const offset = anchor ? anchor.getBoundingClientRect().top - scroll.getBoundingClientRect().top : 0;
        const top = scroll?.scrollTop ?? 0;
        const focused = document.activeElement?.closest?.(".sf-input, .sf-edit-input");
        const focus = focused && this.panel.contains(focused)
            ? { edit: focused.matches(".sf-edit-input"), channel: focused.dataset.channel, start: focused.selectionStart, end: focused.selectionEnd }
            : null;
        // Les vidéos et GIF en cours sont gardés tels quels, pour ne pas les relancer à chaque nouveau message
        const videos = new Map();
        for (const video of this.panel.querySelectorAll(".sf-attachments video")) {
            videos.set(videoKey(video), video);
        }
        const stickers = new Map();
        for (const sticker of this.panel.querySelectorAll(".sf-lottie.sf-ready")) stickers.set(sticker.dataset.key, sticker);
        this.panel.innerHTML = html;
        this.lastHtml = html;
        for (const video of this.panel.querySelectorAll(".sf-attachments video")) {
            const old = videos.get(videoKey(video));
            if (old) video.replaceWith(old);
        }
        for (const sticker of this.panel.querySelectorAll(".sf-lottie")) {
            const old = stickers.get(sticker.dataset.key);
            if (old) sticker.replaceWith(old);
            else this.playSticker(sticker);
        }
        for (const input of this.panel.querySelectorAll(".sf-input")) {
            input.value = this.drafts.get(input.dataset.channel) ?? "";
            if (input.value) autoSize(input);
        }
        const edit = this.panel.querySelector(".sf-edit-input");
        if (edit) {
            edit.value = this.editing?.draft ?? "";
            autoSize(edit);
        }
        if (focus) {
            const input = focus.edit ? edit : this.panel.querySelector(`.sf-input[data-channel="${focus.channel}"]`);
            input?.focus();
            input?.setSelectionRange(focus.start, focus.end);
        }
        const next = this.panel.querySelector(".sf-scroll");
        const sameCard = anchorId && next?.querySelector(`.sf-card[data-channel="${anchorId}"]`);
        if (next && top > 0) {
            if (sameCard) next.scrollTop += sameCard.getBoundingClientRect().top - next.getBoundingClientRect().top - offset;
            else next.scrollTop = top;
        }
    }

    countUnread(card) {
        const me = this.stores.UserStore?.getCurrentUser?.()?.id;
        return this.visibleMessages(card.unread).filter(message => message.author?.id !== me).length;
    }

    // Sticker Lottie : on récupère son animation (une fois par sticker) et on la joue avec le lecteur Lottie de Discord
    async playSticker(node) {
        this.lottie ??= BdApi.Webpack.getModule(m => typeof m?.loadAnimation === "function" && typeof m?.destroy === "function", { searchExports: true });
        if (!this.lottie) return;
        const id = node.dataset.sticker;
        this.stickerData ??= new Map();
        if (!this.stickerData.has(id)) {
            const load = async () => {
                for (const url of [`https://media.discordapp.net/stickers/${id}.json`, `https://discord.com/stickers/${id}.json`]) {
                    try {
                        const response = await fetch(url);
                        if (response.ok) return await response.json();
                    } catch {}
                }
                return null;
            };
            this.stickerData.set(id, load());
        }
        const data = await this.stickerData.get(id);
        if (!data || !node.isConnected || node.classList.contains("sf-ready")) return;
        node.textContent = "";
        node.classList.add("sf-ready");
        try {
            this.lottie.loadAnimation({ container: node, renderer: "svg", loop: true, autoplay: true, animationData: data });
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't play the sticker`, error);
        }
    }

    countMentions(card) {
        return this.visibleMessages(card.unread).filter(message => this.mentionsMe(message)).length;
    }

    // Comme Discord : mention directe, @everyone / @here (sauf si on les a coupés) ou un de nos rôles
    mentionsMe(message) {
        const me = this.stores.UserStore?.getCurrentUser?.()?.id;
        if (!me || message.sfDeleted || message.author?.id === me) return false;
        if (message.mentions?.some(user => (user?.id ?? user) === me)) return true;
        if (message.mention_everyone && !this.stores.UserGuildSettingsStore?.isSuppressEveryoneEnabled?.(this.guildId)) return true;
        if (!message.mention_roles?.length || this.stores.UserGuildSettingsStore?.isSuppressRolesEnabled?.(this.guildId)) return false;
        const roles = this.getMember(me)?.roles ?? [];
        return message.mention_roles.some(id => roles.includes(id));
    }

    visibleMessages(messages) {
        return this.settings.hideBots ? messages.filter(message => !message.author?.bot) : messages;
    }

    renderCard(card) {
        const channel = this.stores.ChannelStore?.getChannel?.(card.channelId);
        const category = channel?.parent_id && this.stores.ChannelStore.getChannel(channel.parent_id);
        const unread = this.visibleMessages(card.unread);
        const context = this.visibleMessages(card.context);
        const lastTime = idToTime(unread[unread.length - 1].id);

        let previous = null;
        const rows = [];
        for (const message of context) {
            rows.push(this.renderMessage(message, previous, true));
            previous = message;
        }
        if (context.length) rows.push(`<div class="sf-separator sf-new">New</div>`);
        previous = null;
        for (const message of unread) {
            if (previous) {
                const gap = idToTime(message.id) - idToTime(previous.id);
                if (gap >= GAP_MINUTES * 60000) rows.push(`<div class="sf-separator">${formatGap(gap)} later</div>`);
            }
            rows.push(this.renderMessage(message, previous, false));
            previous = message;
        }

        const id = escapeHtml(card.channelId);
        const mentions = this.countMentions(card);
        return `
            <div class="sf-card${mentions ? " sf-has-mention" : ""}" data-channel="${card.channelId}">
                <div class="sf-card-head" data-action="jump" data-channel="${id}">
                    <span class="sf-channel">#${escapeHtml(channel?.name ?? "unknown")}</span>
                    ${category ? `<span class="sf-category">${escapeHtml(category.name)}</span>` : ""}
                    ${mentions ? `<span class="sf-mention-badge" title="${mentions} mention${mentions === 1 ? "" : "s"}">@${mentions}</span>` : ""}
                    <span class="sf-count">${this.countUnread(card)}${card.truncated ? "+" : ""} · ${formatTime(lastTime)}</span>
                </div>
                <div class="sf-messages">${rows.join("")}</div>
                ${this.renderComposer(card, channel)}
                <div class="sf-card-actions">
                    <button class="sf-btn" data-action="context" data-channel="${id}">▲ More context</button>
                    ${card.truncated ? `<button class="sf-btn" data-action="more" data-channel="${id}">▼ Load more</button>` : ""}
                    <button class="sf-btn" data-action="jump" data-channel="${id}" data-message="${escapeHtml(unread[0].id)}">↗ Jump to first unread</button>
                    <button class="sf-btn sf-primary" data-action="read" data-channel="${id}">✓ Mark read</button>
                </div>
            </div>`;
    }

    renderComposer(card, channel) {
        const id = escapeHtml(card.channelId);
        const replyId = this.replyTo.get(card.channelId);
        const target = replyId && this.findMessage(card.channelId, replyId);
        const replyBar = target ? `
            <div class="sf-replybar">
                <span>Replying to <b>${escapeHtml(this.getName(target.author ?? {}))}</b></span>
                <button data-action="cancel-reply" data-channel="${id}" title="Cancel (Esc)">✕</button>
            </div>` : "";
        return `
            <div class="sf-composer">
                ${replyBar}
                <div class="sf-input-row">
                    <textarea class="sf-input" data-channel="${id}" rows="1" placeholder="Message #${escapeHtml(channel?.name ?? "")}"></textarea>
                    <button class="sf-btn sf-emoji-btn" data-action="emoji" data-channel="${id}" title="Emoji">☺</button>
                    <button class="sf-btn sf-primary" data-action="send" data-channel="${id}">Send</button>
                </div>
            </div>`;
    }

    renderMessage(message, previous, isContext) {
        const author = message.author ?? {};
        // Messages consécutifs du même auteur, rapprochés et sans réponse : on les regroupe
        const grouped = previous && previous.author?.id === author.id && !message.referenced_message
            && idToTime(message.id) - idToTime(previous.id) < 5 * 60000;
        const classes = ["sf-msg"];
        if (grouped) classes.push("sf-grouped");
        if (isContext) classes.push("sf-context");
        if (message.sfDeleted) classes.push("sf-deleted");
        if (this.replyTo.get(message.channel_id) === message.id) classes.push("sf-replying");
        const own = Boolean(author.id && author.id === this.stores.UserStore?.getCurrentUser?.()?.id);
        if (own) classes.push("sf-own");
        if (this.mentionsMe(message)) classes.push("sf-mentioned");
        const target = `data-channel="${escapeHtml(message.channel_id)}" data-message="${escapeHtml(message.id)}"`;
        const editing = this.editing?.messageId === message.id;
        const replyButton = message.sfDeleted || editing ? "" : `
            <div class="sf-msg-tools">
                <button data-action="add-reaction" ${target} title="Add Reaction">☺ +</button>
                ${own && !message.webhook_id ? `<button data-action="edit" ${target}>✎ Edit</button>` : ""}
                <button data-action="reply" ${target}>↩ Reply</button>
            </div>`;
        const reactions = message.reactions?.length && !message.sfDeleted ? `
            <div class="sf-reactions">
                ${message.reactions.map(reaction => `
                    <button class="sf-reaction${reaction.me ? " sf-me" : ""}" data-action="react" ${target}
                        data-emoji="${escapeHtml(JSON.stringify({ id: reaction.emoji.id ?? null, name: reaction.emoji.name, animated: Boolean(reaction.emoji.animated) }))}"
                        title=":${escapeHtml(reaction.emoji.name ?? "")}:">${emojiHtml(reaction.emoji)}<span>${reaction.count}</span></button>`).join("")}
                <button class="sf-reaction sf-reaction-add" data-action="add-reaction" ${target} title="Add Reaction">☺ +</button>
            </div>` : "";

        const name = this.getName(author);
        // Pas de membre pour un webhook : son auteur n'existe pas vraiment sur le serveur
        const member = message.webhook_id ? null : this.getMember(author.id);
        const color = member?.colorString ? ` style="color: ${escapeHtml(member.colorString)}"` : "";
        const reply = message.referenced_message
            ? `<div class="sf-reply">↪ <span><b>${escapeHtml(this.getName(message.referenced_message.author ?? {}))}</b> ${escapeHtml(stripText(this.plainText(message.referenced_message)))}</span></div>`
            : "";
        const meta = grouped ? "" : `
            <div class="sf-meta">
                <span class="sf-author" data-action="profile" data-user="${escapeHtml(author.id ?? "")}"${color}>${escapeHtml(name)}</span>
                ${author.bot ? `<span class="sf-bot">BOT</span>` : ""}
                <span class="sf-time">${formatTime(idToTime(message.id))}</span>
            </div>`;

        return `
            <div class="${classes.join(" ")}" data-action="jump" data-channel="${escapeHtml(message.channel_id)}" data-message="${escapeHtml(message.id)}">
                <img class="sf-avatar" src="${escapeHtml(getAvatar(author, member, this.guildId))}" alt="" data-action="profile" data-user="${escapeHtml(author.id ?? "")}">
                ${replyButton}
                <div class="sf-body">
                    ${reply}${meta}
                    ${editing ? `
                        <div class="sf-edit" data-action="none">
                            <textarea class="sf-edit-input" ${target} rows="1"></textarea>
                            <div class="sf-edit-hint">Escape to <span data-action="cancel-edit">cancel</span> • Enter to <span data-action="save-edit">save</span></div>
                        </div>`
                        : `<div class="sf-text">${this.renderContent(message)}${message.edited_timestamp ? ` <span class="sf-edited">(edited)</span>` : ""}</div>`}
                    ${renderStickers(message)}
                    ${renderAttachments(message, target)}
                    ${reactions}
                </div>
            </div>`;
    }

    getName(author) {
        // Pseudo du serveur en priorité (le membre est demandé à Discord s'il n'est pas encore chargé)
        const nick = author.id ? this.getMember(author.id)?.nick : null;
        return nick ?? author.global_name ?? author.globalName ?? author.username ?? "Unknown";
    }

    // Rôles du serveur, par identifiant. Discord les a déplacés d'un store à l'autre selon les versions :
    // on essaie les deux, et en dernier recours on les demande à l'API (une fois par serveur)
    getRoles() {
        const guildId = this.guildId;
        const roleStore = this.stores.GuildRoleStore;
        const found = roleStore?.getRolesSnapshot?.(guildId) ?? roleStore?.getRoles?.(guildId)
            ?? this.stores.GuildStore?.getRoles?.(guildId) ?? this.stores.GuildStore?.getGuild?.(guildId)?.roles;
        if (Array.isArray(found) && found.length) return Object.fromEntries(found.map(role => [role.id, role]));
        if (found && Object.keys(found).length) return found;

        this.roleCache ??= new Map();
        if (!this.roleCache.has(guildId)) {
            this.roleCache.set(guildId, {});
            this.http.get({ url: `/guilds/${guildId}/roles` }).then(response => {
                const list = Array.isArray(response?.body) ? response.body : JSON.parse(response?.text ?? "[]");
                this.roleCache.set(guildId, Object.fromEntries(list.map(role => [role.id, role])));
                this.lastHtml = "";
                this.render();
            }).catch(error => console.error(`[${this.meta.name}] couldn't load the roles`, error));
        }
        return this.roleCache.get(guildId);
    }

    // Profil de la personne sur ce serveur (pseudo, photo et couleur de serveur).
    // Discord ne garde que les membres déjà vus : on lui demande les autres, puis on réaffiche
    getMember(userId) {
        if (!userId) return null;
        const member = this.stores.GuildMemberStore?.getMember?.(this.guildId, userId);
        if (member) return member;
        this.requestedMembers ??= new Set();
        const key = `${this.guildId}:${userId}`;
        if (!this.requestedMembers.has(key)) {
            this.requestedMembers.add(key);
            (this.missingMembers ??= new Set()).add(userId);
            this.memberTimer ??= setTimeout(() => this.requestMembers(), 200);
        }
        return null;
    }

    requestMembers() {
        this.memberTimer = null;
        const ids = [...(this.missingMembers ?? [])];
        this.missingMembers = new Set();
        if (!ids.length) return;
        for (let i = 0; i < ids.length; i += 100) {
            try {
                const userIds = ids.slice(i, i + 100);
                // Sans le module de Discord, on envoie nous-mêmes la demande qu'il aurait faite
                if (this.memberActions?.requestMembersById) this.memberActions.requestMembersById(this.guildId, userIds);
                else this.dispatcher.dispatch({ type: "GUILD_MEMBERS_REQUEST", guildIds: [this.guildId], userIds, presences: false });
            } catch (error) {
                console.error(`[${this.meta.name}] couldn't request members`, error);
            }
        }
    }

    // Texte d'une ligne (aperçu du message auquel on répond) : mentions, salons et emojis lisibles
    plainText(message) {
        return String(message.content ?? "")
            .replace(/<@!?(\d+)>/g, (_, id) => {
                const user = this.stores.UserStore?.getUser?.(id) ?? normalizeUser(message.mentions?.find(item => item.id === id));
                return `@${user ? this.getName(user) : "user"}`;
            })
            .replace(/<@&(\d+)>/g, (_, id) => `@${this.getRoles()[id]?.name ?? "unknown-role"}`)
            .replace(/<#(\d+)>/g, (_, id) => `#${this.stores.ChannelStore?.getChannel?.(id)?.name ?? "channel"}`)
            .replace(/<?https?:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(?:\d+|@me)\/(\d+)(\/\d+)?\/?>?/g, (url, id, message) => {
                const name = this.stores.ChannelStore?.getChannel?.(id)?.name;
                return name ? `#${name}${message ? " › 💬" : ""}` : url;
            })
            .replace(/<a?:(\w+):\d+>/g, (_, name) => `:${name}:`)
            .replace(/<t:(-?\d+)(?::([tTdDfFR]))?>/g, (_, time, style) => formatTimestamp(Number(time) * 1000, style));
    }

    // Markdown de Discord. Le code, les liens, les mentions et les emojis sont mis de côté d'abord
    // (remplacés par des repères), pour que leurs * ou _ ne soient pas pris pour de la mise en forme
    renderContent(message) {
        const stash = [];
        const keep = html => `\u0000${stash.push(html) - 1}\u0000`;
        const link = (url, text) => keep(`<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${text}</a>`);

        let raw = String(message.content ?? "");
        raw = raw.replace(/```(?:([\w+#-]+)\n)?([\s\S]*?)```/g, (_, lang, code) =>
            keep(`<code class="sf-codeblock">${escapeHtml(code.replace(/^\n+|\n+$/g, ""))}</code>`));
        raw = raw.replace(/``([^`]+?)``|`([^`\n]+?)`/g, (_, double, single) =>
            keep(`<code class="sf-code">${escapeHtml(double ?? single)}</code>`));
        raw = raw.replace(/\[([^\]\n]+)\]\(<?(https?:\/\/[^\s)>]+)>?\)/g, (_, text, url) => link(url, escapeHtml(text)));
        // Lien de salon ou de message copié : une pastille « #salon » comme dans Discord
        raw = raw.replace(/<?(https?:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)(?:\/(\d+))?)\/?>?/g, (_, url, guildId, channelId, messageId) => {
            const channel = this.stores.ChannelStore?.getChannel?.(channelId);
            if (!channel?.name) return link(url, escapeHtml(url));
            return keep(`<span class="sf-mention" data-action="jump" data-guild="${escapeHtml(guildId)}" data-channel="${channelId}"${messageId ? ` data-message="${messageId}"` : ""}>#${escapeHtml(channel.name)}${messageId ? " › 💬" : ""}</span>`);
        });
        raw = raw.replace(/<?(https?:\/\/[^\s<>]*[^\s<>.,:;"')\]!?])>?/g, (_, url) => link(url, escapeHtml(url)));
        raw = raw.replace(/<@!?(\d+)>/g, (_, id) => {
            const user = this.stores.UserStore?.getUser?.(id);
            const mention = message.mentions?.find(item => item.id === id);
            return keep(`<span class="sf-mention" data-action="profile" data-user="${id}">@${escapeHtml(user ? this.getName(user) : mention ? this.getName(mention) : "user")}</span>`);
        });
        raw = raw.replace(/<@&(\d+)>/g, (_, id) => {
            const role = this.getRoles()[id];
            // Comme Discord : la mention prend la couleur du rôle
            const color = role?.colorString ?? (role?.color ? `#${role.color.toString(16).padStart(6, "0")}` : null);
            const style = color ? ` style="color: ${escapeHtml(color)}; background: color-mix(in srgb, ${escapeHtml(color)} 15%, transparent)"` : "";
            return keep(`<span class="sf-mention"${style}>@${escapeHtml(role?.name ?? "unknown-role")}</span>`);
        });
        raw = raw.replace(/<#(\d+)>/g, (_, id) => {
            const channel = this.stores.ChannelStore?.getChannel?.(id);
            if (!channel) return keep(`<span class="sf-mention">#channel</span>`);
            return keep(`<span class="sf-mention" data-action="jump" data-guild="${escapeHtml(channel.guild_id ?? "@me")}" data-channel="${id}">#${escapeHtml(channel.name ?? "channel")}</span>`);
        });
        raw = raw.replace(/<(a?):(\w+):(\d+)>/g, (_, animated, name, id) =>
            keep(`<img class="sf-emoji" alt=":${escapeHtml(name)}:" src="https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=48">`));
        raw = raw.replace(/<t:(-?\d+)(?::([tTdDfFR]))?>/g, (_, time, style) =>
            keep(`<span class="sf-timestamp">${escapeHtml(formatTimestamp(Number(time) * 1000, style))}</span>`));

        let html = raw.trim() ? renderBlocks(raw.split("\n")) : "";
        // Les repères peuvent en contenir d'autres (texte d'un lien) : on remplace jusqu'à ce qu'il n'en reste plus
        for (let i = 0; i < 3 && html.includes("\u0000"); i++) html = html.replace(/\u0000(\d+)\u0000/g, (_, index) => stash[index]);

        if (!html && message.embeds?.length && !message.embeds.some(embed => embed.thumbnail || embed.image)) {
            html = `<i>${escapeHtml(message.embeds[0].title ?? message.embeds[0].description ?? "Embed")}</i>`;
        }
        return html;
    }

    // --- Paramètres ---

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "sf-settings";
        panel.append(
            this.checkbox("Hide messages from bots", "hideBots"),
            this.checkbox("Ignore muted channels", "hideMuted"),
            el("div", "sf-hint", "Open the feed with the Feed button at the top right of the chat, or with Ctrl+Shift+F.")
        );
        return panel;
    }

    checkbox(text, key) {
        const label = el("label");
        const input = el("input");
        input.type = "checkbox";
        input.checked = this.settings[key];
        input.addEventListener("change", () => {
            this.settings[key] = input.checked;
            BdApi.Data.save(this.meta.name, "settings", this.settings);
            this.lastHtml = "";
            this.render();
        });
        label.append(input, el("span", "", text));
        return label;
    }
};

// Images jointes (fichiers et aperçus de liens) en miniatures, autres fichiers en lien
// --- Markdown ---

// Titres, citations, listes ; le reste est du texte normal, ligne par ligne
function renderBlocks(lines) {
    const out = [];
    let text = [];
    const flush = () => {
        if (text.length) out.push(`<div>${renderInline(text.join("\n")) || "&#8203;"}</div>`);
        text = [];
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;
        if ((match = line.match(/^>>> ?(.*)$/))) {
            flush();
            out.push(`<div class="sf-quote">${renderBlocks([match[1], ...lines.slice(i + 1)])}</div>`);
            break;
        }
        if (/^> /.test(line) || line === ">") {
            flush();
            const quoted = [];
            while (i < lines.length && (/^> /.test(lines[i]) || lines[i] === ">")) quoted.push(lines[i++].slice(2));
            i--;
            out.push(`<div class="sf-quote">${renderBlocks(quoted)}</div>`);
        } else if ((match = line.match(/^(#{1,3}) +(.+)$/))) {
            flush();
            out.push(`<div class="sf-h sf-h${match[1].length}">${renderInline(match[2])}</div>`);
        } else if ((match = line.match(/^-# +(.+)$/))) {
            flush();
            out.push(`<div class="sf-subtext">${renderInline(match[1])}</div>`);
        } else if ((match = line.match(/^( *)(?:[-*]|(\d+)\.) +(.+)$/))) {
            flush();
            const indent = Math.min(match[1].length, 8) * 6;
            out.push(`<div class="sf-li" style="padding-left: ${indent}px"><span class="sf-bullet">${match[2] ? `${match[2]}.` : "•"}</span><span>${renderInline(match[3])}</span></div>`);
        } else {
            text.push(line);
        }
    }
    flush();
    return out.join("");
}

function renderInline(text) {
    return escapeHtml(text)
        .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/__(.+?)__/g, "<u>$1</u>")
        .replace(/\*(?!\s)(.+?)(?<!\s)\*/g, "<em>$1</em>")
        .replace(/(^|[^\w])_(?!\s)(.+?)(?<!\s)_(?![\w])/g, "$1<em>$2</em>")
        .replace(/~~(.+?)~~/g, "<s>$1</s>")
        .replace(/\|\|(.+?)\|\|/g, `<span class="sf-spoiler" data-action="spoiler">$1</span>`);
}

// Dates <t:…> de Discord, dans le format demandé
function formatTimestamp(time, style = "f") {
    const date = new Date(time);
    if (style === "R") {
        const diff = time - Date.now();
        const units = [["year", 31536000000], ["month", 2592000000], ["day", 86400000], ["hour", 3600000], ["minute", 60000], ["second", 1000]];
        const [unit, size] = units.find(([, size]) => Math.abs(diff) >= size) ?? units[units.length - 1];
        return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(diff / size), unit);
    }
    const formats = {
        t: { timeStyle: "short" }, T: { timeStyle: "medium" }, d: { dateStyle: "short" }, D: { dateStyle: "long" },
        f: { dateStyle: "long", timeStyle: "short" }, F: { dateStyle: "full", timeStyle: "short" }
    };
    return date.toLocaleString(undefined, formats[style] ?? formats.f);
}

function sameEmoji(a, b) {
    return a.id ? a.id === b.id : !b.id && a.name === b.name;
}

// Image de l'emoji : celle de Discord pour les emojis personnalisés, Twemoji pour l'unicode si on l'a
function emojiHtml(emoji) {
    if (emoji.id) {
        return `<img src="https://cdn.discordapp.com/emojis/${escapeHtml(emoji.id)}.${emoji.animated ? "gif" : "webp"}?size=48" alt="${escapeHtml(emoji.name ?? "")}" loading="lazy">`;
    }
    const url = emoji.url ?? unicodeUrls().get(emoji.name);
    return url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(emoji.name)}" loading="lazy">` : `<span>${escapeHtml(emoji.name ?? "")}</span>`;
}

let unicodeEmojis = null;
let unicodeUrlMap = null;

// Emojis unicode par catégorie, tirés du module interne de Discord
function loadUnicodeEmojis() {
    if (unicodeEmojis) return unicodeEmojis;
    const filter = m => typeof m?.getByCategory === "function" && typeof m?.getByName === "function";
    const module = BdApi.Webpack.getModule(filter) ?? BdApi.Webpack.getModule(filter, { searchExports: true });
    unicodeEmojis = [];
    for (const [id, icon] of Object.entries(EMOJI_CATEGORIES)) {
        let list;
        try { list = module?.getByCategory(id); } catch { list = null; }
        if (!list?.length) continue;
        unicodeEmojis.push({
            id, icon: { text: icon }, title: id,
            emojis: list.map(emoji => ({
                id: null, name: emoji.surrogates, label: emoji.uniqueName ?? emoji.names?.[0],
                names: emoji.names ?? [], url: emoji.url
            }))
        });
    }
    return unicodeEmojis;
}

function unicodeUrls() {
    if (!unicodeUrlMap) {
        unicodeUrlMap = new Map();
        for (const group of loadUnicodeEmojis()) {
            for (const emoji of group.emojis) if (emoji.url) unicodeUrlMap.set(emoji.name, emoji.url);
        }
    }
    return unicodeUrlMap;
}

function isImageFile(file) {
    return file.content_type?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.filename ?? "");
}

// Toutes les images d'un message (pièces jointes puis embeds), dans l'ordre d'affichage
function getImages(message) {
    const images = [];
    for (const file of message.attachments ?? []) {
        if (isImageFile(file)) images.push({ preview: file.proxy_url ?? file.url, full: file.proxy_url ?? file.url, original: file.url ?? file.proxy_url });
    }
    for (const embed of message.embeds ?? []) {
        const video = embed.type === "gifv" ? embed.video : null;
        if (video?.proxy_url || video?.url) {
            const src = video.proxy_url ?? video.url;
            images.push({ video: true, preview: src, full: src, original: embed.url ?? video.url ?? src });
            continue;
        }
        const image = embed.image ?? embed.thumbnail;
        if (image?.proxy_url || image?.url) images.push({ preview: image.proxy_url ?? image.url, full: image.proxy_url ?? image.url, original: image.url ?? image.proxy_url });
    }
    return images;
}

// Une vidéo est reconnue d'un affichage à l'autre par son message et son adresse
function videoKey(video) {
    return `${video.closest(".sf-msg")?.dataset.message}|${video.getAttribute("src")}`;
}

// Stickers en image (PNG, APNG animé ou GIF). Ceux en Lottie (les stickers officiels de Discord) sont animés
// ensuite par le lecteur de Discord ; en attendant (ou s'il manque) on écrit leur nom
function renderStickers(message) {
    if (!message.sticker_items?.length || message.sfDeleted) return "";
    return `<div class="sf-stickers">${message.sticker_items.map(sticker => sticker.format_type === 3
        ? `<div class="sf-sticker sf-lottie" data-sticker="${escapeHtml(sticker.id)}" data-key="${escapeHtml(`${message.id}:${sticker.id}`)}" title="${escapeHtml(sticker.name)}"><i>Sticker: ${escapeHtml(sticker.name)}</i></div>`
        : `<img class="sf-sticker" src="https://media.discordapp.net/stickers/${escapeHtml(sticker.id)}.${sticker.format_type === 4 ? "gif" : "png"}?size=160" alt="${escapeHtml(sticker.name)}" title="${escapeHtml(sticker.name)}">`).join("")}</div>`;
}

function renderAttachments(message, target) {
    const items = getImages(message).map((image, index) => image.video
        ? `<video src="${escapeHtml(image.preview)}" autoplay loop muted playsinline data-action="image" ${target} data-index="${index}"></video>`
        : `<img src="${escapeHtml(image.preview)}" alt="" data-action="image" ${target} data-index="${index}">`);
    for (const file of message.attachments ?? []) {
        if (isImageFile(file)) continue;
        // Vidéo envoyée en pièce jointe : lecteur avec les contrôles (un clic dessus ne fait rien d'autre)
        if (file.content_type?.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.filename ?? "")) {
            items.push(`<video class="sf-video" src="${escapeHtml(file.proxy_url ?? file.url)}" controls preload="metadata" data-action="media"></video>`);
        } else items.push(`<a class="sf-file" href="${escapeHtml(file.url)}" target="_blank" rel="noreferrer">📎 ${escapeHtml(file.filename)}</a>`);
    }
    return items.length ? `<div class="sf-attachments">${items.join("")}</div>` : "";
}

// Auteur venant de l'API (global_name) au format des utilisateurs de Discord (globalName)
function normalizeUser(author) {
    return author?.id ? { ...author, globalName: author.global_name } : null;
}

function getAvatar(author, member, guildId) {
    if (member?.avatar) return `https://cdn.discordapp.com/guilds/${guildId}/users/${author.id}/avatars/${member.avatar}.webp?size=64`;
    if (author.avatar) return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.webp?size=64`;
    const index = author.id ? Number((BigInt(author.id) >> 22n) % 6n) : 0;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

// L'identifiant d'un message contient sa date d'envoi
function idToTime(id) {
    return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
}

function compareIds(a, b) {
    const x = BigInt(a.id), y = BigInt(b.id);
    return x < y ? -1 : x > y ? 1 : 0;
}

function autoSize(input) {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

function dedupe(messages) {
    const seen = new Set();
    return messages.filter(message => !seen.has(message.id) && seen.add(message.id)).sort(compareIds);
}

function formatTime(time) {
    const date = new Date(time);
    const clock = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return date.toDateString() === new Date().toDateString()
        ? clock
        : `${date.toLocaleDateString([], { day: "2-digit", month: "2-digit" })} ${clock}`;
}

function formatGap(gap) {
    const minutes = Math.round(gap / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} h` : `${Math.round(hours / 24)} d`;
}

function stripText(text) {
    return String(text ?? "").replace(/\s+/g, " ").slice(0, 120);
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
}

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}
