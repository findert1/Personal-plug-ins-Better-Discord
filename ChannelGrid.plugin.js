/**
 * @name ChannelGrid
 * @author findert
 * @description Replaces the long server channel list with a wider, cleaner grid of channel tiles grouped by category.
 * @version 1.0.0
 */

const DEFAULT_SETTINGS = {
    view: "grid",
    width: 380,
    hideMuted: false,
    showVoiceMembers: true
};

const MIN_WIDTH = 240;
const MAX_WIDTH = 640;
const VIEW_CHANNEL = 1n << 10n;
const VOICE_TYPES = new Set([2, 13]);
// Textes de la barre « nouveaux messages » de Discord (anglais et français)
const NATIVE_BAR_TEXT = /^(new (unreads?|mentions?)|nouveaux messages non lus|nouvelles? mentions?)$/i;

// Icônes des types de salons (texte, vocal, annonces, scène, forum, média)
const SVG_OPEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
const ICONS = {
    0: `${SVG_OPEN}<path d="M10 3 8 21M16 3l-2 18M4 8.5h16M3.5 15.5h16"/></svg>`,
    2: `${SVG_OPEN}<path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>`,
    5: `${SVG_OPEN}<path d="M3 10v4h3l8 5V5l-8 5H3Z"/><path d="M18 9.5v5M21 8v8"/></svg>`,
    13: `${SVG_OPEN}<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>`,
    15: `${SVG_OPEN}<path d="M4 5h16v11H9l-5 4V5Z"/></svg>`,
    16: `${SVG_OPEN}<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/></svg>`
};
const CHEVRON = `${SVG_OPEN}<path d="m6 9 6 6 6-6"/></svg>`;
// Icônes d'état des membres en vocal (micro coupé, casque coupé, caméra)
const MIC_OFF = `${SVG_OPEN}<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 11 4.6M12 17.5V21M3 3l18 18"/></svg>`;
const DEAF = `${SVG_OPEN}<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M3 3l18 18"/></svg>`;
const GAMEPAD = `${SVG_OPEN}<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M16 12h.01M18 14h.01"/></svg>`;
const LOCK = `${SVG_OPEN}<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const CAMERA = `${SVG_OPEN}<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3"/></svg>`;

const STORES = [
    "GuildChannelStore", "ChannelStore", "ReadStateStore", "SelectedChannelStore", "SelectedGuildStore",
    "VoiceStateStore", "UserGuildSettingsStore", "PermissionStore", "UserStore", "GuildMemberStore",
    "PresenceStore", "ApplicationStore"
];

const CSS = `
[data-cg-sidebar] { width: var(--cg-width) !important; min-width: var(--cg-width) !important; max-width: none !important; }
[data-cg-mode="grid"] { position: relative; }
[data-cg-mode="grid"] > #channels {
    position: absolute !important; top: 0; left: 0; right: 0; bottom: 0;
    opacity: 0 !important; pointer-events: none !important; z-index: -1;
}
[data-cg-mode="grid"] > .cg-root { flex: 1 1 auto; }
/* En liste, nos boutons glissent sous la bannière, par-dessus la liste de Discord */
[data-cg-mode="list"] > .cg-root { flex: none; z-index: 2; }

.cg-root { position: relative; display: flex; flex-direction: column; min-height: 0; color: var(--channels-default, #949ba4); }

/* Barre « nouveaux messages » de la liste Discord : on la remplace par la nôtre */
[data-cg-sidebar] [data-cg-native-bar] { display: none !important; }
.cg-jump {
    position: absolute; left: 50%; transform: translateX(-50%); z-index: 2;
    border: none; border-radius: 14px; padding: 6px 14px; cursor: pointer; white-space: nowrap;
    font-size: 12px; font-weight: 700; text-transform: uppercase; color: #fff;
    background: var(--brand-500, #5865f2); box-shadow: 0 2px 8px rgba(0,0,0,.35);
}
.cg-jump.cg-mention { background: var(--status-danger, #da373c); }
.cg-jump-up { top: 52px; }
.cg-jump-down { bottom: 32px; }
.cg-jump[hidden] { display: none; }
.cg-toolbar { flex: none; padding: 8px 10px 4px; }
.cg-switch {
    display: flex; padding: 3px; gap: 3px; border-radius: 8px;
    background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 8%, transparent);
}
.cg-switch button {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 500;
    color: var(--interactive-normal, #b5bac1); padding: 5px 8px; border-radius: 6px;
}
.cg-switch button:hover { color: var(--interactive-hover, #dbdee1); }
.cg-switch button.cg-active { background: var(--background-modifier-selected, rgba(78,80,88,.6)); color: var(--interactive-active, #fff); }
[data-cg-mode="list"] > .cg-root .cg-scroll { display: none; }

.cg-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 10px 16px; }
.cg-scroll::-webkit-scrollbar { width: 6px; }
.cg-scroll::-webkit-scrollbar-thumb { background: var(--scrollbar-thin-thumb, rgba(0,0,0,.4)); border-radius: 3px; }

.cg-category { margin-top: 14px; }
.cg-category:first-child { margin-top: 6px; }
.cg-cat-header {
    display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;
    font-size: 12px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase;
    color: var(--channels-default, #949ba4); padding: 0 2px 6px;
    border-bottom: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 12%, transparent);
    margin-bottom: 8px;
}
.cg-cat-header:hover { color: var(--interactive-hover, #dbdee1); }
.cg-cat-header svg { width: 14px; height: 14px; flex: none; transition: transform .15s; }
.cg-category.cg-collapsed .cg-cat-header svg { transform: rotate(-90deg); }
.cg-cat-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cg-cat-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--interactive-active, #fff); flex: none; }

.cg-boost {
    margin-top: 6px; padding: 7px 10px; border-radius: 8px; cursor: pointer;
    background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 7%, transparent);
    font-size: 12px; font-weight: 600; color: var(--interactive-hover, #dbdee1);
}
.cg-boost:hover { background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent); }
.cg-boost-text { display: flex; justify-content: space-between; gap: 8px; }
.cg-boost-text span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cg-boost-bar { margin-top: 6px; height: 4px; border-radius: 2px; overflow: hidden; background: rgba(0,0,0,.3); }
.cg-boost-bar > div { height: 100%; background: linear-gradient(90deg, #ff73fa, #b473f8); }
.cg-shortcuts { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; margin-top: 6px; }
.cg-shortcut {
    display: flex; align-items: center; gap: 8px; cursor: pointer; min-width: 0;
    padding: 6px 10px; border-radius: 8px; font-size: 13px; font-weight: 500;
    background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 7%, transparent);
    transition: background .12s, color .12s;
}
.cg-shortcut:hover { background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent); color: var(--interactive-hover, #dbdee1); }
.cg-shortcut svg { width: 16px; height: 16px; flex: none; }
.cg-shortcut-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.cg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 6px; align-items: start; }

.cg-tile {
    position: relative; display: flex; flex-direction: column; gap: 6px; cursor: pointer;
    padding: 8px 10px; border-radius: 8px; min-width: 0;
    background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 7%, transparent);
    transition: background .12s, color .12s;
}
.cg-tile:hover { background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent); color: var(--interactive-hover, #dbdee1); }
.cg-tile.cg-selected { background: var(--background-modifier-selected, rgba(78,80,88,.6)); color: var(--interactive-active, #fff); }
.cg-tile.cg-unread { color: var(--interactive-active, #fff); font-weight: 600; }
.cg-tile.cg-unread::before {
    content: ""; position: absolute; left: -4px; top: 50%; transform: translateY(-50%);
    width: 4px; height: 8px; border-radius: 0 4px 4px 0; background: var(--interactive-active, #fff);
}
.cg-tile.cg-muted { opacity: .45; }

.cg-line { display: flex; align-items: center; gap: 6px; min-width: 0; }
.cg-line svg { width: 16px; height: 16px; flex: none; opacity: .8; }
.cg-name { flex: 1; min-width: 0; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cg-badge {
    flex: none; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; box-sizing: border-box;
    background: var(--status-danger, #da373c); color: #fff; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
}
.cg-count { flex: none; font-size: 11px; opacity: .8; }
.cg-lock { display: flex; flex: none; }
.cg-line .cg-lock svg, .cg-vc-head .cg-lock svg { width: 13px; height: 13px; opacity: .7; }
.cg-tile.cg-hidden, .cg-vc.cg-hidden { opacity: .6; }

.cg-voice-list { display: flex; flex-direction: column; gap: 6px; }
.cg-grid + .cg-voice-list { margin-top: 6px; }
.cg-vc { border-radius: 8px; padding: 4px; background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 7%, transparent); }
.cg-vc.cg-muted { opacity: .45; }
.cg-vc.cg-connected { background: color-mix(in srgb, var(--status-positive, #23a55a) 16%, transparent); }
.cg-vc-head { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 6px; cursor: pointer; }
.cg-vc-head:hover { color: var(--interactive-hover, #dbdee1); background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 8%, transparent); }
.cg-vc-head svg { width: 16px; height: 16px; flex: none; opacity: .8; }
.cg-vc.cg-connected .cg-vc-head { color: var(--interactive-active, #fff); }
.cg-vc.cg-occupied .cg-vc-head .cg-name { color: var(--interactive-hover, #dbdee1); }

.cg-members {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 2px 8px; padding: 2px 6px 4px 28px;
}
.cg-member {
    display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px;
    padding: 2px 4px; margin-left: -4px; border-radius: 6px; cursor: pointer;
}
.cg-member:hover { color: var(--interactive-hover, #dbdee1); background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 10%, transparent); }
.cg-member .cg-avatar {
    width: 22px; height: 22px; border-radius: 50%; flex: none;
    box-shadow: 0 0 0 2px transparent; transition: box-shadow .1s;
}
.cg-member.cg-speaking .cg-avatar { box-shadow: 0 0 0 2px var(--status-positive, #23a55a); }
.cg-member-name { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cg-member-icons { display: flex; align-items: center; gap: 6px; flex: none; margin-left: auto; }
.cg-tag {
    display: flex; align-items: center; gap: 3px; flex: none; padding: 0 4px; height: 16px; border-radius: 4px;
    font-size: 10px; font-weight: 700; color: var(--text-normal, #dbdee1);
    background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 16%, transparent);
}
.cg-tag img { width: 12px; height: 12px; }
.cg-member svg { width: 14px; height: 14px; flex: none; color: var(--status-danger, #da373c); }
.cg-member svg.cg-neutral { color: inherit; opacity: .7; }
.cg-game { display: flex; flex: none; }
.cg-game img { width: 16px; height: 16px; border-radius: 4px; }
.cg-member .cg-game svg { width: 16px; height: 16px; color: inherit; opacity: .8; }
.cg-live {
    flex: none; font-size: 9px; font-weight: 700; color: #fff; border-radius: 4px; padding: 1px 4px;
    background: var(--status-danger, #da373c);
}

.cg-panel { color: var(--text-normal); display: flex; flex-direction: column; gap: 14px; }
.cg-panel label { display: flex; align-items: center; gap: 8px; }
.cg-panel input[type="range"] { flex: 1; }
.cg-hint { color: var(--text-muted, #949ba4); font-size: 13px; }
`;

module.exports = class ChannelGrid {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        this.settings = Object.assign({ ...DEFAULT_SETTINGS }, BdApi.Data.load(this.meta.name, "settings"));
        this.collapsed = new Set(BdApi.Data.load(this.meta.name, "collapsed") ?? []);
        this.applyStyle();

        const { Webpack } = BdApi;
        this.stores = Object.fromEntries(STORES.map(name => [name, Webpack.getStore(name)]));
        this.transitionTo = Webpack.getByStrings("transitionTo - Transitioning to", { searchExports: true })
            ?? Webpack.getByKeys("transitionTo")?.transitionTo;
        this.voiceActions = Webpack.getByKeys("selectVoiceChannel");
        this.profileActions = Webpack.getByKeys("openUserProfileModal");
        this.dispatcher = Webpack.getByKeys("dispatch", "subscribe");

        if (!this.stores.GuildChannelStore || !this.transitionTo) {
            BdApi.UI.showToast("ChannelGrid: Discord modules not found", { type: "error" });
            return;
        }

        // Le contenu de la grille est un simple HTML : un seul listener gère tous les clics
        this.root = document.createElement("div");
        this.root.className = "cg-root";
        this.root.addEventListener("click", e => this.onClick(e));
        this.root.addEventListener("contextmenu", e => this.onContextMenu(e));
        // Le scroll ne remonte pas jusqu'au parent : on l'écoute en phase de capture
        this.root.addEventListener("scroll", () => this.updateJumps(), true);

        // Toute modification des stores (non-lus, salon sélectionné, vocal...) redessine la grille
        this.onStoreChange = () => {
            this.dirty = true;
            this.schedule();
        };
        for (const store of Object.values(this.stores)) store?.addChangeListener?.(this.onStoreChange);

        // Qui parle change en continu : on met juste à jour les anneaux verts, sans tout redessiner
        this.speakingStore = Webpack.getStore("SpeakingStore");
        this.onSpeaking = () => this.updateSpeaking();
        this.speakingStore?.addChangeListener?.(this.onSpeaking);

        // Discord recrée la liste des salons quand on change de serveur : on se réinsère à chaque fois
        this.observer = new MutationObserver(() => this.schedule());
        this.observer.observe(document.getElementById("app-mount") ?? document.body, { childList: true, subtree: true });
        // La hauteur de l'en-tête (bannière) change sans modifier le DOM
        this.headerObserver = new ResizeObserver(() => this.schedule());
        this.onListScroll = () => this.schedule();

        this.dirty = true;
        this.schedule();
    }

    stop() {
        this.observer?.disconnect();
        if (this.frame) cancelAnimationFrame(this.frame);
        this.frame = 0;
        for (const store of Object.values(this.stores ?? {})) store?.removeChangeListener?.(this.onStoreChange);
        this.speakingStore?.removeChangeListener?.(this.onSpeaking);
        this.detach();
        this.root?.remove();
        BdApi.DOM.removeStyle(this.meta.name);
    }

    applyStyle() {
        BdApi.DOM.removeStyle(this.meta.name);
        BdApi.DOM.addStyle(this.meta.name, `${CSS}\n:root { --cg-width: ${this.settings.width}px; }`);
    }

    schedule() {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            this.ensure();
        });
    }

    // --- Insertion dans la barre latérale ---

    ensure() {
        const guildId = this.stores.SelectedGuildStore?.getGuildId();
        const channels = document.getElementById("channels");

        if (!guildId || !channels) {
            this.detach();
            this.warnIfMissing(guildId && !channels);
            return;
        }
        this.missingSince = 0;

        const host = channels.parentElement;
        if (this.root.parentElement !== host || this.root.nextSibling !== channels) {
            host.insertBefore(this.root, channels);
            this.dirty = true;
        }
        if (this.host !== host) {
            this.detach();
            this.host = host;
        }
        host.setAttribute("data-cg-mode", this.settings.view);

        const sidebar = host.closest('[class*="sidebar_"]');
        if (sidebar !== this.sidebar) {
            this.sidebar?.removeAttribute("data-cg-sidebar");
            this.sidebar = sidebar;
        }
        if (this.settings.view === "grid") sidebar?.setAttribute("data-cg-sidebar", "");
        else sidebar?.removeAttribute("data-cg-sidebar");
        this.hideNativeBars();
        this.syncHeader(host, channels);

        const shortcuts = this.readShortcuts(channels);
        const shortcutsKey = JSON.stringify(shortcuts);
        if (shortcutsKey !== this.shortcutsKey) {
            this.shortcutsKey = shortcutsKey;
            this.shortcuts = shortcuts;
            this.dirty = true;
        }

        if (this.dirty || this.renderedGuild !== guildId) this.render(guildId);
    }

    // La classe de la barre « nouveaux messages » de Discord change trop souvent : on la repère
    // à son texte, hors de notre grille, de la liste cachée et de la liste des serveurs
    hideNativeBars() {
        if (!this.sidebar || this.settings.view !== "grid") return;
        const walker = document.createTreeWalker(this.sidebar, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
            acceptNode: node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    return NATIVE_BAR_TEXT.test(node.data.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                }
                return node === this.root || node.id === "channels" || node.matches('[class*="guilds"], [data-cg-native-bar]')
                    ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
            }
        });

        const texts = [];
        while (walker.nextNode()) texts.push(walker.currentNode);
        for (const text of texts) {
            // On cache le premier parent positionné (la pastille entière), sinon le parent direct
            let bar = text.parentElement;
            for (let node = bar; node && !node.contains(this.root) && !node.contains(this.sidebar.querySelector('[class*="guilds"]')); node = node.parentElement) {
                if (getComputedStyle(node).position !== "static") {
                    bar = node;
                    break;
                }
            }
            bar.setAttribute("data-cg-native-bar", "");
        }
    }

    // Sur les serveurs avec bannière, l'image est posée en absolu sous le nom du serveur et
    // dépasse de son bloc : on décale nos éléments jusqu'en bas de la bannière.
    // - En grille, la liste cachée est gardée tout en haut, car Discord réduit la bannière dès
    //   qu'elle défile, et la grille est décalée par une marge.
    // - En liste, la liste de Discord laisse déjà un espace vide sous la bannière : on y fait
    //   glisser nos boutons sans changer leur place dans la page.
    syncHeader(host, channels) {
        const grid = this.settings.view === "grid";
        if (grid && !this.menuBusy && channels.scrollTop) channels.scrollTop = 0;

        const header = host.querySelector("header")?.parentElement;
        if (header !== this.header) {
            this.headerObserver?.disconnect();
            this.header = header;
            if (header) this.headerObserver.observe(header);
        }
        // La bannière disparaît quand la liste de Discord défile
        if (channels !== this.scrolledList) {
            this.scrolledList?.removeEventListener("scroll", this.onListScroll);
            this.scrolledList = channels;
            channels.addEventListener("scroll", this.onListScroll, { passive: true });
        }

        const rootTop = this.root.getBoundingClientRect().top - (this.headerOffset ?? 0);
        let bottom = rootTop;
        if (header?.matches('[class*="bannerVisible"]')) {
            const limit = host.getBoundingClientRect().top + host.clientHeight / 2;
            for (const node of [header, ...header.querySelectorAll("*")]) {
                const rect = node.getBoundingClientRect();
                if (rect.width && rect.height && rect.bottom <= limit) bottom = Math.max(bottom, rect.bottom);
            }
        }
        const offset = Math.max(0, Math.round(bottom - rootTop));
        this.headerOffset = offset;
        this.root.style.marginTop = grid && offset ? `${offset}px` : "";
        this.root.style.transform = !grid && offset ? `translateY(${offset}px)` : "";
    }

    // Haut de la liste Discord : la barre d'objectif de boost et les raccourcis
    // (Chercher des salons, Événements, Membres...). On garde l'ancien relevé pendant
    // qu'un clic droit fait défiler la liste cachée, sinon ils disparaîtraient un instant
    readShortcuts(channels) {
        if (this.menuBusy || this.settings.view !== "grid") return this.shortcuts ?? { items: [] };

        let boost = null;
        const boostBar = findNativeBoost();
        if (boostBar) {
            const texts = [...boostBar.querySelectorAll('[class*="textContentContainer"]')]
                .map(node => node.textContent.replace(/\s+/g, " ").trim());
            const progress = boostBar.querySelector('[class*="progress_"]:not([class*="progressContainer"])');
            boost = { label: texts[0] ?? "", count: texts[1] ?? "", progress: progress?.style.width ?? "" };
        }

        const items = [];
        for (const target of channels.querySelectorAll('li [role="button"][id^="channels-"][aria-label]')) {
            const row = target.closest("li");
            items.push({ label: target.getAttribute("aria-label"), icon: row.querySelector("svg")?.outerHTML ?? "" });
        }
        return { boost, items };
    }

    // Retire nos attributs de la barre latérale, ce qui réaffiche la liste normale de Discord
    detach() {
        this.headerObserver?.disconnect();
        this.header = null;
        this.scrolledList?.removeEventListener("scroll", this.onListScroll);
        this.scrolledList = null;
        this.headerOffset = 0;
        this.root.style.marginTop = this.root.style.transform = "";
        this.host?.removeAttribute("data-cg-mode");
        this.sidebar?.removeAttribute("data-cg-sidebar");
        this.host = this.sidebar = null;
    }

    // Si Discord change sa structure, la liste n'est plus trouvée : on prévient une seule fois
    warnIfMissing(missing) {
        if (!missing) {
            this.missingSince = 0;
            return;
        }
        if (!this.missingSince) this.missingSince = Date.now();
        else if (!this.warned && Date.now() - this.missingSince > 5000) {
            this.warned = true;
            BdApi.UI.showToast("ChannelGrid: channel list not found", { type: "warning" });
        }
    }

    // --- Rendu ---

    render(guildId) {
        this.dirty = false;
        const guildChanged = this.renderedGuild !== guildId;
        this.renderedGuild = guildId;

        const isGrid = this.settings.view === "grid";
        const html = `
            <div class="cg-toolbar">
                <div class="cg-switch">
                    <button data-view="grid" class="${isGrid ? "cg-active" : ""}">▦ Grid</button>
                    <button data-view="list" class="${isGrid ? "" : "cg-active"}">☰ List</button>
                </div>
            </div>
            <div class="cg-scroll">${isGrid ? this.renderShortcuts() + this.renderCategories(guildId) : ""}</div>
            <button class="cg-jump cg-jump-up" data-jump="up" hidden></button>
            <button class="cg-jump cg-jump-down" data-jump="down" hidden></button>`;

        if (html !== this.lastHtml) {
            const scrollTop = this.root.querySelector(".cg-scroll")?.scrollTop ?? 0;
            this.root.innerHTML = html;
            this.lastHtml = html;
            this.updateSpeaking();
            this.updateJumps();
            const scroll = this.root.querySelector(".cg-scroll");
            if (scroll) scroll.scrollTop = guildChanged ? 0 : scrollTop;
        }
    }

    renderShortcuts() {
        const { boost, items = [] } = this.shortcuts ?? {};
        const boostHtml = boost ? `
            <div class="cg-boost" data-boost title="${escapeHtml(`${boost.label} ${boost.count}`)}">
                <div class="cg-boost-text"><span>${escapeHtml(boost.label)}</span><span>${escapeHtml(boost.count)} ›</span></div>
                ${boost.progress ? `<div class="cg-boost-bar"><div style="width: ${escapeHtml(boost.progress)}"></div></div>` : ""}
            </div>` : "";
        const itemsHtml = items.length ? `<div class="cg-shortcuts">${items.map(item => `
            <div class="cg-shortcut" data-shortcut="${escapeHtml(item.label)}" title="${escapeHtml(item.label)}">
                ${item.icon}<span class="cg-shortcut-name">${escapeHtml(item.label)}</span>
            </div>`).join("")}</div>` : "";
        return boostHtml + itemsHtml;
    }

    renderCategories(guildId) {
        const { GuildChannelStore, ChannelStore } = this.stores;
        const lists = GuildChannelStore.getChannels(guildId) ?? {};
        const channels = [...(lists.SELECTABLE ?? []), ...(lists.VOCAL ?? [])]
            .map(entry => entry.channel)
            .filter(channel => channel && ICONS[channel.type] && (this.canView(channel) || channel.isHidden?.()));

        const selected = this.getSelectedId();

        // Regroupe par catégorie ; les salons sans catégorie passent en premier
        const groups = new Map();
        for (const channel of channels) {
            const key = channel.parent_id ?? "";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(channel);
        }

        const categoryOrder = [...groups.keys()].sort((a, b) => {
            if (!a) return -1;
            if (!b) return 1;
            return (ChannelStore.getChannel(a)?.position ?? 0) - (ChannelStore.getChannel(b)?.position ?? 0);
        });

        return categoryOrder.map(categoryId => {
            // Comme Discord : salons textuels d'abord, puis vocaux, chacun dans l'ordre du serveur
            const items = groups.get(categoryId).sort((a, b) =>
                (VOICE_TYPES.has(a.type) - VOICE_TYPES.has(b.type)) || (a.position - b.position)
            );
            return this.renderCategory(guildId, categoryId, items, selected);
        }).join("");
    }

    renderCategory(guildId, categoryId, items, selected) {
        const collapsed = this.collapsed.has(categoryId);
        const states = items.map(channel => this.getState(guildId, channel, selected));

        // Une catégorie repliée garde visibles le salon actuel et les vocaux occupés
        const visible = states.filter(state => {
            if (this.settings.hideMuted && state.muted && !state.selected) return false;
            return !collapsed || state.selected || state.connected || state.voiceUsers.length;
        });
        if (!visible.length && !categoryId) return "";
        if (!visible.length && !collapsed && this.settings.hideMuted) return "";

        // Salons textuels en tuiles, vocaux en cartes pleine largeur en dessous
        const text = visible.filter(state => !VOICE_TYPES.has(state.channel.type));
        const voice = visible.filter(state => VOICE_TYPES.has(state.channel.type));
        const tiles = [
            text.length ? `<div class="cg-grid">${text.map(state => this.renderTile(state)).join("")}</div>` : "",
            voice.length ? `<div class="cg-voice-list">${voice.map(state => this.renderVoice(guildId, state)).join("")}</div>` : ""
        ].join("");
        if (!categoryId) return `<div class="cg-category">${tiles}</div>`;

        const name = this.stores.ChannelStore.getChannel(categoryId)?.name ?? "";
        const hasUnread = collapsed && states.some(state => state.unread && !state.muted);
        return `
            <div class="cg-category${collapsed ? " cg-collapsed" : ""}">
                <div class="cg-cat-header" data-category="${escapeHtml(categoryId)}">
                    ${CHEVRON}<span class="cg-cat-name">${escapeHtml(name)}</span>
                    ${hasUnread ? `<span class="cg-cat-dot"></span>` : ""}
                </div>
                ${tiles}
            </div>`;
    }

    renderTile(state) {
        const { channel } = state;
        const classes = ["cg-tile"];
        if (state.selected) classes.push("cg-selected");
        if (state.unread && !state.muted) classes.push("cg-unread");
        if (state.muted) classes.push("cg-muted");
        if (state.hidden) classes.push("cg-hidden");

        const lock = state.hidden ? `<span class="cg-lock" title="Hidden Channel">${LOCK}</span>` : "";
        const badge = state.mentions ? `<span class="cg-badge">${state.mentions > 99 ? "99+" : state.mentions}</span>` : "";
        return `
            <div class="${classes.join(" ")}" data-channel="${escapeHtml(channel.id)}" title="${escapeHtml(channel.name)}">
                <div class="cg-line">${ICONS[channel.type]}<span class="cg-name">${escapeHtml(channel.name)}</span>${badge}${lock}</div>
            </div>`;
    }

    // Un vocal est une carte pleine largeur : en-tête cliquable, puis la liste des membres
    renderVoice(guildId, state) {
        const { channel, voiceUsers } = state;
        const classes = ["cg-vc"];
        if (state.connected) classes.push("cg-connected");
        if (voiceUsers.length) classes.push("cg-occupied");
        if (state.muted && !voiceUsers.length) classes.push("cg-muted");
        if (state.hidden) classes.push("cg-hidden");
        const lock = state.hidden ? `<span class="cg-lock" title="Hidden Channel">${LOCK}</span>` : "";

        const limit = channel.userLimit || channel.user_limit;
        const count = voiceUsers.length
            ? `<span class="cg-count">${voiceUsers.length}${limit ? ` / ${limit}` : ""}</span>`
            : "";

        const members = this.settings.showVoiceMembers && voiceUsers.length
            ? `<div class="cg-members">${voiceUsers.map(member => this.renderMember(guildId, member)).join("")}</div>`
            : "";

        return `
            <div class="${classes.join(" ")}">
                <div class="cg-vc-head" data-channel="${escapeHtml(channel.id)}" title="${escapeHtml(channel.name)}">
                    ${ICONS[channel.type]}<span class="cg-name">${escapeHtml(channel.name)}</span>${count}${lock}
                </div>
                ${members}
            </div>`;
    }

    renderMember(guildId, { user, voiceState }) {
        const name = this.stores.GuildMemberStore?.getNick?.(guildId, user.id) ?? user.globalName ?? user.username;
        const icons = [
            this.renderGame(user.id),
            voiceState.selfStream ? `<span class="cg-live">LIVE</span>` : "",
            voiceState.selfVideo ? CAMERA.replace("<svg", `<svg class="cg-neutral"`) : "",
            voiceState.selfDeaf || voiceState.deaf ? DEAF
                : voiceState.selfMute || voiceState.mute ? MIC_OFF : ""
        ].join("");
        return `
            <div class="cg-member" data-user="${escapeHtml(user.id)}">
                <img class="cg-avatar" src="${escapeHtml(getAvatar(user, guildId))}" alt="">
                <span class="cg-member-name">${escapeHtml(name)}</span>${renderGuildTag(user)}
                <span class="cg-member-icons">${icons}</span>
            </div>`;
    }

    // Icône du jeu en cours, comme dans la liste de Discord
    renderGame(userId) {
        const activities = this.stores.PresenceStore?.getActivities?.(userId) ?? [];
        const game = activities.find(activity => activity.type === 0);
        if (!game) return "";

        const appId = game.application_id;
        const appIcon = appId && this.stores.ApplicationStore?.getApplication?.(appId)?.icon;
        const asset = game.assets?.large_image;
        let url = null;
        if (appIcon) url = `https://cdn.discordapp.com/app-icons/${appId}/${appIcon}.png?size=32`;
        else if (appId && asset && !asset.includes(":")) url = `https://cdn.discordapp.com/app-assets/${appId}/${asset}.png?size=32`;

        const icon = url ? `<img src="${escapeHtml(url)}" alt="">` : GAMEPAD;
        return `<span class="cg-game" title="Playing ${escapeHtml(game.name)}">${icon}</span>`;
    }

    // Anneau vert autour des membres qui parlent
    updateSpeaking() {
        if (!this.speakingStore || !this.root?.isConnected) return;
        for (const member of this.root.querySelectorAll(".cg-member")) {
            member.classList.toggle("cg-speaking", Boolean(this.speakingStore.isSpeaking?.(member.dataset.user)));
        }
    }

    getState(guildId, channel, selected) {
        const { ReadStateStore, UserGuildSettingsStore, VoiceStateStore, UserStore } = this.stores;
        const muted = Boolean(
            UserGuildSettingsStore?.isChannelMuted?.(guildId, channel.id)
            || (channel.parent_id && UserGuildSettingsStore?.isChannelMuted?.(guildId, channel.parent_id))
        );

        let voiceUsers = [];
        if (VOICE_TYPES.has(channel.type)) {
            const voiceStates = VoiceStateStore?.getVoiceStatesForChannel?.(channel.id) ?? {};
            voiceUsers = Object.values(voiceStates)
                .map(voiceState => ({ voiceState, user: UserStore?.getUser(voiceState.userId) }))
                .filter(member => member.user);
        }

        return {
            channel,
            muted,
            voiceUsers,
            selected: channel.id === selected,
            hidden: !this.canView(channel),
            connected: channel.id === this.stores.SelectedChannelStore?.getVoiceChannelId?.(),
            unread: Boolean(ReadStateStore?.hasUnread?.(channel.id)),
            mentions: ReadStateStore?.getMentionCount?.(channel.id) ?? 0
        };
    }

    // Dans un fil, on met en avant le salon parent
    getSelectedId() {
        const { SelectedChannelStore, ChannelStore } = this.stores;
        const id = SelectedChannelStore?.getChannelId();
        const channel = id && ChannelStore.getChannel(id);
        return channel?.isThread?.() ? channel.parent_id : id;
    }

    canView(channel) {
        try {
            return this.stores.PermissionStore?.can(VIEW_CHANNEL, channel) ?? true;
        } catch {
            return true;
        }
    }

    // --- Barres « nouveaux messages » ---

    // Salons non lus hors de l'écran, au-dessus et en dessous de la zone visible
    getOffscreenUnreads() {
        const scroll = this.root.querySelector(".cg-scroll");
        const result = { up: [], down: [] };
        if (!scroll || this.settings.view !== "grid") return result;

        const view = scroll.getBoundingClientRect();
        for (const tile of scroll.querySelectorAll(".cg-tile.cg-unread, .cg-tile:has(.cg-badge)")) {
            const rect = tile.getBoundingClientRect();
            if (rect.bottom < view.top + 8) result.up.push(tile);
            else if (rect.top > view.bottom - 8) result.down.push(tile);
        }
        return result;
    }

    updateJumps() {
        const offscreen = this.getOffscreenUnreads();
        for (const direction of ["up", "down"]) {
            const button = this.root.querySelector(`[data-jump="${direction}"]`);
            if (!button) continue;
            const tiles = offscreen[direction];
            const mention = tiles.some(tile => tile.querySelector(".cg-badge"));
            button.hidden = !tiles.length;
            button.classList.toggle("cg-mention", mention);
            button.textContent = `${direction === "up" ? "▲" : "▼"} ${mention ? "New mentions" : "New unreads"}`;
        }
    }

    // Va au salon non lu le plus proche dans la direction choisie
    jumpToUnread(direction) {
        const tiles = this.getOffscreenUnreads()[direction];
        const target = direction === "up" ? tiles[tiles.length - 1] : tiles[0];
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    // --- Interactions ---

    onClick(e) {
        const jump = e.target.closest("[data-jump]");
        if (jump) {
            this.jumpToUnread(jump.dataset.jump);
            return;
        }

        const viewButton = e.target.closest("[data-view]");
        if (viewButton) {
            if (viewButton.dataset.view !== this.settings.view) {
                this.settings.view = viewButton.dataset.view;
                this.saveSettings();
            }
            return;
        }

        const header = e.target.closest("[data-category]");
        if (header) {
            const id = header.dataset.category;
            if (this.collapsed.has(id)) this.collapsed.delete(id);
            else this.collapsed.add(id);
            BdApi.Data.save(this.meta.name, "collapsed", [...this.collapsed]);
            this.dirty = true;
            this.schedule();
            return;
        }

        const member = e.target.closest("[data-user]");
        if (member) {
            this.openProfile(member.dataset.user);
            return;
        }

        // Les raccourcis cliquent sur le vrai bouton de la liste Discord
        if (e.target.closest("[data-boost]")) {
            findNativeBoost()?.click();
            return;
        }
        const shortcut = e.target.closest("[data-shortcut]");
        if (shortcut) {
            findNativeShortcut(shortcut.dataset.shortcut)?.click();
            return;
        }

        const tile = e.target.closest("[data-channel]");
        if (tile) this.openChannel(tile.dataset.channel);
    }

    // Le clic droit est renvoyé sur l'élément correspondant de la liste Discord (cachée),
    // ce qui ouvre le vrai menu de Discord à la position de la souris
    async onContextMenu(e) {
        const member = e.target.closest("[data-user]");
        const tile = member ? null : e.target.closest("[data-channel]");
        if (!member && !tile) return;
        e.preventDefault();
        e.stopPropagation();

        const { clientX, clientY, screenX, screenY } = e;
        this.menuBusy = true;
        const find = member
            ? () => findNativeUser(member.dataset.user)
            : () => document.querySelector(`#channels [data-list-item-id="channels___${tile.dataset.channel}"]`);
        let target = await this.findNative(find);
        let expanded = null;
        if (!target) {
            expanded = await this.expandCategoryOf((member ?? tile).closest("[data-channel]")?.dataset.channel);
            if (expanded) target = await this.findNative(find);
        }

        if (!target) {
            this.collapseAfterMenu(expanded);
            BdApi.UI.showToast("ChannelGrid: right-click menu unavailable here, try List view", { type: "warning" });
            return;
        }
        target.dispatchEvent(new MouseEvent("contextmenu", {
            bubbles: true, cancelable: true, view: window,
            clientX, clientY, screenX, screenY, button: 2, buttons: 2
        }));
        this.collapseAfterMenu(expanded);
    }

    // Un salon d'une catégorie réduite dans la liste Discord n'y existe pas : on déplie
    // la catégorie le temps du menu, en cliquant dessus comme le ferait l'utilisateur.
    // Renvoie l'id de la catégorie dépliée, s'il y en a une
    async expandCategoryOf(channelId) {
        const parentId = this.stores.ChannelStore?.getChannel?.(channelId)?.parent_id;
        if (!parentId) return null;
        const category = await this.findNative(() => findNativeCategory(parentId));
        if (!category) return null;

        category.click();
        await nextFrame();
        await nextFrame();
        return parentId;
    }

    // Une fois le menu clic droit fermé : replie la catégorie dépliée et remet la liste
    // cachée tout en haut (sinon Discord masque la bannière du serveur)
    collapseAfterMenu(parentId) {
        const collapse = async () => {
            if (parentId) (await this.findNative(() => findNativeCategory(parentId)))?.click();
            this.menuBusy = false;
            this.schedule();
        };
        const isOpen = () => document.querySelector('[class*="contextMenu"], [role="menu"]');
        let opened = false;
        const started = Date.now();
        const timer = setInterval(() => {
            if (isOpen()) opened = true;
            else if (opened || Date.now() - started > 1000) {
                clearInterval(timer);
                collapse();
            }
        }, 150);
    }

    // La liste Discord n'affiche que les salons visibles à l'écran : on la fait défiler
    // jusqu'à ce que l'élément voulu existe
    async findNative(find) {
        const scroller = document.getElementById("channels");
        if (!scroller) return null;

        let node = find();
        if (node) return node;

        const start = scroller.scrollTop;
        scroller.scrollTop = 0;
        for (let i = 0; i < 80; i++) {
            await nextFrame();
            await nextFrame();
            node = find();
            if (node) return node;
            if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) break;
            scroller.scrollTop += Math.max(100, scroller.clientHeight * 0.8);
        }
        scroller.scrollTop = start;
        return null;
    }

    openChannel(channelId) {
        const channel = this.stores.ChannelStore.getChannel(channelId);
        if (!channel) return;

        // Un clic sur un vocal le rejoint, sauf si on y est déjà : on ouvre alors sa vue
        if (VOICE_TYPES.has(channel.type) && this.voiceActions && this.canView(channel)
            && this.stores.SelectedChannelStore?.getVoiceChannelId?.() !== channelId) {
            this.voiceActions.selectVoiceChannel(channelId);
            return;
        }
        this.transitionTo(`/channels/${channel.guild_id}/${channelId}`);
    }

    // Ouvre le profil complet du membre, comme un clic sur son nom dans Discord
    openProfile(userId) {
        const options = {
            userId,
            guildId: this.renderedGuild,
            channelId: this.stores.SelectedChannelStore?.getChannelId?.(),
            analyticsLocation: { section: "Channel List" }
        };
        try {
            if (this.profileActions) this.profileActions.openUserProfileModal(options);
            else this.dispatcher.dispatch({ type: "USER_PROFILE_MODAL_OPEN", ...options });
        } catch {
            BdApi.UI.showToast("ChannelGrid: couldn't open this profile", { type: "error" });
        }
    }

    // --- Paramètres ---

    saveSettings() {
        BdApi.Data.save(this.meta.name, "settings", this.settings);
        this.applyStyle();
        this.dirty = true;
        this.schedule();
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "cg-panel";

        const widthLabel = el("label");
        const widthText = el("span", "", `Sidebar width: ${this.settings.width}px`);
        const width = el("input");
        Object.assign(width, { type: "range", min: MIN_WIDTH, max: MAX_WIDTH, step: 10, value: this.settings.width });
        width.addEventListener("input", () => {
            this.settings.width = Number(width.value);
            widthText.textContent = `Sidebar width: ${this.settings.width}px`;
            this.saveSettings();
        });
        widthLabel.append(widthText, width);

        panel.append(
            widthLabel,
            this.checkbox("Hide muted channels", "hideMuted"),
            this.checkbox("Show who is in voice channels", "showVoiceMembers"),
            el("div", "cg-hint", "Click a category name to fold it. Use the Grid / List switch at the top of the channel list to switch back to Discord's list at any time.")
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
            this.saveSettings();
        });
        label.append(input, el("span", "", text));
        return label;
    }
};

// Retrouve un membre en vocal dans la liste Discord via les props React de ses éléments
function findNativeUser(userId) {
    for (const node of document.querySelectorAll('#channels [class*="voiceUser"]')) {
        let fiber = BdApi.ReactUtils.getInternalInstance(node);
        for (let depth = 0; fiber && depth < 12; depth++, fiber = fiber.return) {
            const props = fiber.memoizedProps;
            if (props?.user?.id === userId || props?.userId === userId) return node;
        }
    }
    const avatar = document.querySelector(`#channels img[src*="/${userId}/"]`);
    return avatar?.closest('[class*="voiceUser"]') ?? avatar;
}

// Barre « Objectif de Boost » et raccourcis du haut de la liste Discord
function findNativeBoost() {
    return document.querySelector('#channels [role="button"]:has([class*="progressContainer"])');
}

function findNativeShortcut(label) {
    for (const target of document.querySelectorAll('#channels li [role="button"][id^="channels-"][aria-label]')) {
        if (target.getAttribute("aria-label") !== label) continue;
        // Le clic est géré par le lien voisin de la zone de focus
        return target.closest("li").querySelector('[class*="link"]') ?? target;
    }
    return null;
}

// Élément cliquable d'une catégorie dans la liste Discord
function findNativeCategory(categoryId) {
    const item = document.querySelector(`#channels [data-list-item-id="channels___${categoryId}"]`);
    if (item) return item.closest('[role="button"]') ?? item;

    // Sinon on la retrouve via les props React des éléments de la liste
    for (const node of document.querySelectorAll('#channels [role="button"]')) {
        let fiber = BdApi.ReactUtils.getInternalInstance(node);
        for (let depth = 0; fiber && depth < 8; depth++, fiber = fiber.return) {
            const props = fiber.memoizedProps;
            if (props?.channel?.id === categoryId && props.channel.type === 4) return node;
        }
    }
    return null;
}

function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
}

// Tag de serveur affiché à côté du pseudo (avec son petit badge), comme dans Discord
function renderGuildTag(user) {
    const guild = user?.primaryGuild ?? user?.primary_guild;
    if (!guild?.tag || guild.identityEnabled === false) return "";
    const guildId = guild.identityGuildId ?? guild.identity_guild_id;
    const badge = guild.badge && guildId
        ? `<img src="https://cdn.discordapp.com/guild-tag-badges/${escapeHtml(guildId)}/${escapeHtml(guild.badge)}.png?size=16" alt="">`
        : "";
    return `<span class="cg-tag">${badge}${escapeHtml(guild.tag)}</span>`;
}

function getAvatar(user, guildId) {
    try {
        return user.getAvatarURL(guildId, 32);
    } catch {
        return "https://cdn.discordapp.com/embed/avatars/0.png";
    }
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
