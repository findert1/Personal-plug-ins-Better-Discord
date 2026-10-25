/**
 * @name ServerFeed
 * @author findert
 * @description Shows every unread message of the server in one feed, grouped by channel with context, like a timeline. Mark channels as read as you go.
 * @version 1.0.0
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
    "UserGuildSettingsStore", "PermissionStore", "GuildMemberStore", "UserStore"
];

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
.sf-feed { width: 100%; max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
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
.sf-msg-reply {
    position: absolute; top: -6px; right: 14px; display: none; border: none; border-radius: 6px; padding: 2px 8px; cursor: pointer;
    font-size: 12px; font-weight: 600; color: var(--interactive-active, #fff);
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22)); box-shadow: 0 1px 4px rgba(0,0,0,.3);
}
.sf-msg:hover .sf-msg-reply { display: block; }
.sf-msg-reply:hover { background: var(--brand-500, #5865f2); }
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
.sf-edited { font-size: 10px; color: var(--text-muted, #949ba4); }
.sf-deleted .sf-text { text-decoration: line-through; opacity: .6; }
.sf-reply { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted, #949ba4); margin-bottom: 2px; min-width: 0; }
.sf-reply span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-reply b { font-weight: 600; color: var(--interactive-normal, #b5bac1); }
.sf-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.sf-attachments img { max-width: 240px; max-height: 180px; border-radius: 6px; }
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
.sf-input {
    flex: 1; min-width: 0; resize: none; max-height: 140px; border: none; outline: none; border-radius: 8px; padding: 8px 10px;
    font: inherit; font-size: 14px; line-height: 1.35; color: var(--text-normal, #dbdee1);
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sf-replybar + .sf-input-row .sf-input { border-top-left-radius: 0; border-top-right-radius: 0; }
.sf-own .sf-author { color: var(--brand-360, #949cf7); }
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
        this.drafts = new Map();
        this.replyTo = new Map();

        this.onMessageCreate = action => this.addLiveMessage(action);
        this.onMessageUpdate = action => this.updateMessage(action.message);
        this.onMessageDelete = action => this.deleteMessage(action.channelId, action.id);
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

    jumpTo(channelId, messageId) {
        this.close();
        this.transitionTo?.(`/channels/${this.guildId}/${channelId}${messageId ? `/${messageId}` : ""}`);
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

        if (name === "close") this.close();
        else if (name === "refresh") this.refresh();
        else if (name === "read-all") this.markAllRead();
        else if (name === "read") this.markRead(channel);
        else if (name === "context") this.loadMoreContext(channel);
        else if (name === "more") this.loadMoreUnread(channel);
        else if (name === "profile") this.openProfile(user);
        else if (name === "jump") this.jumpTo(channel, message);
        else if (name === "reply") this.startReply(channel, message);
        else if (name === "cancel-reply") this.cancelReply(channel);
        else if (name === "send") this.send(channel);
    }

    // --- Répondre depuis le fil ---

    onInput(e) {
        const input = e.target.closest(".sf-input");
        if (!input) return;
        this.drafts.set(input.dataset.channel, input.value);
        autoSize(input);
    }

    onKeyDown(e) {
        const input = e.target.closest(".sf-input");
        if (!input) return;
        // Les raccourcis de Discord ne doivent pas intercepter ce qu'on tape ici
        if (!(e.ctrlKey && e.shiftKey && e.code === "KeyF")) e.stopPropagation();
        const channelId = input.dataset.channel;
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this.send(channelId);
        } else if (e.key === "Escape" && this.replyTo.has(channelId)) {
            e.preventDefault();
            this.cancelReply(channelId);
        }
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
        const message = { content };
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
            .sort((a, b) => a.order === null || b.order === null
                ? compareIds(b.unread[b.unread.length - 1], a.unread[a.unread.length - 1])
                : a.order - b.order);
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
        const focused = document.activeElement?.closest?.(".sf-input");
        const focus = focused && this.panel.contains(focused)
            ? { channel: focused.dataset.channel, start: focused.selectionStart, end: focused.selectionEnd }
            : null;
        this.panel.innerHTML = html;
        this.lastHtml = html;
        for (const input of this.panel.querySelectorAll(".sf-input")) {
            input.value = this.drafts.get(input.dataset.channel) ?? "";
            if (input.value) autoSize(input);
        }
        if (focus) {
            const input = this.panel.querySelector(`.sf-input[data-channel="${focus.channel}"]`);
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
        return `
            <div class="sf-card" data-channel="${card.channelId}">
                <div class="sf-card-head" data-action="jump" data-channel="${id}">
                    <span class="sf-channel">#${escapeHtml(channel?.name ?? "unknown")}</span>
                    ${category ? `<span class="sf-category">${escapeHtml(category.name)}</span>` : ""}
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
        if (author.id && author.id === this.stores.UserStore?.getCurrentUser?.()?.id) classes.push("sf-own");
        const replyButton = message.sfDeleted ? ""
            : `<button class="sf-msg-reply" data-action="reply" data-channel="${escapeHtml(message.channel_id)}" data-message="${escapeHtml(message.id)}">↩ Reply</button>`;

        const name = this.getName(author);
        const reply = message.referenced_message
            ? `<div class="sf-reply">↪ <span><b>${escapeHtml(this.getName(message.referenced_message.author ?? {}))}</b> ${escapeHtml(stripText(message.referenced_message.content))}</span></div>`
            : "";
        const meta = grouped ? "" : `
            <div class="sf-meta">
                <span class="sf-author" data-action="profile" data-user="${escapeHtml(author.id ?? "")}">${escapeHtml(name)}</span>
                ${author.bot ? `<span class="sf-bot">BOT</span>` : ""}
                <span class="sf-time">${formatTime(idToTime(message.id))}</span>
            </div>`;

        return `
            <div class="${classes.join(" ")}" data-action="jump" data-channel="${escapeHtml(message.channel_id)}" data-message="${escapeHtml(message.id)}">
                <img class="sf-avatar" src="${escapeHtml(getAvatar(author))}" alt="" data-action="profile" data-user="${escapeHtml(author.id ?? "")}">
                ${replyButton}
                <div class="sf-body">
                    ${reply}${meta}
                    <div class="sf-text">${this.renderContent(message)}${message.edited_timestamp ? ` <span class="sf-edited">(edited)</span>` : ""}</div>
                    ${renderAttachments(message)}
                </div>
            </div>`;
    }

    getName(author) {
        return this.stores.GuildMemberStore?.getNick?.(this.guildId, author.id) ?? author.global_name ?? author.username ?? "Unknown";
    }

    // Texte du message : mentions, salons, emojis personnalisés et liens
    renderContent(message) {
        let html = escapeHtml(message.content ?? "");
        // Les liens d'abord, pour ne pas toucher aux adresses des emojis ajoutés ensuite
        html = html.replace(/https?:\/\/[^\s<]+/g, url => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`);
        html = html.replace(/&#60;@!?(\d+)&#62;/g, (_, id) => {
            const user = this.stores.UserStore?.getUser?.(id);
            const mention = message.mentions?.find(item => item.id === id);
            return `<span class="sf-mention">@${escapeHtml(user ? this.getName(user) : mention ? this.getName(mention) : "user")}</span>`;
        });
        html = html.replace(/&#60;@&#38;(\d+)&#62;/g, (_, id) => {
            const role = this.stores.GuildStore?.getRole?.(this.guildId, id) ?? this.stores.GuildStore?.getGuild?.(this.guildId)?.roles?.[id];
            return `<span class="sf-mention">@${escapeHtml(role?.name ?? "role")}</span>`;
        });
        html = html.replace(/&#60;#(\d+)&#62;/g, (_, id) =>
            `<span class="sf-mention">#${escapeHtml(this.stores.ChannelStore?.getChannel?.(id)?.name ?? "channel")}</span>`);
        html = html.replace(/&#60;(a?):(\w+):(\d+)&#62;/g, (_, animated, name, id) =>
            `<img class="sf-emoji" alt=":${name}:" src="https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=48">`);

        if (!html && message.sticker_items?.length) html = `<i>Sticker: ${escapeHtml(message.sticker_items[0].name)}</i>`;
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
function renderAttachments(message) {
    const items = [];
    for (const file of message.attachments ?? []) {
        const isImage = file.content_type?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.filename ?? "");
        items.push(isImage
            ? `<img src="${escapeHtml(file.proxy_url ?? file.url)}" alt="">`
            : `<a class="sf-file" href="${escapeHtml(file.url)}" target="_blank" rel="noreferrer">📎 ${escapeHtml(file.filename)}</a>`);
    }
    for (const embed of message.embeds ?? []) {
        const image = embed.image ?? embed.thumbnail;
        if (image?.proxy_url || image?.url) items.push(`<img src="${escapeHtml(image.proxy_url ?? image.url)}" alt="">`);
    }
    return items.length ? `<div class="sf-attachments">${items.join("")}</div>` : "";
}

function getAvatar(author) {
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
