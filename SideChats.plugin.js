/**
 * @name SideChats
 * @author findert
 * @description Open other chats (any server channel, DM or group) live next to the main view, like split screens. Resize, fold and stack them as you like.
 * @version 1.0.1
 */

const DEFAULT_SETTINGS = {
    layout: "columns",
    stackWidth: 420,
    markRead: true,
    sendTyping: true
};

// Salons où l'on peut discuter : texte, MP, vocal (son chat), groupe, annonces, fils et scènes
const CHAT_TYPES = new Set([0, 1, 2, 3, 5, 10, 11, 12, 13]);
// Salons de serveur proposés dans la liste : texte, annonces, vocaux et scènes
const GUILD_TYPES = new Set([0, 2, 5, 13]);
const VIEW_CHANNEL = 1n << 10n;
const PAGE_SIZE = 50;
const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 260;
const COLLAPSED_WIDTH = 46;
// Place minimale laissée au salon principal
const MIN_MAIN_WIDTH = 420;
const TYPING_DELAY = 9000;
const DISCORD_EPOCH = 1420070400000n;

const STORES = [
    "ChannelStore", "GuildChannelStore", "GuildStore", "SelectedGuildStore", "SelectedChannelStore", "PrivateChannelSortStore",
    "SortedGuildStore", "UserGuildSettingsStore", "PermissionStore", "GuildMemberStore", "UserStore", "EmojiStore", "GuildRoleStore"
];
const EMOJI_CATEGORIES = {
    people: "😀", nature: "🐻", food: "🍔", activity: "⚽",
    travel: "🚗", objects: "💡", symbols: "❤️", flags: "🏁"
};
const RECENT_LIMIT = 24;

const CSS = `
/* Les fenêtres occupent le bord droit de la zone du salon, qui garde la place pour elles */
[data-sc-page] { padding-right: var(--sc-dock-width, 0px) !important; box-sizing: border-box !important; }
[data-sc-page][data-sc-static] { position: relative !important; }
[data-sc-page] > .sf-panel { right: var(--sc-dock-width, 0px); }
.sc-dock {
    position: absolute; top: 0; right: 0; bottom: 0; z-index: 160; display: flex; overflow-x: auto; overflow-y: hidden;
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sc-dock.sc-stacked { flex-direction: column; }
.sc-pane {
    position: relative; flex: none; display: flex; min-height: 0; height: 100%; color: var(--text-normal, #dbdee1);
    background: var(--background-base-lower, var(--background-primary, #313338));
    border-left: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent);
}
.sc-stacked .sc-pane { height: auto; flex: 1 1 0; width: auto !important; border-top: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent); }
.sc-stacked .sc-pane.sc-collapsed { flex: none; }
.sc-pane.sc-flash { animation: sc-flash .7s; }
@keyframes sc-flash { 0%, 100% { box-shadow: none; } 40% { box-shadow: inset 0 0 0 2px var(--brand-500, #5865f2); } }
.sc-resize { position: absolute; top: 0; bottom: 0; left: -3px; width: 6px; z-index: 5; cursor: col-resize; }
.sc-resize:hover, .sc-resize.sc-dragging { background: var(--brand-500, #5865f2); }
.sc-stacked .sc-pane .sc-resize { display: none; }
.sc-dock-resize { display: none; }
.sc-stacked > .sc-dock-resize { display: block; position: absolute; top: 0; bottom: 0; left: 0; width: 6px; z-index: 6; cursor: col-resize; }
.sc-stacked > .sc-dock-resize:hover, .sc-stacked > .sc-dock-resize.sc-dragging { background: var(--brand-500, #5865f2); }
.sc-inner { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.sc-collapsed .sc-inner { display: none; }
.sc-strip { display: none; }
.sc-collapsed .sc-strip {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0; cursor: pointer; min-width: 0; overflow: hidden;
}
.sc-stacked .sc-collapsed .sc-strip { flex-direction: row; padding: 6px 10px; }
.sc-strip:hover { background: var(--background-modifier-hover, #393c41); }
.sc-strip-name { writing-mode: vertical-rl; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-height: 100%; }
.sc-stacked .sc-strip-name { writing-mode: horizontal-tb; }

.sc-head {
    flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 10px; min-width: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent);
}
.sc-icon { width: 26px; height: 26px; border-radius: 50%; flex: none; object-fit: cover; display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; background: var(--background-base-lowest, #1e1f22); color: var(--text-normal, #dbdee1); overflow: hidden; }
.sc-title { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.sc-title b { font-size: 14px; color: var(--header-primary, #f2f3f5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-title small { font-size: 11px; color: var(--text-muted, #949ba4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-head-btn {
    flex: none; width: 26px; height: 26px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; padding: 0;
    color: var(--interactive-normal, #b5bac1); background: none;
}
.sc-head-btn:hover { color: var(--interactive-active, #fff); background: var(--background-modifier-hover, #393c41); }
.sc-badge { flex: none; font-size: 11px; font-weight: 700; color: #fff; background: var(--status-danger, #f23f43); border-radius: 10px; padding: 1px 6px; }

.sc-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 8px 0 4px; }
.sc-info { text-align: center; color: var(--text-muted, #949ba4); padding: 16px 10px; font-size: 13px; }
.sc-info.sc-error { color: var(--status-danger, #f23f43); }
.sc-newbar {
    flex: none; margin: 0 10px; border: none; border-radius: 6px 6px 0 0; padding: 4px 10px; cursor: pointer; font-size: 12px; font-weight: 600;
    color: #fff; background: var(--brand-500, #5865f2);
}
.sc-newbar[hidden] { display: none; }
.sc-typing { flex: none; height: 16px; padding: 0 12px; font-size: 11px; color: var(--text-muted, #949ba4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-composer { flex: none; padding: 2px 10px 10px; }

.sc-toggle {
    flex: none; align-self: center; margin: 0 8px; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer;
    font-size: 13px; font-weight: 600; white-space: nowrap; color: #fff; background: var(--brand-500, #5865f2);
}
.sc-toggle:hover { filter: brightness(1.1); }
[data-sc-host] { position: relative; }
.sc-toggle.sc-floating { position: absolute; top: 10px; right: 110px; z-index: 40; margin: 0; }

.sc-chooser {
    position: fixed; z-index: 1000; width: 360px; max-height: min(520px, 80vh); display: flex; flex-direction: column; overflow: hidden;
    border-radius: 10px; background: var(--background-base-low, var(--background-secondary, #2b2d31)); color: var(--text-normal, #dbdee1);
    box-shadow: 0 8px 24px rgba(0,0,0,.45); border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 12%, transparent);
}
.sc-chooser-search {
    margin: 8px; border: none; outline: none; border-radius: 6px; padding: 7px 10px; font: inherit; font-size: 14px;
    color: var(--text-normal, #dbdee1); background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sc-chooser-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 6px 6px; }
.sc-chooser-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #949ba4); padding: 8px 6px 4px; }
.sc-choice { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; cursor: pointer; font-size: 14px; min-width: 0; }
.sc-choice.sc-active { background: var(--background-modifier-selected, #404249); }
.sc-choice .sc-icon { width: 24px; height: 24px; }
.sc-choice span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-choice small { flex: none; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted, #949ba4); font-size: 12px; }
.sc-choice .sc-open-tag { color: var(--brand-360, #949cf7); font-weight: 600; }
.sc-chooser-empty { color: var(--text-muted, #949ba4); padding: 14px 8px; font-size: 13px; }
.sc-chooser-foot {
    flex: none; display: flex; align-items: center; gap: 6px; padding: 8px; font-size: 12px; color: var(--text-muted, #949ba4);
    border-top: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 10%, transparent);
}
.sc-chooser-foot .sc-spacer { flex: 1; }

.sc-btn {
    flex: none; border: none; border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 12px; font-weight: 500;
    color: var(--interactive-active, #fff); background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent);
}
.sc-btn:hover { background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 24%, transparent); }
.sc-btn.sc-primary, .sc-btn.sc-on { background: var(--brand-500, #5865f2); }
.sc-btn.sc-primary:hover { filter: brightness(1.1); }

.sc-msg { position: relative; display: flex; gap: 10px; padding: 3px 12px; }
.sc-msg:hover { background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 6%, transparent); }
.sc-msg.sc-grouped { padding-top: 0; }
.sc-msg.sc-grouped .sc-avatar { visibility: hidden; height: 0; }
.sc-msg.sc-replying { background: color-mix(in srgb, var(--brand-500, #5865f2) 12%, transparent); box-shadow: inset 2px 0 0 var(--brand-500, #5865f2); }
.sc-msg.sc-mentioned { background: var(--background-mentioned, rgba(240, 177, 50, .1)); box-shadow: inset 2px 0 0 var(--info-warning-foreground, #f0b232); }
.sc-msg-tools {
    position: absolute; top: -8px; right: 10px; display: none; gap: 2px; padding: 2px; border-radius: 6px; z-index: 2;
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22)); box-shadow: 0 1px 4px rgba(0,0,0,.3);
}
.sc-msg:hover .sc-msg-tools { display: flex; }
.sc-msg-tools button {
    border: none; border-radius: 4px; padding: 2px 7px; cursor: pointer; background: none;
    font-size: 12px; font-weight: 600; color: var(--interactive-active, #fff);
}
.sc-msg-tools button:hover { background: var(--brand-500, #5865f2); }
.sc-avatar { width: 32px; height: 32px; border-radius: 50%; flex: none; cursor: pointer; }
.sc-body { flex: 1; min-width: 0; }
.sc-meta { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.sc-author { font-weight: 600; font-size: 14px; color: var(--header-primary, #f2f3f5); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-author:hover { text-decoration: underline; }
.sc-own .sc-author { color: var(--brand-360, #949cf7); }
.sc-bot { font-size: 10px; font-weight: 700; color: #fff; background: var(--brand-500, #5865f2); border-radius: 3px; padding: 0 4px; }
.sc-time { flex: none; font-size: 11px; color: var(--text-muted, #949ba4); }
.sc-text { font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word; }
.sc-text a { color: var(--text-link, #00a8fc); }
.sc-text .sc-mention { color: var(--mention-foreground, #c9cdfb); background: var(--mention-background, rgba(88,101,242,.3)); border-radius: 3px; padding: 0 2px; }
.sc-text .sc-mention[data-action] { cursor: pointer; }
.sc-text .sc-mention[data-action]:hover { background: var(--brand-500, #5865f2); color: #fff; }
.sc-text .sc-emoji { width: 20px; height: 20px; vertical-align: -5px; }
.sc-text .sc-h { font-weight: 700; line-height: 1.25; margin: 6px 0 2px; color: var(--header-primary, #f2f3f5); }
.sc-text .sc-h1 { font-size: 20px; }
.sc-text .sc-h2 { font-size: 17px; }
.sc-text .sc-h3 { font-size: 15px; }
.sc-text .sc-subtext { font-size: 12px; color: var(--text-muted, #949ba4); }
.sc-text .sc-quote { border-left: 4px solid var(--background-modifier-accent, #4e5058); padding-left: 10px; margin: 2px 0; }
.sc-text .sc-li { display: flex; gap: 6px; }
.sc-text .sc-bullet { flex: none; min-width: 10px; }
.sc-text .sc-code, .sc-text .sc-codeblock {
    font-family: var(--font-code, Consolas, "Courier New", monospace); font-size: 85%;
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sc-text .sc-code { padding: 1px 4px; border-radius: 4px; }
.sc-text .sc-codeblock {
    display: block; margin: 4px 0; padding: 8px 10px; border-radius: 6px; white-space: pre-wrap; overflow-x: auto;
    border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 12%, transparent);
}
.sc-text .sc-spoiler { border-radius: 3px; cursor: pointer; background: var(--background-base-lowest, #1e1f22); color: transparent; }
.sc-text .sc-spoiler:not(.sc-revealed) * { visibility: hidden; }
.sc-text .sc-spoiler.sc-revealed { cursor: auto; color: inherit; background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 15%, transparent); }
.sc-text .sc-timestamp { border-radius: 3px; padding: 0 2px; background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 12%, transparent); }
.sc-edited { font-size: 10px; color: var(--text-muted, #949ba4); }
.sc-deleted .sc-text { text-decoration: line-through; opacity: .6; }
.sc-reply { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted, #949ba4); margin-bottom: 2px; min-width: 0; }
.sc-reply span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-reply b { font-weight: 600; color: var(--interactive-normal, #b5bac1); }
.sc-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.sc-attachments img, .sc-attachments video { max-width: min(320px, 100%); max-height: 240px; border-radius: 6px; cursor: zoom-in; }
.sc-attachments video.sc-video { cursor: auto; background: #000; }
.sc-file { font-size: 13px; color: var(--text-link, #00a8fc); }
.sc-stickers { display: flex; gap: 6px; margin-top: 4px; }
.sc-sticker { width: 140px; height: 140px; object-fit: contain; }
.sc-lottie:not(.sc-ready) { width: auto; height: auto; }
.sc-reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.sc-reaction {
    display: flex; align-items: center; gap: 4px; border-radius: 8px; padding: 2px 6px; cursor: pointer; font-size: 13px; font-weight: 600;
    color: var(--interactive-normal, #b5bac1); background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
    border: 1px solid transparent;
}
.sc-reaction:hover { border-color: color-mix(in srgb, var(--interactive-normal, #b5bac1) 30%, transparent); }
.sc-reaction.sc-me { color: var(--interactive-active, #fff); background: color-mix(in srgb, var(--brand-500, #5865f2) 25%, transparent); border-color: var(--brand-500, #5865f2); }
.sc-reaction img, .sc-picker img { width: 18px; height: 18px; object-fit: contain; }
.sc-reaction-add { opacity: 0; }
.sc-msg:hover .sc-reaction-add { opacity: 1; }
.sc-separator {
    display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 11px; font-weight: 600;
    color: var(--text-muted, #949ba4);
}
.sc-separator::before, .sc-separator::after { content: ""; flex: 1; height: 1px; background: color-mix(in srgb, var(--interactive-normal, #b5bac1) 14%, transparent); }
.sc-edit { margin-top: 4px; }
.sc-edit-hint { font-size: 12px; color: var(--text-muted, #949ba4); margin-top: 3px; }
.sc-edit-hint span { color: var(--text-link, #00a8fc); cursor: pointer; }

.sc-replybar {
    display: flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 12px; border-radius: 8px 8px 0 0;
    color: var(--text-muted, #949ba4); background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sc-replybar:empty { display: none; }
.sc-replybar b { color: var(--interactive-normal, #b5bac1); }
.sc-replybar span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-replybar button { border: none; background: none; cursor: pointer; color: inherit; font-size: 14px; padding: 0 2px; }
.sc-replybar button:hover { color: var(--interactive-active, #fff); }
.sc-input-row { display: flex; gap: 6px; align-items: flex-end; }
.sc-input-row .sc-btn { font-size: 16px; padding: 4px 9px; }
.sc-input, .sc-edit-input {
    flex: 1; min-width: 0; resize: none; max-height: 140px; border: none; outline: none; border-radius: 8px; padding: 8px 10px;
    font: inherit; font-size: 14px; line-height: 1.35; color: var(--text-normal, #dbdee1);
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sc-replybar:not(:empty) + .sc-input-row .sc-input { border-top-left-radius: 0; border-top-right-radius: 0; }
.sc-edit-input { display: block; width: 100%; box-sizing: border-box; }
.sc-input-row .sc-gif-btn { font-size: 11px; font-weight: 700; padding: 6px 7px; }
.sc-files { display: flex; flex-wrap: wrap; gap: 6px; }
.sc-files:not(:empty) { padding-bottom: 6px; }
.sc-files.sc-uploading { opacity: .5; pointer-events: none; }
.sc-file-chip {
    display: flex; align-items: center; gap: 6px; max-width: 180px; padding: 4px 6px; border-radius: 6px; font-size: 12px;
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sc-file-chip img { width: 36px; height: 36px; border-radius: 4px; object-fit: cover; flex: none; }
.sc-file-chip span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-file-chip button { flex: none; border: none; background: none; cursor: pointer; color: var(--interactive-normal, #b5bac1); padding: 0 2px; }
.sc-file-chip button:hover { color: var(--status-danger, #f23f43); }
.sc-gif-tabs { flex: none; display: flex; gap: 6px; padding: 0 8px 6px; }
.sc-gif-body { flex: 1; min-height: 0; overflow-y: auto; display: flex; gap: 6px; padding: 0 8px 8px; align-items: flex-start; }
.sc-gif-column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.sc-gif { width: 100%; border-radius: 6px; cursor: pointer; background: var(--background-base-lowest, #1e1f22); }
.sc-gif:hover { outline: 2px solid var(--brand-500, #5865f2); }

.sc-picker {
    position: fixed; z-index: 1000; width: 420px; height: 400px; display: flex; flex-direction: column; overflow: hidden;
    border-radius: 10px; background: var(--background-base-low, var(--background-secondary, #2b2d31));
    box-shadow: 0 8px 24px rgba(0,0,0,.45); border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 12%, transparent);
}
.sc-picker-search {
    margin: 8px; border: none; outline: none; border-radius: 6px; padding: 6px 10px; font: inherit; font-size: 14px;
    color: var(--text-normal, #dbdee1); background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sc-picker-main { flex: 1; min-height: 0; display: flex; }
.sc-picker-tabs {
    flex: none; width: 52px; overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
    display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px 0;
    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
}
.sc-picker-tabs::-webkit-scrollbar { display: none; }
.sc-picker-tabs button { width: 36px; height: 36px; min-width: 36px; min-height: 36px; flex: none; border: none; border-radius: 50%; padding: 0; cursor: pointer; background: none; opacity: .6; font-size: 18px; overflow: hidden; color: var(--text-normal, #dbdee1); }
.sc-picker-tabs button.sc-active, .sc-picker-tabs button:hover { opacity: 1; background: var(--background-modifier-selected, #404249); }
.sc-picker-tabs button img { display: block; width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
.sc-picker-tabs .sc-letter { font-size: 11px; font-weight: 700; }
.sc-picker-body { flex: 1; min-width: 0; overflow-y: auto; padding: 4px 8px 8px; }
.sc-picker-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #949ba4); margin: 6px 2px 4px; }
.sc-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, 36px); gap: 2px; }
.sc-picker-grid button { width: 36px; height: 36px; border: none; border-radius: 6px; padding: 0; cursor: pointer; background: none; font-size: 22px; }
.sc-picker-grid button:hover { background: var(--background-modifier-hover, #393c41); }
.sc-picker-grid button img { width: 28px; height: 28px; }
.sc-picker-empty { color: var(--text-muted, #949ba4); padding: 12px 4px; font-size: 13px; }

.sc-suggest {
    position: fixed; z-index: 1000; max-height: 300px; overflow-y: auto; padding: 6px; border-radius: 8px;
    background: var(--background-base-low, var(--background-secondary, #2b2d31)); box-shadow: 0 8px 24px rgba(0,0,0,.45);
    border: 1px solid color-mix(in srgb, var(--interactive-normal, #b5bac1) 12%, transparent);
}
.sc-suggest-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #949ba4); padding: 2px 6px 6px; }
.sc-suggest-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; cursor: pointer; font-size: 14px; color: var(--text-normal, #dbdee1); }
.sc-suggest-item.sc-active { background: var(--background-modifier-selected, #404249); }
.sc-suggest-item img { width: 24px; height: 24px; border-radius: 50%; flex: none; }
.sc-suggest-item .sc-role-dot { width: 12px; height: 12px; border-radius: 50%; flex: none; margin: 0 6px; }
.sc-suggest-item .sc-channel-icon { width: 24px; text-align: center; flex: none; font-size: 16px; color: var(--text-muted, #949ba4); }
.sc-suggest-item small { margin-left: auto; color: var(--text-muted, #949ba4); font-size: 12px; }

.sc-viewer {
    position: fixed; inset: 0; z-index: 1001; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    background: rgba(0,0,0,.85);
}
.sc-viewer img, .sc-viewer video { max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: 4px; }
.sc-viewer-bar { display: flex; align-items: center; gap: 14px; font-size: 14px; color: #dbdee1; }
.sc-viewer-bar a { color: #dbdee1; opacity: .8; text-decoration: none; }
.sc-viewer-bar a:hover { opacity: 1; text-decoration: underline; }
.sc-viewer-nav {
    position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border: none; border-radius: 50%; cursor: pointer;
    font-size: 22px; color: #fff; background: rgba(0,0,0,.5);
}
.sc-viewer-nav:hover { background: rgba(0,0,0,.8); }
.sc-viewer-prev { left: 24px; }
.sc-viewer-next { right: 24px; }

.sc-settings { color: var(--text-normal); display: flex; flex-direction: column; gap: 12px; }
.sc-settings label { display: flex; align-items: center; gap: 8px; }
.sc-hint { color: var(--text-muted, #949ba4); font-size: 13px; }
`;

module.exports = class SideChats {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        const { Webpack } = BdApi;
        this.settings = { ...DEFAULT_SETTINGS, ...BdApi.Data.load(this.meta.name, "settings") };
        this.stores = Object.fromEntries(STORES.map(name => [name, Webpack.getStore(name)]));
        this.dispatcher = this.stores.UserStore?._dispatcher;
        // Module de Discord qui fait les requêtes à son API (avec ton compte déjà connecté)
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

        if (!this.dispatcher || !this.http || !this.stores.ChannelStore) {
            BdApi.UI.showToast("SideChats: Discord modules not found", { type: "error" });
            return;
        }
        BdApi.DOM.addStyle(this.meta.name, CSS);

        // Une seule zone à droite pour toutes les fenêtres : un listener délégué gère tous les clics
        this.dock = el("div", "sc-dock");
        this.dockResize = el("div", "sc-dock-resize");
        this.dockResize.dataset.resize = "dock";
        this.dock.append(this.dockResize);
        this.dock.addEventListener("click", e => this.onClick(e));
        this.dock.addEventListener("input", e => this.onInput(e));
        this.dock.addEventListener("keydown", e => this.onKeyDown(e));
        this.dock.addEventListener("pointerdown", e => this.onResizeStart(e));
        this.dock.addEventListener("focusout", e => {
            if (this.suggest?.input === e.target) this.closeSuggestions();
        });
        // scroll et load ne remontent pas : on les écoute à la descente
        this.dock.addEventListener("scroll", e => this.onScroll(e), true);
        this.dock.addEventListener("load", e => this.onMediaLoad(e), true);

        // Coller une image ou déposer un fichier : il est joint au message de la fenêtre
        this.dock.addEventListener("paste", e => this.onPaste(e));
        for (const type of ["dragenter", "dragover", "drop"]) this.dock.addEventListener(type, e => this.onDrag(e));

        this.panes = [];
        for (const saved of BdApi.Data.load(this.meta.name, "panes") ?? []) {
            if (saved?.channelId) this.addPane(saved.channelId, saved);
        }
        this.layout();

        this.handlers = {
            MESSAGE_CREATE: action => this.onMessageCreate(action),
            MESSAGE_UPDATE: action => this.updateMessage(action.message),
            MESSAGE_DELETE: action => this.deleteMessage(action.channelId, action.id),
            MESSAGE_REACTION_ADD: action => this.applyReaction(action, 1),
            MESSAGE_REACTION_REMOVE: action => this.applyReaction(action, -1),
            TYPING_START: action => this.onTyping(action),
            GUILD_MEMBERS_CHUNK: action => {
                for (const pane of this.panes) if (pane.guildId === action.guildId) this.renderList(pane);
                if (this.suggest) this.updateSuggestions(this.suggest.input, false);
            },
            CHANNEL_CREATE: () => this.panes.forEach(pane => this.renderHead(pane))
        };
        for (const [type, handler] of Object.entries(this.handlers)) this.dispatcher.subscribe(type, handler);

        // Revenir sur Discord : les fenêtres affichées sont considérées comme lues
        this.onFocus = () => this.panes.forEach(pane => this.markSeen(pane));
        window.addEventListener("focus", this.onFocus);
        // Fenêtre de Discord redimensionnée : on garde de la place pour le salon principal
        this.onWindowResize = () => this.applyWidth();
        window.addEventListener("resize", this.onWindowResize);

        this.patchMenus();

        // Le bouton est ajouté dans la barre du salon, que Discord recrée en changeant de salon
        this.observer = new MutationObserver(() => this.schedule());
        this.observer.observe(document.getElementById("app-mount") ?? document.body, { childList: true, subtree: true });
        this.schedule();
    }

    stop() {
        this.observer?.disconnect();
        if (this.frame) cancelAnimationFrame(this.frame);
        this.frame = 0;
        for (const [type, handler] of Object.entries(this.handlers ?? {})) this.dispatcher?.unsubscribe(type, handler);
        this.handlers = null;
        window.removeEventListener("focus", this.onFocus);
        window.removeEventListener("resize", this.onWindowResize);
        for (const unpatch of this.unpatchMenus ?? []) unpatch();
        this.unpatchMenus = [];
        for (const pane of this.panes ?? []) {
            this.clearTyping(pane);
            this.clearFiles(pane);
        }
        this.closeChooser();
        this.closePicker();
        this.closeGifs();
        this.closeViewer();
        this.closeSuggestions();
        clearTimeout(this.memberTimer);
        this.memberTimer = null;
        this.dock?.remove();
        this.button?.remove();
        this.button = null;
        this.releasePage();
        for (const attribute of ["data-sc-page", "data-sc-static", "data-sc-host"]) {
            document.querySelectorAll(`[${attribute}]`).forEach(node => node.removeAttribute(attribute));
        }
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

    // La zone du salon ouvert (chat et liste des membres) est la voisine de la barre latérale des salons ou des MP
    getPage() {
        const list = document.getElementById("channels") ?? document.querySelector('nav[class*="privateChannels_"]');
        const page = list?.closest('[class*="sidebar_"]')?.nextElementSibling
            ?? document.querySelector('[class*="chatContent_"]')?.closest('[class*="page_"]');
        return page && page !== this.dock ? page : null;
    }

    ensure() {
        const page = this.getPage();
        this.ensureButton(page);

        if (!this.panes.length || !page) {
            this.dock.remove();
            this.releasePage();
            return;
        }
        // Les fenêtres se placent dans la zone du salon ouvert, sur son bord droit.
        // On ne touche pas à la disposition générale de Discord (serveurs, salons...)
        if (this.page !== page) {
            this.releasePage();
            this.page = page;
            page.setAttribute("data-sc-page", "");
            if (getComputedStyle(page).position === "static") page.setAttribute("data-sc-static", "");
        }
        if (this.dock.parentElement !== page) {
            page.append(this.dock);
            this.applyWidth();
            // Une fois déplacées, les zones de messages repartent en haut : on les remet en bas
            for (const pane of this.panes) {
                if (pane.stick) scrollToBottom(pane);
                this.markSeen(pane);
            }
        }
    }

    releasePage() {
        if (!this.page) return;
        this.page.removeAttribute("data-sc-page");
        this.page.removeAttribute("data-sc-static");
        this.page.style.removeProperty("--sc-dock-width");
        this.page = null;
    }

    // Largeur totale des fenêtres, en laissant toujours de la place au salon principal
    applyWidth() {
        const stacked = this.settings.layout === "stacked";
        let width = stacked ? this.settings.stackWidth
            : this.panes.reduce((sum, pane) => sum + (pane.collapsed ? COLLAPSED_WIDTH : pane.width), 0);
        if (this.page) width = Math.min(width, Math.max(0, this.page.getBoundingClientRect().width - MIN_MAIN_WIDTH));
        this.dock.style.width = `${width}px`;
        this.page?.style.setProperty("--sc-dock-width", `${width}px`);
    }

    // Le bouton va en haut à droite du salon, avec les icônes de Discord (et le bouton Feed de ServerFeed)
    ensureButton(page) {
        const toolbar = page?.querySelector('section [class*="toolbar_"]') ?? page?.querySelector('[class*="toolbar_"]');
        const button = this.button ??= this.createButton();
        if (toolbar) {
            if (button.parentElement !== toolbar) toolbar.prepend(button);
            button.classList.remove("sc-floating");
        }
        else if (page) {
            if (button.parentElement !== page) page.append(button);
            page.setAttribute("data-sc-host", "");
            button.classList.add("sc-floating");
        }
        else button.remove();
    }

    createButton() {
        const button = el("button", "sc-toggle", "⧉ Chats");
        button.title = "Open another chat on the side";
        button.addEventListener("click", () => this.openChooser(button));
        return button;
    }

    // --- Menus clic droit ---

    patchMenus() {
        this.unpatchMenus = [];
        const add = (tree, channel) => {
            if (!channel || !CHAT_TYPES.has(channel.type)) return;
            const groups = findMenuGroups(tree);
            if (!groups || groups.some(child => child?.props?.id === "side-chats-open")) return;
            groups.push(BdApi.ContextMenu.buildItem({ type: "separator" }), BdApi.ContextMenu.buildItem({
                id: "side-chats-open",
                label: this.getPane(channel.id) ? "Show in Side Chat" : "Open in Side Chat",
                action: () => this.openChat(channel.id)
            }));
        };
        for (const menu of ["channel-context", "thread-context", "gdm-context"]) {
            this.unpatchMenus.push(BdApi.ContextMenu.patch(menu, (tree, props) => {
                try { add(tree, props?.channel); } catch (error) { console.error(`[${this.meta.name}]`, error); }
            }));
        }
        // Clic droit sur une personne : sa conversation privée (créée au besoin)
        this.unpatchMenus.push(BdApi.ContextMenu.patch("user-context", (tree, props) => {
            try {
                const user = props?.user;
                const me = this.stores.UserStore?.getCurrentUser?.()?.id;
                if (!user?.id || user.id === me || user.bot) return;
                const groups = findMenuGroups(tree);
                if (!groups || groups.some(child => child?.props?.id === "side-chats-open")) return;
                groups.push(BdApi.ContextMenu.buildItem({ type: "separator" }), BdApi.ContextMenu.buildItem({
                    id: "side-chats-open",
                    label: "Message in Side Chat",
                    action: () => this.openDirectMessage(user.id)
                }));
            } catch (error) {
                console.error(`[${this.meta.name}]`, error);
            }
        }));
    }

    async openDirectMessage(userId) {
        const existing = this.stores.ChannelStore?.getDMFromUserId?.(userId);
        if (existing) return this.openChat(existing);
        try {
            const response = await this.http.post({ url: "/users/@me/channels", body: { recipient_id: userId } });
            const channel = response?.body ?? JSON.parse(response?.text ?? "null");
            if (channel?.id) this.openChat(channel.id);
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't open the DM`, error);
            BdApi.UI.showToast("SideChats: couldn't open this conversation", { type: "error" });
        }
    }

    // --- Fenêtres ---

    getPane(channelId) {
        return this.panes.find(pane => pane.channelId === channelId);
    }

    // Ouvre la conversation sur le côté, ou montre sa fenêtre si elle est déjà ouverte
    openChat(channelId) {
        const existing = this.getPane(channelId);
        if (existing) {
            if (existing.collapsed) this.setCollapsed(existing, false);
            existing.el.root.classList.remove("sc-flash");
            void existing.el.root.offsetWidth;
            existing.el.root.classList.add("sc-flash");
            existing.el.root.scrollIntoView({ block: "nearest", inline: "nearest" });
            existing.el.input.focus();
            return;
        }
        const pane = this.addPane(channelId, {});
        this.layout();
        this.save();
        this.schedule();
        requestAnimationFrame(() => pane.el.input.focus());
    }

    addPane(channelId, saved) {
        const pane = {
            channelId,
            guildId: this.stores.ChannelStore?.getChannel?.(channelId)?.guild_id ?? null,
            width: Math.max(MIN_WIDTH, Number(saved.width) || DEFAULT_WIDTH),
            collapsed: Boolean(saved.collapsed),
            messages: [], loaded: false, loading: false, hasMore: true, error: null,
            stick: true, unseen: 0, draft: "", replyTo: null, mentions: [], typing: new Map(), lastTyping: 0, lastHtml: "", files: []
        };
        pane.el = this.createPaneElement(pane);
        this.panes.push(pane);
        this.renderHead(pane);
        this.renderList(pane);
        this.loadPane(pane);
        return pane;
    }

    createPaneElement(pane) {
        const root = el("div", "sc-pane");
        root.dataset.channel = pane.channelId;
        const resize = el("div", "sc-resize");
        resize.dataset.resize = pane.channelId;
        const inner = el("div", "sc-inner");
        const head = el("div", "sc-head");
        const scroll = el("div", "sc-scroll");
        scroll.dataset.channel = pane.channelId;
        const list = el("div", "sc-list");
        scroll.append(list);
        const newbar = el("button", "sc-newbar");
        newbar.dataset.action = "bottom";
        newbar.dataset.channel = pane.channelId;
        newbar.hidden = true;
        const typing = el("div", "sc-typing");
        const composer = el("div", "sc-composer");
        const files = el("div", "sc-files");
        const replybar = el("div", "sc-replybar");
        const row = el("div", "sc-input-row");
        const input = el("textarea", "sc-input");
        input.rows = 1;
        input.dataset.channel = pane.channelId;
        const button = (text, action, title, className = "sc-btn") => {
            const node = el("button", className, text);
            node.title = title;
            Object.assign(node.dataset, { action, channel: pane.channelId });
            return node;
        };
        row.append(
            button("+", "attach", "Upload files"),
            input,
            button("GIF", "gif", "GIFs", "sc-btn sc-gif-btn"),
            button("☺", "emoji", "Emoji"),
            button("➤", "send", "Send (Enter)", "sc-btn sc-primary")
        );
        composer.append(files, replybar, row);
        inner.append(head, scroll, newbar, typing, composer);
        const strip = el("div", "sc-strip");
        Object.assign(strip.dataset, { action: "expand", channel: pane.channelId });
        root.append(resize, inner, strip);
        return { root, head, scroll, list, newbar, typing, files, replybar, input, strip };
    }

    closePane(channelId) {
        const pane = this.getPane(channelId);
        if (!pane) return;
        this.clearTyping(pane);
        this.clearFiles(pane);
        if (this.suggest?.pane === pane) this.closeSuggestions();
        if (this.editing?.channelId === channelId) this.editing = null;
        pane.el.root.remove();
        this.panes.splice(this.panes.indexOf(pane), 1);
        this.layout();
        this.save();
        this.schedule();
    }

    closeAll() {
        for (const pane of [...this.panes]) this.closePane(pane.channelId);
    }

    setCollapsed(pane, collapsed) {
        pane.collapsed = collapsed;
        this.layout();
        this.save();
        if (!collapsed) {
            pane.stick = true;
            scrollToBottom(pane);
            this.markSeen(pane);
        }
    }

    // Dispose les fenêtres côte à côte (chacune sa largeur) ou empilées (une largeur pour toutes)
    layout() {
        const stacked = this.settings.layout === "stacked";
        this.dock.classList.toggle("sc-stacked", stacked);
        this.applyWidth();
        for (const pane of this.panes) {
            const { root } = pane.el;
            root.classList.toggle("sc-collapsed", pane.collapsed);
            root.style.width = stacked ? "" : `${pane.collapsed ? COLLAPSED_WIDTH : pane.width}px`;
            if (root.parentElement !== this.dock) this.dock.append(root);
        }
        if (this.button) this.button.textContent = this.panes.length ? `⧉ Chats · ${this.panes.length}` : "⧉ Chats";
    }

    save() {
        BdApi.Data.save(this.meta.name, "panes", this.panes.map(pane => ({ channelId: pane.channelId, width: pane.width, collapsed: pane.collapsed })));
    }

    saveSettings() {
        BdApi.Data.save(this.meta.name, "settings", this.settings);
    }

    // --- Redimensionnement ---

    onResizeStart(e) {
        const handle = e.target.closest("[data-resize]");
        if (!handle || e.button !== 0) return;
        e.preventDefault();
        const target = handle.dataset.resize;
        const pane = target === "dock" ? null : this.getPane(target);
        if (target !== "dock" && !pane) return;
        const startX = e.clientX;
        const startWidth = pane ? pane.width : this.settings.stackWidth;
        handle.classList.add("sc-dragging");
        handle.setPointerCapture(e.pointerId);

        // Les fenêtres sont à droite : tirer vers la gauche les agrandit
        const onMove = event => {
            const width = Math.round(Math.min(Math.max(MIN_WIDTH, startWidth + startX - event.clientX), window.innerWidth * .75));
            if (pane) {
                pane.width = width;
                if (pane.collapsed) pane.collapsed = false;
            } else this.settings.stackWidth = width;
            this.layout();
        };
        const onUp = () => {
            handle.classList.remove("sc-dragging");
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
            handle.removeEventListener("pointercancel", onUp);
            if (pane) this.save();
            else this.saveSettings();
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
        handle.addEventListener("pointercancel", onUp);
    }

    // --- Choix d'une conversation ---

    openChooser(button) {
        if (this.chooser) return this.closeChooser();
        const chooser = el("div", "sc-chooser");
        const search = el("input", "sc-chooser-search");
        search.placeholder = "Search a channel, a DM or a group";
        const list = el("div", "sc-chooser-list");
        const foot = el("div", "sc-chooser-foot");
        chooser.append(search, list, foot);

        const state = { items: [], index: 0 };
        const draw = () => {
            const sections = this.getChoices(search.value);
            state.items = sections.flatMap(section => section.items);
            state.index = Math.min(state.index, Math.max(0, state.items.length - 1));
            let index = 0;
            list.innerHTML = sections.length ? sections.map(section => `
                <div class="sc-chooser-title">${escapeHtml(section.title)}</div>
                ${section.items.map(item => `
                    <div class="sc-choice${index === state.index ? " sc-active" : ""}" data-index="${index++}">
                        ${iconHtml(item.icon, item.label)}<span>${escapeHtml(item.label)}</span>
                        <small${item.open ? ` class="sc-open-tag"` : ""}>${escapeHtml(item.open ? "open" : item.sub)}</small>
                    </div>`).join("")}`).join("")
                : `<div class="sc-chooser-empty">${search.value.trim() ? "Nothing found" : "Type to search every server, DM and group"}</div>`;
            list.querySelector(".sc-active")?.scrollIntoView({ block: "nearest" });
        };
        const choose = index => {
            const item = state.items[index];
            if (!item) return;
            this.closeChooser();
            this.openChat(item.channelId);
        };
        search.addEventListener("input", () => {
            state.index = 0;
            draw();
        });
        search.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const count = state.items.length;
                if (count) state.index = (state.index + (e.key === "ArrowDown" ? 1 : -1) + count) % count;
                draw();
            } else if (e.key === "Enter") {
                e.preventDefault();
                choose(state.index);
            } else if (e.key === "Escape") {
                e.preventDefault();
                this.closeChooser();
            }
        });
        list.addEventListener("click", e => {
            const item = e.target.closest("[data-index]");
            if (item) choose(Number(item.dataset.index));
        });

        // Bas de la liste : disposition des fenêtres et fermeture de toutes
        const drawFoot = () => {
            foot.replaceChildren();
            foot.append(el("span", "", "Layout"));
            for (const [value, text] of [["columns", "Side by side"], ["stacked", "Stacked"]]) {
                const option = el("button", `sc-btn${this.settings.layout === value ? " sc-on" : ""}`, text);
                option.addEventListener("click", () => {
                    this.settings.layout = value;
                    this.saveSettings();
                    this.layout();
                    drawFoot();
                });
                foot.append(option);
            }
            foot.append(el("span", "sc-spacer"));
            if (this.panes.length) {
                const closeAll = el("button", "sc-btn", "Close all");
                closeAll.addEventListener("click", () => {
                    this.closeAll();
                    draw();
                    drawFoot();
                });
                foot.append(closeAll);
            }
        };
        draw();
        drawFoot();

        document.body.append(chooser);
        const rect = button.getBoundingClientRect();
        chooser.style.left = `${Math.min(Math.max(8, rect.right - 360), window.innerWidth - 368)}px`;
        chooser.style.top = `${rect.bottom + 6}px`;
        search.focus();

        const onOutside = e => {
            if (!chooser.contains(e.target) && !button.contains(e.target)) this.closeChooser();
        };
        setTimeout(() => document.addEventListener("mousedown", onOutside, true));
        this.chooser = { element: chooser, onOutside };
    }

    closeChooser() {
        if (!this.chooser) return;
        document.removeEventListener("mousedown", this.chooser.onOutside, true);
        this.chooser.element.remove();
        this.chooser = null;
    }

    // Sans recherche : le salon ouvert, les MP récents et les salons du serveur actuel.
    // Avec une recherche : tout (MP, groupes et salons de tous les serveurs)
    getChoices(text) {
        const query = text.trim().toLowerCase().replace(/^#/, "");
        const { ChannelStore, SelectedChannelStore, SelectedGuildStore, GuildStore } = this.stores;
        const matches = item => !query || item.label.toLowerCase().includes(query) || item.search?.toLowerCase().includes(query);
        const sections = [];

        if (!query) {
            const current = ChannelStore?.getChannel?.(SelectedChannelStore?.getChannelId?.());
            if (current && CHAT_TYPES.has(current.type)) sections.push({ title: "Current channel", items: [this.describeChoice(current)] });
        }
        const privates = this.getPrivateChannels().map(channel => this.describeChoice(channel)).filter(matches).slice(0, query ? 20 : 10);
        if (privates.length) sections.push({ title: "Direct messages & groups", items: privates });

        const currentGuild = SelectedGuildStore?.getGuildId?.();
        const guildIds = query ? this.getGuildIds() : currentGuild ? [currentGuild] : [];
        let total = 0;
        for (const guildId of guildIds) {
            const guild = GuildStore?.getGuild?.(guildId);
            const items = this.getGuildChannels(guildId).map(channel => this.describeChoice(channel)).filter(matches).slice(0, query ? 12 : 40);
            if (!items.length) continue;
            sections.push({ title: guild?.name ?? "Server", items });
            total += items.length;
            if (total >= 80) break;
        }
        return sections;
    }

    getPrivateChannels() {
        const { ChannelStore, PrivateChannelSortStore } = this.stores;
        const ids = PrivateChannelSortStore?.getPrivateChannelIds?.()
            ?? ChannelStore?.getSortedPrivateChannels?.()?.map(channel => channel.id)
            ?? Object.keys(ChannelStore?.getMutablePrivateChannels?.() ?? {});
        return ids.map(id => ChannelStore.getChannel(id)).filter(channel => channel && (channel.type === 1 || channel.type === 3));
    }

    getGuildIds() {
        return this.stores.SortedGuildStore?.getFlattenedGuildIds?.() ?? Object.keys(this.stores.GuildStore?.getGuilds?.() ?? {});
    }

    getGuildChannels(guildId) {
        const { GuildChannelStore, PermissionStore } = this.stores;
        const lists = GuildChannelStore?.getChannels?.(guildId) ?? {};
        return [...(lists.SELECTABLE ?? []), ...(lists.VOCAL ?? [])]
            .map(entry => entry.channel)
            .filter(channel => channel && GUILD_TYPES.has(channel.type) && PermissionStore?.can?.(VIEW_CHANNEL, channel) !== false);
    }

    describeChoice(channel) {
        const info = this.describe(channel.id);
        const parent = channel.parent_id ? this.stores.ChannelStore?.getChannel?.(channel.parent_id)?.name : "";
        return {
            channelId: channel.id, label: info.name, icon: info.icon, open: Boolean(this.getPane(channel.id)),
            sub: channel.guild_id ? parent ?? "" : info.sub, search: channel.guild_id ? `${info.sub} ${parent ?? ""}` : info.sub
        };
    }

    // Nom, sous-titre et image d'une conversation : #salon et son serveur, une personne, ou un groupe
    describe(channelId) {
        const { ChannelStore, GuildStore, UserStore } = this.stores;
        const channel = ChannelStore?.getChannel?.(channelId);
        if (!channel) return { name: "Conversation", sub: "", icon: null };
        if (channel.guild_id) {
            const guild = GuildStore?.getGuild?.(channel.guild_id);
            const voice = channel.type === 2 || channel.type === 13;
            const thread = channel.type >= 10 && channel.type <= 12;
            return {
                name: `${voice ? "🔊 " : thread ? "🧵 " : "#"}${channel.name ?? "channel"}`,
                sub: guild?.name ?? "",
                icon: guild?.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=64` : null,
                letters: guild?.name
            };
        }
        const users = (channel.recipients ?? []).map(id => UserStore?.getUser?.(id) ?? normalizeUser(channel.rawRecipients?.find(user => user.id === id))).filter(Boolean);
        if (channel.type === 1) {
            const user = users[0];
            return { name: user ? userName(user) : "Direct message", sub: user ? `@${user.username}` : "Direct message", icon: user ? getAvatar(user, null, null) : null };
        }
        const names = users.map(userName).join(", ");
        return {
            name: channel.name || names || "Group",
            sub: `Group · ${users.length + 1} members${channel.name && names ? ` · ${names}` : ""}`,
            icon: channel.icon ? `https://cdn.discordapp.com/channel-icons/${channel.id}/${channel.icon}.webp?size=64` : null
        };
    }

    // --- Messages ---

    async loadPane(pane) {
        if (pane.loading) return;
        pane.loading = true;
        pane.error = null;
        try {
            const messages = await this.fetchMessages(pane.channelId, {}, PAGE_SIZE);
            if (!this.panes.includes(pane)) return;
            // Des messages ont pu arriver en direct pendant le chargement
            pane.messages = dedupe([...messages, ...pane.messages]);
            pane.hasMore = messages.length === PAGE_SIZE;
            pane.loaded = true;
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't load the messages`, error);
            pane.error = error?.status === 403 || error?.status === 404 ? "You can't see this conversation anymore."
                : `Couldn't load the messages (${error?.status ? `HTTP ${error.status}` : error?.message ?? error})`;
        } finally {
            pane.loading = false;
        }
        pane.guildId = this.stores.ChannelStore?.getChannel?.(pane.channelId)?.guild_id ?? pane.guildId;
        pane.stick = true;
        this.renderHead(pane);
        this.renderList(pane);
        scrollToBottom(pane);
        this.markSeen(pane);
    }

    async loadOlder(pane) {
        const first = pane.messages[0];
        if (!first || pane.loading || !pane.hasMore) return;
        pane.loading = true;
        try {
            const older = await this.fetchMessages(pane.channelId, { before: first.id }, PAGE_SIZE);
            pane.hasMore = older.length === PAGE_SIZE;
            pane.messages = dedupe([...older, ...pane.messages]);
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't load older messages`, error);
            pane.hasMore = false;
        } finally {
            pane.loading = false;
        }
        // Les anciens messages s'ajoutent au-dessus sans faire bouger ce qu'on lit
        this.renderList(pane, true);
    }

    // Les messages arrivent du plus récent au plus ancien : on les remet dans l'ordre
    async fetchMessages(channelId, query, limit) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const response = await this.http.get({ url: `/channels/${channelId}/messages`, query: { ...query, limit } });
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

    onMessageCreate({ channelId, message, optimistic }) {
        if (optimistic || !message) return;
        const pane = this.getPane(channelId ?? message.channel_id);
        if (!pane?.loaded || pane.messages.some(existing => existing.id === message.id)) return;
        pane.messages.push(message);
        if (pane.typing.has(message.author?.id)) {
            clearTimeout(pane.typing.get(message.author.id));
            pane.typing.delete(message.author.id);
            this.renderTyping(pane);
        }
        const own = message.author?.id === this.stores.UserStore?.getCurrentUser?.()?.id;
        if (own) pane.stick = true;
        else if (!this.isWatching(pane)) pane.unseen++;
        this.renderList(pane);
        this.renderHead(pane);
        this.markSeen(pane);
    }

    updateMessage(message) {
        const pane = message && this.getPane(message.channel_id);
        const existing = pane?.messages.find(item => item.id === message.id);
        if (!existing) return;
        Object.assign(existing, message);
        this.renderList(pane);
    }

    deleteMessage(channelId, id) {
        const pane = this.getPane(channelId);
        const existing = pane?.messages.find(item => item.id === id);
        if (!existing) return;
        existing.scDeleted = true;
        this.renderList(pane);
    }

    findMessage(channelId, messageId) {
        return this.getPane(channelId)?.messages.find(message => message.id === messageId);
    }

    // La fenêtre est visible, en bas de la conversation, et Discord est au premier plan
    isWatching(pane) {
        return Boolean(pane.stick && !pane.collapsed && this.dock.isConnected && document.hasFocus());
    }

    // Ce qu'on voit est lu : le compteur de la fenêtre repart à zéro et Discord le marque comme lu
    markSeen(pane) {
        if (!pane.loaded || !this.isWatching(pane)) return;
        if (pane.unseen) {
            pane.unseen = 0;
            this.renderHead(pane);
        }
        const last = pane.messages[pane.messages.length - 1];
        if (!this.settings.markRead || !last || pane.ackedId === last.id) return;
        pane.ackedId = last.id;
        try {
            if (this.ackActions?.ack) this.ackActions.ack(pane.channelId);
            else this.http.post({ url: `/channels/${pane.channelId}/messages/${last.id}/ack`, body: { token: null } }).catch(() => {});
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't mark the conversation as read`, error);
        }
    }

    onScroll(e) {
        const scroll = e.target;
        if (!scroll.classList?.contains("sc-scroll")) return;
        const pane = this.getPane(scroll.dataset.channel);
        if (!pane || pane.restoring) return;
        pane.stick = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40;
        if (pane.stick) {
            pane.el.newbar.hidden = true;
            this.markSeen(pane);
        }
        if (scroll.scrollTop < 120 && pane.hasMore && pane.loaded) this.loadOlder(pane);
    }

    // Une image qui finit de charger agrandit la conversation : on reste en bas si on y était
    onMediaLoad(e) {
        const scroll = e.target.closest?.(".sc-scroll");
        const pane = scroll && this.getPane(scroll.dataset.channel);
        if (pane?.stick) scrollToBottom(pane);
    }

    // --- Quelqu'un écrit ---

    onTyping({ channelId, userId }) {
        const pane = this.getPane(channelId);
        if (!pane || userId === this.stores.UserStore?.getCurrentUser?.()?.id) return;
        clearTimeout(pane.typing.get(userId));
        pane.typing.set(userId, setTimeout(() => {
            pane.typing.delete(userId);
            this.renderTyping(pane);
        }, TYPING_DELAY));
        this.renderTyping(pane);
    }

    clearTyping(pane) {
        for (const timer of pane.typing.values()) clearTimeout(timer);
        pane.typing.clear();
    }

    // Comme Discord : les autres voient qu'on écrit. Pas si InvisibleTyping est activé
    sendTyping(pane) {
        if (!this.settings.sendTyping || Date.now() - pane.lastTyping < TYPING_DELAY - 1000) return;
        try {
            if (BdApi.Plugins.isEnabled("InvisibleTyping")) return;
        } catch {}
        pane.lastTyping = Date.now();
        this.http.post({ url: `/channels/${pane.channelId}/typing` }).catch(() => {});
    }

    // --- Actions ---

    onClick(e) {
        // Un lien dans un message s'ouvre normalement
        if (e.target.closest("a")) return;
        const action = e.target.closest("[data-action]");
        if (!action) return;
        e.stopPropagation();
        const { action: name, channel, message, user } = action.dataset;
        const pane = this.getPane(action.closest(".sc-pane")?.dataset.channel ?? channel);

        if (name === "spoiler") action.classList.add("sc-revealed");
        else if (name === "image") this.openViewer(channel, message, Number(action.dataset.index));
        else if (name === "close") this.closePane(channel);
        else if (name === "collapse") pane && this.setCollapsed(pane, true);
        else if (name === "expand") pane && this.setCollapsed(pane, false);
        else if (name === "open-main") this.openInMain(channel);
        else if (name === "bottom" && pane) {
            pane.stick = true;
            scrollToBottom(pane);
            pane.el.newbar.hidden = true;
            this.markSeen(pane);
        }
        else if (name === "profile") this.openProfile(user, pane?.guildId);
        else if (name === "jump") this.openInMain(channel, message, action.dataset.guild);
        else if (name === "reply") this.startReply(channel, message);
        else if (name === "cancel-reply") this.cancelReply(channel);
        else if (name === "edit") this.startEdit(channel, message);
        else if (name === "cancel-edit") this.cancelEdit();
        else if (name === "save-edit") this.saveEdit();
        else if (name === "send") this.send(channel);
        else if (name === "attach" && pane) this.chooseFiles(pane);
        else if (name === "remove-file" && pane) this.removeFile(pane, Number(action.dataset.index));
        else if (name === "gif" && pane) this.openGifs(action, pane);
        else if (name === "emoji" && pane) {
            const input = pane.el.input;
            // On retient la position du curseur avant que le sélecteur prenne le focus
            const range = [input.selectionStart, input.selectionEnd];
            this.openPicker(action, `input:${channel}`, pane.guildId, emoji => this.insertEmoji(pane, emoji, range));
        }
        else if (name === "react") this.toggleReaction(channel, message, JSON.parse(action.dataset.emoji));
        else if (name === "add-reaction") this.openPicker(action, `react:${message}`, pane?.guildId, emoji => this.toggleReaction(channel, message, emoji));
    }

    openInMain(channelId, messageId, guildId) {
        const channel = this.stores.ChannelStore?.getChannel?.(channelId);
        const guild = guildId ?? channel?.guild_id ?? "@me";
        this.transitionTo?.(`/channels/${guild}/${channelId}${messageId ? `/${messageId}` : ""}`);
    }

    openProfile(userId, guildId) {
        if (!userId) return;
        try {
            this.profileActions?.openUserProfileModal({ userId, guildId: guildId ?? undefined, analyticsLocation: { section: "Side Chats" } });
        } catch {
            BdApi.UI.showToast("SideChats: couldn't open this profile", { type: "error" });
        }
    }

    onInput(e) {
        const edit = e.target.closest(".sc-edit-input");
        if (edit && this.editing) {
            this.editing.draft = edit.value;
            autoSize(edit);
            return;
        }
        const input = e.target.closest(".sc-input");
        const pane = input && this.getPane(input.dataset.channel);
        if (!pane) return;
        pane.draft = input.value;
        autoSize(input);
        if (input.value) this.sendTyping(pane);
        this.updateSuggestions(input, true);
    }

    onKeyDown(e) {
        // Modification d'un message : Entrée enregistre, Échap annule
        if (e.target.closest(".sc-edit-input")) {
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
        const input = e.target.closest(".sc-input");
        const pane = input && this.getPane(input.dataset.channel);
        if (!pane) return;
        // Les raccourcis de Discord ne doivent pas intercepter ce qu'on tape ici (ceux avec Ctrl ou Alt passent)
        if (!e.ctrlKey && !e.metaKey && !e.altKey) e.stopPropagation();
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
            this.send(pane.channelId);
        } else if (e.key === "Escape" && pane.replyTo) {
            e.preventDefault();
            this.cancelReply(pane.channelId);
        } else if (e.key === "ArrowUp" && !input.value) {
            // Comme Discord : flèche du haut dans une zone vide = modifier son dernier message
            const me = this.stores.UserStore?.getCurrentUser?.()?.id;
            const last = [...pane.messages].reverse().find(message => message.author?.id === me && !message.scDeleted && !message.webhook_id);
            if (last) {
                e.preventDefault();
                this.startEdit(pane.channelId, last.id);
            }
        }
    }

    // --- Répondre et envoyer ---

    startReply(channelId, messageId) {
        const pane = this.getPane(channelId);
        if (!pane) return;
        pane.replyTo = messageId;
        this.renderReplyBar(pane);
        this.renderList(pane);
        focusEnd(pane.el.input);
    }

    cancelReply(channelId) {
        const pane = this.getPane(channelId);
        if (!pane) return;
        pane.replyTo = null;
        this.renderReplyBar(pane);
        this.renderList(pane);
        focusEnd(pane.el.input);
    }

    // Unicode tel quel, emoji personnalisé au format de Discord (<:nom:id> ou <a:nom:id> s'il est animé)
    insertEmoji(pane, emoji, range) {
        const text = emoji.id ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>` : emoji.name;
        const input = pane.el.input;
        const [start, end] = range ?? [input.value.length, input.value.length];
        const before = input.value.slice(0, start);
        const insert = (before && !/\s$/.test(before) && emoji.id ? " " : "") + text;
        input.value = before + insert + input.value.slice(end);
        pane.draft = input.value;
        this.rememberEmoji(emoji);
        autoSize(input);
        input.focus();
        const cursor = start + insert.length;
        input.setSelectionRange(cursor, cursor);
    }

    async send(channelId) {
        const pane = this.getPane(channelId);
        const content = pane?.draft.trim();
        if (!pane || (!content && !pane.files.length) || pane.sending) return;
        const reference = pane.replyTo ? { guild_id: pane.guildId ?? undefined, channel_id: channelId, message_id: pane.replyTo } : null;

        // L'envoi de Discord attend que le salon soit ouvert : on passe directement par l'API.
        // TextExpander ne voit donc pas passer le message, on lui demande de le remplacer nous-mêmes
        const message = { content: applyMentions(pane.mentions, content) };
        try {
            if (BdApi.Plugins.isEnabled("TextExpander")) BdApi.Plugins.get("TextExpander")?.instance?.expandMessage?.(message);
        } catch {}

        pane.sending = true;
        const files = pane.files;
        try {
            if (files.length) pane.el.files.classList.add("sc-uploading");
            const attachments = files.length ? await this.uploadFiles(channelId, files.map(item => item.file)) : null;
            await this.postMessage(channelId, { content: message.content, ...(attachments ? { attachments } : {}) }, reference);
            pane.draft = "";
            pane.mentions = [];
            pane.replyTo = null;
            pane.lastTyping = 0;
            pane.el.input.value = "";
            autoSize(pane.el.input);
            if (pane.files === files) this.clearFiles(pane);
            this.closeSuggestions();
            this.renderReplyBar(pane);
            pane.stick = true;
            this.renderList(pane);
            pane.el.input.focus();
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't send the message`, error);
            BdApi.UI.showToast(`SideChats: couldn't send the message (${error?.body?.message ?? error?.message ?? error?.status ?? error})`, { type: "error" });
        } finally {
            pane.sending = false;
            pane.el.files.classList.remove("sc-uploading");
        }
    }

    postMessage(channelId, body, reference) {
        return this.http.post({
            url: `/channels/${channelId}/messages`,
            body: {
                ...body,
                nonce: String((BigInt(Date.now()) - DISCORD_EPOCH) << 22n),
                tts: false,
                ...(reference ? { message_reference: reference, allowed_mentions: { parse: ["users", "roles", "everyone"], replied_user: true } } : {})
            }
        });
    }

    // --- Fichiers ---

    // Comme Discord : il réserve une place pour chaque fichier, on l'y envoie, puis le message y fait référence
    async uploadFiles(channelId, files) {
        const response = await this.http.post({
            url: `/channels/${channelId}/attachments`,
            body: { files: files.map((file, index) => ({ id: String(index), filename: file.name, file_size: file.size, is_clip: false })) }
        });
        const slots = (response?.body ?? JSON.parse(response?.text ?? "null"))?.attachments;
        if (!Array.isArray(slots) || !slots.length) throw new Error("Discord refused the upload");
        await Promise.all(slots.map(async slot => {
            const result = await fetch(slot.upload_url, { method: "PUT", body: files[Number(slot.id)] });
            if (!result.ok) throw new Error(`upload failed (HTTP ${result.status})`);
        }));
        return slots.map(slot => ({ id: slot.id, filename: files[Number(slot.id)].name, uploaded_filename: slot.upload_filename }));
    }

    chooseFiles(pane) {
        const picker = el("input");
        picker.type = "file";
        picker.multiple = true;
        picker.addEventListener("change", () => this.addFiles(pane, [...picker.files]));
        picker.click();
    }

    addFiles(pane, files) {
        if (!files.length) return;
        for (const file of files) {
            // Nom donné aux images collées, qui n'en ont pas toujours
            const named = file.name ? file : new File([file], `image.${(file.type.split("/")[1] || "png")}`, { type: file.type });
            pane.files.push({ file: named, preview: named.type.startsWith("image/") ? URL.createObjectURL(named) : null });
        }
        this.renderFiles(pane);
        pane.el.input.focus();
    }

    removeFile(pane, index) {
        const [item] = pane.files.splice(index, 1);
        if (item?.preview) URL.revokeObjectURL(item.preview);
        this.renderFiles(pane);
    }

    clearFiles(pane) {
        for (const item of pane.files) if (item.preview) URL.revokeObjectURL(item.preview);
        pane.files = [];
        this.renderFiles(pane);
    }

    renderFiles(pane) {
        const id = escapeHtml(pane.channelId);
        pane.el.files.innerHTML = pane.files.map((item, index) => `
            <div class="sc-file-chip" title="${escapeHtml(item.file.name)}">
                ${item.preview ? `<img src="${escapeHtml(item.preview)}" alt="">` : `<span class="sc-file-icon">📄</span>`}
                <span>${escapeHtml(item.file.name)}</span>
                <button data-action="remove-file" data-channel="${id}" data-index="${index}" title="Remove">✕</button>
            </div>`).join("");
    }

    onPaste(e) {
        const input = e.target.closest?.(".sc-input");
        const pane = input && this.getPane(input.dataset.channel);
        const files = [...(e.clipboardData?.files ?? [])];
        if (!pane || !files.length) return;
        e.preventDefault();
        this.addFiles(pane, files);
    }

    // Un fichier déposé sur une fenêtre lui est joint (et pas au salon principal)
    onDrag(e) {
        if (!e.dataTransfer?.types?.includes("Files")) return;
        const pane = this.getPane(e.target.closest?.(".sc-pane")?.dataset.channel);
        if (!pane) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "drop") this.addFiles(pane, [...e.dataTransfer.files]);
        else e.dataTransfer.dropEffect = "copy";
    }

    // --- GIF ---

    // Les GIF de Discord (Tenor) : favoris, tendances et recherche. Un clic envoie le GIF, comme dans Discord
    openGifs(button, pane) {
        const reopening = this.gifs?.pane === pane;
        this.closeGifs();
        this.closePicker();
        if (reopening) return;

        const picker = el("div", "sc-picker sc-gifs");
        const search = el("input", "sc-picker-search");
        search.placeholder = "Search Tenor";
        const tabs = el("div", "sc-gif-tabs");
        const body = el("div", "sc-gif-body");
        picker.append(search, tabs, body);

        const favorites = this.getFavoriteGifs();
        let requestId = 0;
        const show = async (load, emptyText) => {
            const id = ++requestId;
            body.replaceChildren(el("div", "sc-picker-empty", "Loading…"));
            let gifs = [];
            try {
                gifs = await load();
            } catch (error) {
                console.error(`[${this.meta.name}] couldn't load GIFs`, error);
                if (id === requestId) body.replaceChildren(el("div", "sc-picker-empty", "Couldn't load the GIFs"));
                return;
            }
            if (id !== requestId) return;
            if (!gifs.length) return body.replaceChildren(el("div", "sc-picker-empty", emptyText));
            const columns = [el("div", "sc-gif-column"), el("div", "sc-gif-column")];
            gifs.forEach((gif, index) => {
                const media = el(/\.(mp4|webm)(\?|$)/i.test(gif.src) ? "video" : "img", "sc-gif");
                if (media.tagName === "VIDEO") Object.assign(media, { autoplay: true, loop: true, muted: true, playsInline: true });
                media.src = gif.src;
                media.title = "Send";
                media.addEventListener("click", () => {
                    this.closeGifs();
                    this.sendGif(pane, gif.url);
                });
                columns[index % 2].append(media);
            });
            body.replaceChildren(...columns);
            body.scrollTop = 0;
        };
        const query = (path, extra = {}) => this.http.get({
            url: path, query: { provider: "tenor", locale: navigator.language || "en-US", media_format: "mp4", ...extra }
        }).then(response => response?.body ?? JSON.parse(response?.text ?? "null"));
        const showTrending = () => show(async () => {
            const result = await query("/gifs/trending-gifs", { limit: 50 });
            return (Array.isArray(result) ? result : result?.gifs ?? []).map(gif => ({ url: gif.url, src: gif.src ?? gif.gif_src }));
        }, "No GIF found");
        const showFavorites = () => show(async () => favorites, "No favorite GIF yet");

        const tabButtons = [];
        const addTab = (text, action) => {
            const tab = el("button", "sc-btn", text);
            tab.addEventListener("click", () => {
                search.value = "";
                tabButtons.forEach(other => other.classList.toggle("sc-on", other === tab));
                action();
            });
            tabButtons.push(tab);
            tabs.append(tab);
            return tab;
        };
        const favoriteTab = favorites.length ? addTab("★ Favorites", showFavorites) : null;
        const trendingTab = addTab("Trending", showTrending);

        search.addEventListener("input", () => {
            clearTimeout(this.gifTimer);
            const text = search.value.trim();
            tabButtons.forEach(tab => tab.classList.remove("sc-on"));
            if (!text) return (favoriteTab ?? trendingTab).click();
            this.gifTimer = setTimeout(() => show(async () => {
                const result = await query("/gifs/search", { q: text, limit: 50 });
                return (Array.isArray(result) ? result : result?.gifs ?? []).map(gif => ({ url: gif.url, src: gif.src ?? gif.gif_src }));
            }, "No GIF found"), 300);
        });
        search.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "Escape") this.closeGifs();
        });
        (favoriteTab ?? trendingTab).click();

        document.body.append(picker);
        const rect = button.getBoundingClientRect();
        picker.style.left = `${Math.min(Math.max(8, rect.right - 420), window.innerWidth - 428)}px`;
        picker.style.top = `${rect.bottom + 408 > window.innerHeight ? Math.max(8, rect.top - 408) : rect.bottom + 6}px`;
        search.focus();

        const onOutside = e => {
            if (!picker.contains(e.target) && !e.target.closest?.(".sc-dock [data-action='gif']")) this.closeGifs();
        };
        setTimeout(() => document.addEventListener("mousedown", onOutside, true));
        this.gifs = { element: picker, pane, onOutside };
    }

    closeGifs() {
        clearTimeout(this.gifTimer);
        if (!this.gifs) return;
        document.removeEventListener("mousedown", this.gifs.onOutside, true);
        this.gifs.element.remove();
        this.gifs = null;
    }

    // Les GIF mis en favori dans Discord sont rangés dans tes paramètres (synchronisés entre appareils)
    getFavoriteGifs() {
        try {
            const store = BdApi.Webpack.getStore("UserSettingsProtoStore");
            const gifs = store?.frecencyWithoutFetchingLatest?.favoriteGifs?.gifs ?? store?.settings?.favoriteGifs?.gifs ?? {};
            return Object.entries(gifs)
                .sort(([, a], [, b]) => (b.order ?? 0) - (a.order ?? 0))
                .map(([url, gif]) => ({ url, src: gif.src ?? url }));
        } catch {
            return [];
        }
    }

    // Un GIF s'envoie comme dans Discord : son lien seul, que Discord affiche en animation
    async sendGif(pane, url) {
        if (!url) return;
        const reference = pane.replyTo ? { guild_id: pane.guildId ?? undefined, channel_id: pane.channelId, message_id: pane.replyTo } : null;
        try {
            await this.postMessage(pane.channelId, { content: url }, reference);
            pane.replyTo = null;
            this.renderReplyBar(pane);
            pane.stick = true;
            this.renderList(pane);
            pane.el.input.focus();
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't send the GIF`, error);
            BdApi.UI.showToast(`SideChats: couldn't send the GIF (${error?.body?.message ?? error?.message ?? error?.status ?? error})`, { type: "error" });
        }
    }

    // --- Modification de ses messages ---

    startEdit(channelId, messageId) {
        const pane = this.getPane(channelId);
        const message = this.findMessage(channelId, messageId);
        if (!pane || !message) return;
        // Les mentions s'affichent « @Pseudo » pendant la modification et redeviennent de vraies mentions à l'enregistrement
        const remember = (text, value) => {
            if (!pane.mentions.some(mention => mention.text === text)) pane.mentions.push({ text, value });
            return text;
        };
        const draft = String(message.content ?? "")
            .replace(/<@!?(\d+)>/g, (value, id) => {
                const user = this.stores.UserStore?.getUser?.(id) ?? normalizeUser(message.mentions?.find(item => item.id === id));
                return user ? remember(`@${this.getName(user, pane.guildId)}`, value) : value;
            })
            .replace(/<@&(\d+)>/g, (value, id) => {
                const role = this.getRoles(pane.guildId)[id];
                return role ? remember(`@${role.name}`, value) : value;
            });
        if (this.editing && this.editing.channelId !== channelId) this.cancelEdit();
        this.editing = { channelId, messageId, draft };
        this.renderList(pane);
        const input = pane.el.list.querySelector(".sc-edit-input");
        if (input) focusEnd(input);
    }

    cancelEdit() {
        const pane = this.getPane(this.editing?.channelId);
        this.editing = null;
        if (!pane) return;
        this.renderList(pane);
        focusEnd(pane.el.input);
    }

    async saveEdit() {
        const editing = this.editing;
        if (!editing || this.saving) return;
        const pane = this.getPane(editing.channelId);
        const message = this.findMessage(editing.channelId, editing.messageId);
        const content = applyMentions(pane?.mentions ?? [], editing.draft.trim());
        // Texte vide : Discord propose de supprimer, ici on annule simplement
        if (!message || !content || content === message.content) return this.cancelEdit();

        this.saving = true;
        try {
            await this.http.patch({ url: `/channels/${editing.channelId}/messages/${editing.messageId}`, body: { content } });
            Object.assign(message, { content, edited_timestamp: new Date().toISOString() });
            this.cancelEdit();
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't edit the message`, error);
            BdApi.UI.showToast("SideChats: couldn't edit the message", { type: "error" });
        } finally {
            this.saving = false;
        }
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
        this.renderList(this.getPane(channelId));
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
            BdApi.UI.showToast(`SideChats: couldn't react (${error?.body?.message ?? error?.message ?? error?.status ?? error})`, { type: "error" });
        }
    }

    rememberEmoji(emoji) {
        const recent = (BdApi.Data.load(this.meta.name, "recentEmojis") ?? []).filter(item => !sameEmoji(item, emoji));
        recent.unshift({ id: emoji.id ?? null, name: emoji.name, animated: Boolean(emoji.animated) });
        BdApi.Data.save(this.meta.name, "recentEmojis", recent.slice(0, RECENT_LIMIT));
    }

    // --- Sélecteur d'emoji ---

    // Emojis unicode (module interne de Discord) et emojis de tes serveurs (Nitro : utilisables partout)
    getEmojiGroups(guildId) {
        const groups = [];
        const recent = BdApi.Data.load(this.meta.name, "recentEmojis") ?? [];
        if (recent.length) groups.push({ id: "recent", icon: { text: "🕘" }, title: "Recently used", emojis: recent });

        const nitro = Boolean(this.stores.UserStore?.getCurrentUser?.()?.premiumType);
        const guilds = Object.values(this.stores.GuildStore?.getGuilds?.() ?? {})
            .sort((a, b) => (b.id === guildId) - (a.id === guildId));
        for (const guild of guilds) {
            if (!nitro && guild.id !== guildId) continue;
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

    openPicker(button, key, guildId, onPick) {
        const reopening = this.picker?.key === key;
        this.closePicker();
        if (reopening) return;

        const groups = this.getEmojiGroups(guildId);
        const picker = el("div", "sc-picker");
        const search = el("input", "sc-picker-search");
        search.placeholder = "Search emoji";
        const main = el("div", "sc-picker-main");
        const tabs = el("div", "sc-picker-tabs");
        const body = el("div", "sc-picker-body");
        main.append(tabs, body);
        picker.append(search, main);

        const pick = emoji => {
            this.closePicker();
            onPick(emoji);
        };
        const grid = emojis => {
            const node = el("div", "sc-picker-grid");
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
            body.replaceChildren(el("div", "sc-picker-title", group.title), grid(group.emojis));
            body.scrollTop = 0;
            tabs.querySelectorAll("button").forEach(tab => tab.classList.toggle("sc-active", tab.dataset.group === group.id));
        };
        for (const group of groups) {
            const tab = el("button");
            tab.dataset.group = group.id;
            tab.title = group.title;
            if (group.icon.url) tab.innerHTML = `<img src="${escapeHtml(group.icon.url)}" alt="" loading="lazy">`;
            else if (group.icon.letters) tab.append(el("span", "sc-letter", initials(group.icon.letters)));
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
                    const id = emoji.id ?? emoji.name;
                    return !seen.has(id) && seen.add(id);
                })
                .slice(0, 300);
            body.replaceChildren(found.length ? grid(found) : el("div", "sc-picker-empty", "No emoji found"));
        });
        search.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "Escape") this.closePicker();
            if (e.key === "Enter") body.querySelector(".sc-picker-grid button")?.click();
        });
        if (groups.length) showGroup(groups[0]);
        else body.append(el("div", "sc-picker-empty", "No emoji found"));

        // Placé à côté du bouton, sans sortir de l'écran
        document.body.append(picker);
        const rect = button.getBoundingClientRect();
        const left = Math.min(Math.max(8, rect.right - 420), window.innerWidth - 428);
        const top = rect.bottom + 408 > window.innerHeight ? Math.max(8, rect.top - 408) : rect.bottom + 6;
        picker.style.left = `${left}px`;
        picker.style.top = `${top}px`;
        search.focus();

        const onOutside = e => {
            if (!picker.contains(e.target) && !e.target.closest?.(".sc-dock [data-action='add-reaction'], .sc-dock [data-action='emoji']")) this.closePicker();
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

    // --- Visionneuse d'images ---

    // Comme Discord : l'image s'ouvre en grand, avec les flèches s'il y en a plusieurs dans le message
    openViewer(channelId, messageId, index) {
        const message = this.findMessage(channelId, messageId);
        const images = message ? getImages(message) : [];
        if (!images.length) return;
        this.closeViewer();

        const viewer = el("div", "sc-viewer");
        let img = el("img");
        const bar = el("div", "sc-viewer-bar");
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
            for (const [className, step, text] of [["sc-viewer-prev", -1, "‹"], ["sc-viewer-next", 1, "›"]]) {
                const button = el("button", `sc-viewer-nav ${className}`, text);
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

    // --- Mentions @ et # ---

    // Cherche un « @texte » ou « #texte » juste avant le curseur et propose les personnes, rôles, @everyone et @here,
    // ou les salons du serveur
    updateSuggestions(input, askDiscord) {
        const pane = this.getPane(input.dataset.channel);
        const before = input.value.slice(0, input.selectionStart);
        const match = before.match(/(^|\s)([@#])([^\s@#]{0,32})$/);
        if (!pane || !match) return this.closeSuggestions();
        const [, , trigger, typed] = match;
        const query = typed.toLowerCase();
        const items = trigger === "#" ? this.findChannels(pane.guildId, query) : this.findMentionables(pane, query);

        // Les membres pas encore chargés : Discord les cherche, la liste se met à jour quand ils arrivent
        if (askDiscord && query && trigger === "@" && pane.guildId) {
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => {
                try {
                    if (this.memberActions?.requestMembers) this.memberActions.requestMembers([pane.guildId], query, 10);
                    else this.dispatcher.dispatch({ type: "GUILD_MEMBERS_REQUEST", guildIds: [pane.guildId], query, limit: 10, presences: false });
                } catch {}
            }, 250);
        }

        const start = before.length - typed.length - 1;
        const sameSpot = this.suggest?.input === input && this.suggest.start === start;
        this.suggest = { input, pane, trigger, start, end: before.length, items, index: sameSpot ? Math.min(this.suggest.index, Math.max(0, items.length - 1)) : 0 };
        this.drawSuggestions();
    }

    findChannels(guildId, query) {
        if (!guildId) return [];
        const { ChannelStore } = this.stores;
        return this.getGuildChannels(guildId)
            .filter(channel => channel.name && (!query || channel.name.toLowerCase().includes(query)))
            // Ceux qui commencent par le texte tapé d'abord
            .sort((a, b) => (query && !a.name.toLowerCase().startsWith(query)) - (query && !b.name.toLowerCase().startsWith(query)))
            .slice(0, 10)
            .map(channel => ({
                type: "channel", id: channel.id, label: channel.name, voice: channel.type === 2 || channel.type === 13,
                tag: channel.parent_id ? ChannelStore?.getChannel?.(channel.parent_id)?.name : ""
            }));
    }

    findMentionables(pane, query) {
        const { GuildMemberStore, UserStore, ChannelStore } = this.stores;
        const guildId = pane.guildId;
        const matches = (...names) => !query || names.some(name => name?.toLowerCase().includes(query));
        const seen = new Set();
        const users = [];
        const addUser = (user, member) => {
            if (!user || seen.has(user.id) || users.length >= 10) return;
            const nick = guildId ? member?.nick ?? GuildMemberStore?.getNick?.(guildId, user.id) : null;
            if (!matches(nick, user.globalName ?? user.global_name, user.username)) return;
            seen.add(user.id);
            users.push({
                type: "user", id: user.id, label: nick ?? userName(user), tag: user.username,
                avatar: getAvatar(user, member ?? (guildId ? GuildMemberStore?.getMember?.(guildId, user.id) : null), guildId)
            });
        };

        // Les gens de la conversation d'abord, du plus récent au plus ancien
        for (const message of [...pane.messages].reverse()) {
            if (message.webhook_id) continue;
            addUser(UserStore?.getUser?.(message.author?.id) ?? normalizeUser(message.author));
        }
        if (!guildId) {
            for (const id of ChannelStore?.getChannel?.(pane.channelId)?.recipients ?? []) addUser(UserStore?.getUser?.(id));
            return users;
        }
        for (const member of GuildMemberStore?.getMembers?.(guildId) ?? []) {
            if (users.length >= 10) break;
            addUser(UserStore?.getUser?.(member.userId), member);
        }

        const roles = Object.values(this.getRoles(guildId))
            .filter(role => role.id !== guildId && role.mentionable && matches(role.name))
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
            this.suggestEl = el("div", "sc-suggest");
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
        this.suggestEl.innerHTML = `<div class="sc-suggest-title">${channels ? "Channels" : "Members"}</div>` + suggest.items.map((item, index) => {
            const icon = item.type === "user" ? `<img src="${escapeHtml(item.avatar)}" alt="">`
                : item.type === "channel" ? `<span class="sc-channel-icon">${item.voice ? "🔊" : "#"}</span>`
                : `<span class="sc-role-dot" style="background: ${escapeHtml(item.color ?? "#99aab5")}"></span>`;
            const extra = item.type === "user" || item.type === "channel" ? item.tag : item.type === "role" ? "role" : "";
            return `<div class="sc-suggest-item${index === suggest.index ? " sc-active" : ""}" data-index="${index}">
                ${icon}<span>${item.type === "channel" ? "" : "@"}${escapeHtml(item.label)}</span><small>${escapeHtml(extra ?? "")}</small></div>`;
        }).join("");

        // Juste au-dessus de la zone de texte, au moins aussi large qu'elle
        const rect = suggest.input.getBoundingClientRect();
        const width = Math.max(260, rect.width);
        this.suggestEl.style.left = `${Math.min(rect.left, window.innerWidth - width - 8)}px`;
        this.suggestEl.style.width = `${width}px`;
        this.suggestEl.style.bottom = `${window.innerHeight - rect.top + 6}px`;
        this.suggestEl.querySelector(".sc-active")?.scrollIntoView({ block: "nearest" });
    }

    chooseSuggestion(index) {
        const suggest = this.suggest;
        const item = suggest?.items[index];
        if (!item) return;
        const { pane, input } = suggest;
        const text = `${item.type === "channel" ? "#" : "@"}${item.label}`;
        const value = item.type === "user" ? `<@${item.id}>` : item.type === "role" ? `<@&${item.id}>`
            : item.type === "channel" ? `<#${item.id}>` : `@${item.id}`;
        if (!pane.mentions.some(mention => mention.text === text)) pane.mentions.push({ text, value });

        input.value = `${input.value.slice(0, suggest.start)}${text} ${input.value.slice(suggest.end)}`;
        const cursor = suggest.start + text.length + 1;
        input.setSelectionRange(cursor, cursor);
        pane.draft = input.value;
        autoSize(input);
        this.closeSuggestions();
        input.focus();
    }

    closeSuggestions() {
        this.suggest = null;
        this.suggestEl?.remove();
        this.suggestEl = null;
    }

    // --- Rendu ---

    renderHead(pane) {
        const info = this.describe(pane.channelId);
        const id = escapeHtml(pane.channelId);
        const badge = pane.unseen ? `<span class="sc-badge">${pane.unseen > 99 ? "99+" : pane.unseen}</span>` : "";
        const icon = iconHtml(info.icon, info.letters ?? info.name);
        const head = `
            ${icon}
            <div class="sc-title"><b title="${escapeHtml(info.name)}">${escapeHtml(info.name)}</b><small title="${escapeHtml(info.sub)}">${escapeHtml(info.sub)}</small></div>
            ${badge}
            <button class="sc-head-btn" data-action="open-main" data-channel="${id}" title="Open in the main view">↗</button>
            <button class="sc-head-btn" data-action="collapse" data-channel="${id}" title="Fold">–</button>
            <button class="sc-head-btn" data-action="close" data-channel="${id}" title="Close">✕</button>`;
        if (pane.headHtml !== head) {
            pane.el.head.innerHTML = head;
            pane.headHtml = head;
        }
        const strip = `${icon}${badge}<span class="sc-strip-name">${escapeHtml(info.name)}</span>`;
        if (pane.stripHtml !== strip) {
            pane.el.strip.innerHTML = strip;
            pane.el.strip.title = `${info.name} — click to unfold`;
            pane.stripHtml = strip;
        }
        pane.el.input.placeholder = `Message ${info.name}`;
    }

    renderReplyBar(pane) {
        const target = pane.replyTo && this.findMessage(pane.channelId, pane.replyTo);
        pane.el.replybar.innerHTML = target ? `
            <span>Replying to <b>${escapeHtml(this.getName(target.author ?? {}, pane.guildId))}</b></span>
            <button data-action="cancel-reply" data-channel="${escapeHtml(pane.channelId)}" title="Cancel (Esc)">✕</button>` : "";
    }

    renderTyping(pane) {
        const names = [...pane.typing.keys()].map(id => {
            const user = this.stores.UserStore?.getUser?.(id);
            return user ? this.getName(user, pane.guildId) : "Someone";
        });
        pane.el.typing.textContent = !names.length ? ""
            : names.length === 1 ? `${names[0]} is typing…`
            : names.length <= 3 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} are typing…`
            : "Several people are typing…";
    }

    // keepBottom : des messages ont été ajoutés au-dessus, on garde la même distance avec le bas
    renderList(pane, keepBottom = false) {
        if (!pane) return;
        const channel = this.stores.ChannelStore?.getChannel?.(pane.channelId);
        let html;
        if (pane.error) html = `<div class="sc-info sc-error">${escapeHtml(pane.error)}</div>`;
        else if (!pane.loaded) html = `<div class="sc-info">Loading…</div>`;
        else {
            const rows = [pane.hasMore
                ? `<div class="sc-info">Loading older messages…</div>`
                : `<div class="sc-info">This is the beginning of ${escapeHtml(this.describe(pane.channelId).name)}</div>`];
            let previous = null;
            for (const message of pane.messages) {
                // Changement de jour : une ligne avec la date, comme dans Discord
                const day = new Date(idToTime(message.id)).toDateString();
                if (!previous || day !== new Date(idToTime(previous.id)).toDateString()) {
                    rows.push(`<div class="sc-separator">${escapeHtml(new Date(idToTime(message.id)).toLocaleDateString(undefined, { dateStyle: "long" }))}</div>`);
                    previous = null;
                }
                rows.push(this.renderMessage(pane, message, previous));
                previous = message;
            }
            html = rows.join("");
        }
        if (html === pane.lastHtml) return;

        const { scroll, list } = pane.el;
        const fromBottom = scroll.scrollHeight - scroll.scrollTop;
        const focused = document.activeElement?.closest?.(".sc-edit-input");
        const focus = focused && list.contains(focused) ? { start: focused.selectionStart, end: focused.selectionEnd } : null;
        // Les vidéos, GIF et stickers en cours sont gardés tels quels, pour ne pas les relancer à chaque message
        const videos = new Map();
        for (const video of list.querySelectorAll(".sc-attachments video")) videos.set(videoKey(video), video);
        const stickers = new Map();
        for (const sticker of list.querySelectorAll(".sc-lottie.sc-ready")) stickers.set(sticker.dataset.key, sticker);

        pane.restoring = true;
        list.innerHTML = html;
        pane.lastHtml = html;
        for (const video of list.querySelectorAll(".sc-attachments video")) {
            const old = videos.get(videoKey(video));
            if (old) video.replaceWith(old);
        }
        for (const sticker of list.querySelectorAll(".sc-lottie")) {
            const old = stickers.get(sticker.dataset.key);
            if (old) sticker.replaceWith(old);
            else this.playSticker(sticker);
        }
        const edit = list.querySelector(".sc-edit-input");
        if (edit) {
            edit.value = this.editing?.draft ?? "";
            autoSize(edit);
            if (focus) {
                edit.focus();
                edit.setSelectionRange(focus.start, focus.end);
            }
        }

        if (pane.stick) scroll.scrollTop = scroll.scrollHeight;
        else if (keepBottom) scroll.scrollTop = scroll.scrollHeight - fromBottom;
        pane.restoring = false;

        // Nouveaux messages pendant qu'on lit plus haut : un bouton pour redescendre
        pane.el.newbar.hidden = pane.stick || !pane.unseen;
        pane.el.newbar.textContent = `${pane.unseen} new message${pane.unseen === 1 ? "" : "s"} ↓`;
        if (!channel && pane.loaded) this.renderHead(pane);
    }

    renderMessage(pane, message, previous) {
        const guildId = pane.guildId;
        const author = message.author ?? {};
        // Messages consécutifs du même auteur, rapprochés et sans réponse : on les regroupe
        const grouped = previous && previous.author?.id === author.id && !message.referenced_message
            && idToTime(message.id) - idToTime(previous.id) < 5 * 60000;
        const classes = ["sc-msg"];
        if (grouped) classes.push("sc-grouped");
        if (message.scDeleted) classes.push("sc-deleted");
        if (pane.replyTo === message.id) classes.push("sc-replying");
        const own = Boolean(author.id && author.id === this.stores.UserStore?.getCurrentUser?.()?.id);
        if (own) classes.push("sc-own");
        if (this.mentionsMe(message, guildId)) classes.push("sc-mentioned");
        const target = `data-channel="${escapeHtml(message.channel_id)}" data-message="${escapeHtml(message.id)}"`;
        const editing = this.editing?.messageId === message.id;
        const tools = message.scDeleted || editing ? "" : `
            <div class="sc-msg-tools">
                <button data-action="add-reaction" ${target} title="Add Reaction">☺ +</button>
                ${own && !message.webhook_id ? `<button data-action="edit" ${target}>✎</button>` : ""}
                <button data-action="reply" ${target} title="Reply">↩</button>
            </div>`;
        const reactions = message.reactions?.length && !message.scDeleted ? `
            <div class="sc-reactions">
                ${message.reactions.map(reaction => `
                    <button class="sc-reaction${reaction.me ? " sc-me" : ""}" data-action="react" ${target}
                        data-emoji="${escapeHtml(JSON.stringify({ id: reaction.emoji.id ?? null, name: reaction.emoji.name, animated: Boolean(reaction.emoji.animated) }))}"
                        title=":${escapeHtml(reaction.emoji.name ?? "")}:">${emojiHtml(reaction.emoji)}<span>${reaction.count}</span></button>`).join("")}
                <button class="sc-reaction sc-reaction-add" data-action="add-reaction" ${target} title="Add Reaction">☺ +</button>
            </div>` : "";

        // Pas de membre pour un webhook : son auteur n'existe pas vraiment sur le serveur
        const member = message.webhook_id ? null : this.getMember(author.id, guildId);
        const color = member?.colorString ? ` style="color: ${escapeHtml(member.colorString)}"` : "";
        const reply = message.referenced_message
            ? `<div class="sc-reply">↪ <span><b>${escapeHtml(this.getName(message.referenced_message.author ?? {}, guildId))}</b> ${escapeHtml(stripText(this.plainText(message.referenced_message, guildId)))}</span></div>`
            : "";
        const meta = grouped ? "" : `
            <div class="sc-meta">
                <span class="sc-author" data-action="profile" data-user="${escapeHtml(author.id ?? "")}"${color}>${escapeHtml(this.getName(author, guildId))}</span>
                ${author.bot ? `<span class="sc-bot">BOT</span>` : ""}
                <span class="sc-time">${formatTime(idToTime(message.id))}</span>
            </div>`;

        return `
            <div class="${classes.join(" ")}" data-message="${escapeHtml(message.id)}">
                <img class="sc-avatar" src="${escapeHtml(getAvatar(author, member, guildId))}" alt="" data-action="profile" data-user="${escapeHtml(author.id ?? "")}">
                ${tools}
                <div class="sc-body">
                    ${reply}${meta}
                    ${editing ? `
                        <div class="sc-edit">
                            <textarea class="sc-edit-input" ${target} rows="1"></textarea>
                            <div class="sc-edit-hint">Escape to <span data-action="cancel-edit">cancel</span> • Enter to <span data-action="save-edit">save</span></div>
                        </div>`
                        : `<div class="sc-text">${this.renderContent(message, guildId)}${message.edited_timestamp ? ` <span class="sc-edited">(edited)</span>` : ""}</div>`}
                    ${renderStickers(message)}
                    ${renderAttachments(message, target)}
                    ${reactions}
                </div>
            </div>`;
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
        if (!data || !node.isConnected || node.classList.contains("sc-ready")) return;
        node.textContent = "";
        node.classList.add("sc-ready");
        try {
            this.lottie.loadAnimation({ container: node, renderer: "svg", loop: true, autoplay: true, animationData: data });
        } catch (error) {
            console.error(`[${this.meta.name}] couldn't play the sticker`, error);
        }
    }

    // Comme Discord : mention directe, @everyone / @here (sauf si on les a coupés) ou un de nos rôles
    mentionsMe(message, guildId) {
        const me = this.stores.UserStore?.getCurrentUser?.()?.id;
        if (!me || message.scDeleted || message.author?.id === me) return false;
        if (message.mentions?.some(user => (user?.id ?? user) === me)) return true;
        if (!guildId) return false;
        if (message.mention_everyone && !this.stores.UserGuildSettingsStore?.isSuppressEveryoneEnabled?.(guildId)) return true;
        if (!message.mention_roles?.length || this.stores.UserGuildSettingsStore?.isSuppressRolesEnabled?.(guildId)) return false;
        const roles = this.getMember(me, guildId)?.roles ?? [];
        return message.mention_roles.some(id => roles.includes(id));
    }

    getName(author, guildId) {
        // Pseudo du serveur en priorité (le membre est demandé à Discord s'il n'est pas encore chargé)
        const nick = author.id && guildId ? this.getMember(author.id, guildId)?.nick : null;
        return nick ?? userName(author);
    }

    // Rôles du serveur, par identifiant. Discord les a déplacés d'un store à l'autre selon les versions :
    // on essaie les deux, et en dernier recours on les demande à l'API (une fois par serveur)
    getRoles(guildId) {
        if (!guildId) return {};
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
                for (const pane of this.panes) if (pane.guildId === guildId) this.renderList(pane);
            }).catch(error => console.error(`[${this.meta.name}] couldn't load the roles`, error));
        }
        return this.roleCache.get(guildId);
    }

    // Profil de la personne sur ce serveur (pseudo, photo et couleur de serveur).
    // Discord ne garde que les membres déjà vus : on lui demande les autres, puis on réaffiche
    getMember(userId, guildId) {
        if (!userId || !guildId) return null;
        const member = this.stores.GuildMemberStore?.getMember?.(guildId, userId);
        if (member) return member;
        this.requestedMembers ??= new Set();
        const key = `${guildId}:${userId}`;
        if (!this.requestedMembers.has(key)) {
            this.requestedMembers.add(key);
            this.missingMembers ??= new Map();
            if (!this.missingMembers.has(guildId)) this.missingMembers.set(guildId, new Set());
            this.missingMembers.get(guildId).add(userId);
            this.memberTimer ??= setTimeout(() => this.requestMembers(), 200);
        }
        return null;
    }

    requestMembers() {
        this.memberTimer = null;
        const missing = this.missingMembers ?? new Map();
        this.missingMembers = new Map();
        for (const [guildId, set] of missing) {
            const ids = [...set];
            for (let i = 0; i < ids.length; i += 100) {
                try {
                    const userIds = ids.slice(i, i + 100);
                    // Sans le module de Discord, on envoie nous-mêmes la demande qu'il aurait faite
                    if (this.memberActions?.requestMembersById) this.memberActions.requestMembersById(guildId, userIds);
                    else this.dispatcher.dispatch({ type: "GUILD_MEMBERS_REQUEST", guildIds: [guildId], userIds, presences: false });
                } catch (error) {
                    console.error(`[${this.meta.name}] couldn't request members`, error);
                }
            }
        }
    }

    // Texte d'une ligne (aperçu du message auquel on répond) : mentions, salons et emojis lisibles
    plainText(message, guildId) {
        return String(message.content ?? "")
            .replace(/<@!?(\d+)>/g, (_, id) => {
                const user = this.stores.UserStore?.getUser?.(id) ?? normalizeUser(message.mentions?.find(item => item.id === id));
                return `@${user ? this.getName(user, guildId) : "user"}`;
            })
            .replace(/<@&(\d+)>/g, (_, id) => `@${this.getRoles(guildId)[id]?.name ?? "unknown-role"}`)
            .replace(/<#(\d+)>/g, (_, id) => `#${this.stores.ChannelStore?.getChannel?.(id)?.name ?? "channel"}`)
            .replace(/<?https?:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(?:\d+|@me)\/(\d+)(\/\d+)?\/?>?/g, (url, id, linked) => {
                const name = this.stores.ChannelStore?.getChannel?.(id)?.name;
                return name ? `#${name}${linked ? " › 💬" : ""}` : url;
            })
            .replace(/<a?:(\w+):\d+>/g, (_, name) => `:${name}:`)
            .replace(/<t:(-?\d+)(?::([tTdDfFR]))?>/g, (_, time, style) => formatTimestamp(Number(time) * 1000, style));
    }

    // Markdown de Discord. Le code, les liens, les mentions et les emojis sont mis de côté d'abord
    // (remplacés par des repères), pour que leurs * ou _ ne soient pas pris pour de la mise en forme
    renderContent(message, guildId) {
        const stash = [];
        const keep = html => `\u0000${stash.push(html) - 1}\u0000`;
        const link = (url, text) => keep(`<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${text}</a>`);

        let raw = String(message.content ?? "");
        raw = raw.replace(/```(?:([\w+#-]+)\n)?([\s\S]*?)```/g, (_, lang, code) =>
            keep(`<code class="sc-codeblock">${escapeHtml(code.replace(/^\n+|\n+$/g, ""))}</code>`));
        raw = raw.replace(/``([^`]+?)``|`([^`\n]+?)`/g, (_, double, single) =>
            keep(`<code class="sc-code">${escapeHtml(double ?? single)}</code>`));
        raw = raw.replace(/\[([^\]\n]+)\]\(<?(https?:\/\/[^\s)>]+)>?\)/g, (_, text, url) => link(url, escapeHtml(text)));
        // Lien de salon ou de message copié : une pastille « #salon » comme dans Discord
        raw = raw.replace(/<?(https?:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)(?:\/(\d+))?)\/?>?/g, (_, url, linkGuild, channelId, messageId) => {
            const channel = this.stores.ChannelStore?.getChannel?.(channelId);
            if (!channel?.name) return link(url, escapeHtml(url));
            return keep(`<span class="sc-mention" data-action="jump" data-guild="${escapeHtml(linkGuild)}" data-channel="${channelId}"${messageId ? ` data-message="${messageId}"` : ""}>#${escapeHtml(channel.name)}${messageId ? " › 💬" : ""}</span>`);
        });
        raw = raw.replace(/<?(https?:\/\/[^\s<>]*[^\s<>.,:;"')\]!?])>?/g, (_, url) => link(url, escapeHtml(url)));
        raw = raw.replace(/<@!?(\d+)>/g, (_, id) => {
            const user = this.stores.UserStore?.getUser?.(id);
            const mention = message.mentions?.find(item => item.id === id);
            return keep(`<span class="sc-mention" data-action="profile" data-user="${id}">@${escapeHtml(user ? this.getName(user, guildId) : mention ? this.getName(mention, guildId) : "user")}</span>`);
        });
        raw = raw.replace(/<@&(\d+)>/g, (_, id) => {
            const role = this.getRoles(guildId)[id];
            // Comme Discord : la mention prend la couleur du rôle
            const color = role?.colorString ?? (role?.color ? `#${role.color.toString(16).padStart(6, "0")}` : null);
            const style = color ? ` style="color: ${escapeHtml(color)}; background: color-mix(in srgb, ${escapeHtml(color)} 15%, transparent)"` : "";
            return keep(`<span class="sc-mention"${style}>@${escapeHtml(role?.name ?? "unknown-role")}</span>`);
        });
        raw = raw.replace(/<#(\d+)>/g, (_, id) => {
            const channel = this.stores.ChannelStore?.getChannel?.(id);
            if (!channel) return keep(`<span class="sc-mention">#channel</span>`);
            return keep(`<span class="sc-mention" data-action="jump" data-guild="${escapeHtml(channel.guild_id ?? "@me")}" data-channel="${id}">#${escapeHtml(channel.name ?? "channel")}</span>`);
        });
        raw = raw.replace(/<(a?):(\w+):(\d+)>/g, (_, animated, name, id) =>
            keep(`<img class="sc-emoji" alt=":${escapeHtml(name)}:" src="https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=48">`));
        raw = raw.replace(/<t:(-?\d+)(?::([tTdDfFR]))?>/g, (_, time, style) =>
            keep(`<span class="sc-timestamp">${escapeHtml(formatTimestamp(Number(time) * 1000, style))}</span>`));

        let html = raw.trim() ? renderBlocks(raw.split("\n")) : "";
        // Les repères peuvent en contenir d'autres (texte d'un lien) : on remplace jusqu'à ce qu'il n'en reste plus
        for (let i = 0; i < 3 && html.includes("\u0000"); i++) html = html.replace(/\u0000(\d+)\u0000/g, (_, index) => stash[index]);

        if (!html && message.embeds?.length && !message.embeds.some(embed => embed.thumbnail || embed.image)) {
            html = `<i>${escapeHtml(message.embeds[0].title ?? message.embeds[0].description ?? "Embed")}</i>`;
        }
        // Messages système (appel, membre ajouté au groupe, épinglé…) : une ligne en italique
        if (!html && message.type && message.type !== 19 && !message.attachments?.length && !message.sticker_items?.length) {
            html = `<i class="sc-edited">${escapeHtml(SYSTEM_MESSAGES[message.type] ?? "System message")}</i>`;
        }
        return html;
    }

    // --- Paramètres ---

    getSettingsPanel() {
        const panel = el("div", "sc-settings");
        panel.append(
            this.checkbox("Mark side chats as read while you watch them", "markRead"),
            this.checkbox("Let others see when you're typing in a side chat (never with InvisibleTyping on)", "sendTyping"),
            el("div", "sc-hint", "Open a chat with the ⧉ Chats button at the top right of the channel, or right-click a channel, a DM, a group or a person. Drag the left edge of a chat to resize it.")
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

// Messages système des groupes et des salons
const SYSTEM_MESSAGES = {
    1: "Added someone to the group.", 2: "Removed someone from the group.", 3: "Started a call.", 4: "Changed the group name.",
    5: "Changed the group icon.", 6: "Pinned a message.", 7: "Joined the server.", 8: "Boosted the server.", 18: "Started a thread."
};

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
            out.push(`<div class="sc-quote">${renderBlocks([match[1], ...lines.slice(i + 1)])}</div>`);
            break;
        }
        if (/^> /.test(line) || line === ">") {
            flush();
            const quoted = [];
            while (i < lines.length && (/^> /.test(lines[i]) || lines[i] === ">")) quoted.push(lines[i++].slice(2));
            i--;
            out.push(`<div class="sc-quote">${renderBlocks(quoted)}</div>`);
        } else if ((match = line.match(/^(#{1,3}) +(.+)$/))) {
            flush();
            out.push(`<div class="sc-h sc-h${match[1].length}">${renderInline(match[2])}</div>`);
        } else if ((match = line.match(/^-# +(.+)$/))) {
            flush();
            out.push(`<div class="sc-subtext">${renderInline(match[1])}</div>`);
        } else if ((match = line.match(/^( *)(?:[-*]|(\d+)\.) +(.+)$/))) {
            flush();
            const indent = Math.min(match[1].length, 8) * 6;
            out.push(`<div class="sc-li" style="padding-left: ${indent}px"><span class="sc-bullet">${match[2] ? `${match[2]}.` : "•"}</span><span>${renderInline(match[3])}</span></div>`);
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
        .replace(/\|\|(.+?)\|\|/g, `<span class="sc-spoiler" data-action="spoiler">$1</span>`);
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

// Les « @Pseudo » choisis dans la liste deviennent de vraies mentions (les plus longs d'abord)
function applyMentions(mentions, content) {
    for (const { text, value } of [...mentions].sort((a, b) => b.text.length - a.text.length)) content = content.split(text).join(value);
    return content;
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
    return `${video.closest(".sc-msg")?.dataset.message}|${video.getAttribute("src")}`;
}

// Stickers en image (PNG, APNG animé ou GIF). Ceux en Lottie (les stickers officiels de Discord) sont animés
// ensuite par le lecteur de Discord ; en attendant (ou s'il manque) on écrit leur nom
function renderStickers(message) {
    if (!message.sticker_items?.length || message.scDeleted) return "";
    return `<div class="sc-stickers">${message.sticker_items.map(sticker => sticker.format_type === 3
        ? `<div class="sc-sticker sc-lottie" data-sticker="${escapeHtml(sticker.id)}" data-key="${escapeHtml(`${message.id}:${sticker.id}`)}" title="${escapeHtml(sticker.name)}"><i>Sticker: ${escapeHtml(sticker.name)}</i></div>`
        : `<img class="sc-sticker" src="https://media.discordapp.net/stickers/${escapeHtml(sticker.id)}.${sticker.format_type === 4 ? "gif" : "png"}?size=160" alt="${escapeHtml(sticker.name)}" title="${escapeHtml(sticker.name)}">`).join("")}</div>`;
}

// Images jointes (fichiers et aperçus de liens) en miniatures, vidéos avec un lecteur, autres fichiers en lien
function renderAttachments(message, target) {
    const items = getImages(message).map((image, index) => image.video
        ? `<video src="${escapeHtml(image.preview)}" autoplay loop muted playsinline data-action="image" ${target} data-index="${index}"></video>`
        : `<img src="${escapeHtml(image.preview)}" alt="" data-action="image" ${target} data-index="${index}">`);
    for (const file of message.attachments ?? []) {
        if (isImageFile(file)) continue;
        if (file.content_type?.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.filename ?? "")) {
            items.push(`<video class="sc-video" src="${escapeHtml(file.proxy_url ?? file.url)}" controls preload="metadata" data-action="media"></video>`);
        } else items.push(`<a class="sc-file" href="${escapeHtml(file.url)}" target="_blank" rel="noreferrer">📎 ${escapeHtml(file.filename)}</a>`);
    }
    return items.length ? `<div class="sc-attachments">${items.join("")}</div>` : "";
}

// Image ronde d'une conversation, ou ses initiales s'il n'y en a pas
function iconHtml(url, name) {
    return url ? `<img class="sc-icon" src="${escapeHtml(url)}" alt="">` : `<span class="sc-icon">${escapeHtml(initials(name ?? "?"))}</span>`;
}

function initials(name) {
    return String(name).replace(/^[#🔊🧵 ]+/u, "").split(/\s+/).map(word => [...word][0] ?? "").join("").slice(0, 3) || "?";
}

// Menu de Discord : la liste de ses groupes d'options, à quelques niveaux de profondeur
function findMenuGroups(tree) {
    let node = tree;
    for (let depth = 0; node && depth < 10; depth++) {
        const children = node.props?.children;
        if (Array.isArray(children)) return children;
        node = children;
    }
    return null;
}

// Auteur venant de l'API (global_name) au format des utilisateurs de Discord (globalName)
function normalizeUser(author) {
    return author?.id ? { ...author, globalName: author.global_name } : null;
}

function userName(user) {
    return user.globalName ?? user.global_name ?? user.username ?? "Unknown";
}

function getAvatar(author, member, guildId) {
    if (member?.avatar && guildId) return `https://cdn.discordapp.com/guilds/${guildId}/users/${author.id}/avatars/${member.avatar}.webp?size=64`;
    if (author.avatar) return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.webp?size=64`;
    const index = author.id ? Number((BigInt(author.id) >> 22n) % 6n) : 0;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function scrollToBottom(pane) {
    const { scroll } = pane.el;
    scroll.scrollTop = scroll.scrollHeight;
}

function focusEnd(input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
}

// L'identifiant d'un message contient sa date d'envoi
function idToTime(id) {
    return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
}

function compareIds(a, b) {
    const x = BigInt(a.id), y = BigInt(b.id);
    return x < y ? -1 : x > y ? 1 : 0;
}

function dedupe(messages) {
    const seen = new Set();
    return messages.filter(message => !seen.has(message.id) && seen.add(message.id)).sort(compareIds);
}

function autoSize(input) {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

function formatTime(time) {
    const date = new Date(time);
    const clock = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return date.toDateString() === new Date().toDateString()
        ? clock
        : `${date.toLocaleDateString([], { day: "2-digit", month: "2-digit" })} ${clock}`;
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
