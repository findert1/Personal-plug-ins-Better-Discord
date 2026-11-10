/**
 * @name AutoRename
 * @author findert
 * @description Automatically renames the files you upload (IMG_2034.jpg, image.png...) using a pattern with the date, channel, server and more.
 * @version 1.0.1
 */

const DEFAULT_SETTINGS = {
    pattern: "{channel}_{date}_{time}",
    // Ne renommer que les noms génériques (IMG_1234, image.png, Screenshot…) et garder les noms choisis à la main
    genericOnly: true,
    // Espaces remplacés par « _ », accents retirés : des noms qui passent partout
    clean: true
};

// Noms donnés automatiquement par les téléphones, appareils photo, captures et le presse-papiers
const GENERIC_NAME = /^(img|image|vid|video|dsc|dscn|dcim|pxl|mvimg|photo|picture|screenshot|capture|screen ?shot|screen recording|capture d.?écran|snapshot|unknown|clipboard|untitled|sans titre|signal|whatsapp image|whatsapp video|wp)([ _\-.(]|\d|$)|^[\d _\-.()]+$|^[0-9a-f]{8}-[0-9a-f]{4}-/i;

const TOKENS = [
    ["{name}", "original name (without extension)"],
    ["{date}", "date, 2026-11-10"],
    ["{time}", "time, 14-32-05"],
    ["{timestamp}", "Unix time in seconds"],
    ["{channel}", "channel name, or the person's name in DMs"],
    ["{server}", "server name (\"DM\" in DMs)"],
    ["{user}", "your username"],
    ["{n}", "file number when you send several at once"],
    ["{random}", "6 random letters and digits"]
];

const CSS = `
.ar-panel { color: var(--text-normal); display: flex; flex-direction: column; gap: 14px; }
.ar-field { display: flex; flex-direction: column; gap: 6px; }
.ar-panel input[type="text"] {
    background: var(--background-tertiary, #1e1f22); color: var(--text-normal, #dbdee1);
    border: 1px solid var(--background-modifier-accent, #4e5058); border-radius: 4px;
    padding: 8px; font-family: inherit; font-size: 14px; user-select: text;
}
.ar-panel input[type="text"]:focus { outline: none; border-color: var(--brand-500, #5865f2); }
.ar-hint { color: var(--text-muted, #949ba4); font-size: 13px; }
.ar-example { font-family: var(--font-code, monospace); font-size: 13px; color: var(--text-normal, #dbdee1); }
.ar-check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.ar-tokens { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; font-size: 13px; color: var(--text-muted, #949ba4); }
.ar-tokens code { color: var(--text-normal, #dbdee1); cursor: pointer; }
`;

module.exports = class AutoRename {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        this.settings = Object.assign({ ...DEFAULT_SETTINGS }, BdApi.Data.load(this.meta.name, "settings"));
        BdApi.DOM.addStyle(this.meta.name, CSS);

        const { Webpack } = BdApi;
        this.stores = Object.fromEntries(["UserStore", "GuildStore", "ChannelStore"].map(name => [name, Webpack.getStore(name)]));

        // Fichiers déjà renommés : ils passent souvent par les deux fonctions ci-dessous, on ne les renomme qu'une fois
        this.renamed = new WeakSet();
        let hooks = 0;

        // 1. La fonction qui reçoit les fichiers choisis avec le bouton + : attachFiles(files, channel, draftType, options)
        const [attachModule, attachKey] = Webpack.getWithKey(Webpack.Filters.byStrings("filesMetadata:", "requireConfirm:")) ?? [];
        if (attachModule && attachKey) {
            hooks++;
            BdApi.Patcher.before(this.meta.name, attachModule, attachKey, (_, args) => {
                if (Array.isArray(args[0])) args[0] = this.renameFiles(args[0], args[1], "attachFiles");
            });
        }

        // 2. Celle qui met les fichiers dans la barre de message, par où passent aussi le collage et le glisser-déposer :
        // addFiles({ files: [{ file, platform }], channelId, draftType })
        const uploads = Webpack.getModule(m => typeof m?.addFiles === "function" && typeof m?.setUploads === "function");
        if (uploads) {
            hooks++;
            BdApi.Patcher.before(this.meta.name, uploads, "addFiles", (_, args) => {
                const options = args[0];
                if (!Array.isArray(options?.files)) return;
                const channel = this.stores.ChannelStore?.getChannel?.(options.channelId);
                const files = options.files.map(item => item?.file ?? item);
                const renamed = this.renameFiles(files, channel, "addFiles");
                options.files = options.files.map((item, i) => item?.file ? { ...item, file: renamed[i] } : renamed[i]);
            });
        }

        console.log(`[${this.meta.name}] started: attachFiles ${attachKey ? "found" : "NOT found"}, addFiles ${uploads ? "found" : "NOT found"}`);
        if (!hooks) BdApi.UI.showToast("AutoRename: upload module not found", { type: "error" });
    }

    stop() {
        BdApi.Patcher.unpatchAll(this.meta.name);
        BdApi.DOM.removeStyle(this.meta.name);
    }

    // --- Renommage ---

    renameFiles(files, channel, source) {
        try {
            const now = new Date();
            const used = new Set();
            return files.map((file, index) => {
                if (!(file instanceof File) || this.renamed.has(file)) return file;
                const name = this.newName(file.name, { channel, now, index, count: files.length }, used);
                if (!name || name === file.name) {
                    console.log(`[${this.meta.name}] ${source}: "${file.name}" kept (not a generic name)`);
                    return file;
                }
                const renamed = new File([file], name, { type: file.type, lastModified: file.lastModified });
                this.renamed.add(renamed);
                console.log(`[${this.meta.name}] ${source}: "${file.name}" → "${name}"`);
                return renamed;
            });
        } catch (error) {
            console.error(`[${this.meta.name}] rename failed, files kept as they are`, error);
            return files;
        }
    }

    newName(fileName, context, used) {
        // « SPOILER_ » doit rester au début du nom, sinon Discord ne floute plus l'image
        let base = fileName;
        let spoiler = "";
        if (/^SPOILER_/i.test(base)) {
            spoiler = "SPOILER_";
            base = base.slice(8);
        }
        const dot = base.lastIndexOf(".");
        const ext = dot > 0 ? base.slice(dot) : "";
        const stem = dot > 0 ? base.slice(0, dot) : base;

        if (this.settings.genericOnly && !GENERIC_NAME.test(stem)) return null;

        let name = this.fillPattern(stem, context);
        if (this.settings.clean) name = cleanName(name);
        name = sanitize(name) || sanitize(stem) || "file";

        // Deux fichiers du même envoi ne doivent pas avoir le même nom
        let unique = name;
        for (let i = 2; used.has((unique + ext).toLowerCase()); i++) unique = `${name}_${i}`;
        used.add((unique + ext).toLowerCase());
        return spoiler + unique + ext.toLowerCase();
    }

    fillPattern(stem, { channel, now, index, count }) {
        const pad = value => String(value).padStart(2, "0");
        const values = {
            name: stem,
            date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
            time: `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`,
            timestamp: Math.floor(now.getTime() / 1000),
            channel: this.channelName(channel),
            server: channel?.guild_id ? this.stores.GuildStore?.getGuild?.(channel.guild_id)?.name ?? "server" : "DM",
            user: this.stores.UserStore?.getCurrentUser?.()?.username ?? "me",
            n: count > 1 ? index + 1 : 1,
            random: Math.random().toString(36).slice(2, 8)
        };
        return this.settings.pattern.replace(/\{(\w+)\}/g, (match, token) => token in values ? String(values[token]) : match);
    }

    channelName(channel) {
        if (channel?.name) return channel.name;
        // MP : le nom de la personne (ou des personnes dans un groupe sans nom)
        const names = (channel?.recipients ?? [])
            .map(id => this.stores.UserStore?.getUser?.(id))
            .map(user => user?.globalName ?? user?.username)
            .filter(Boolean);
        return names.join("-") || "DM";
    }

    // --- Paramètres ---

    saveSettings() {
        BdApi.Data.save(this.meta.name, "settings", this.settings);
    }

    getSettingsPanel() {
        const panel = el("div", "ar-panel");

        const pattern = el("input");
        pattern.type = "text";
        pattern.value = this.settings.pattern;
        pattern.placeholder = DEFAULT_SETTINGS.pattern;
        const example = el("div", "ar-example");
        const updateExample = () => {
            const sample = { name: "IMG_2034.JPG", context: { channel: { name: "general", guild_id: null }, now: new Date(), index: 0, count: 1 } };
            const genericOnly = this.settings.genericOnly;
            this.settings.genericOnly = false;
            example.textContent = `Example: IMG_2034.JPG → ${this.newName(sample.name, sample.context, new Set())}`;
            this.settings.genericOnly = genericOnly;
        };
        pattern.addEventListener("input", () => {
            this.settings.pattern = pattern.value.trim() || DEFAULT_SETTINGS.pattern;
            this.saveSettings();
            updateExample();
        });

        const patternField = el("div", "ar-field");
        patternField.append(el("span", "ar-hint", "Name pattern (the extension is kept)"), pattern, example);
        panel.append(patternField);

        // Cliquer sur un mot-clé l'ajoute au modèle
        const tokens = el("div", "ar-tokens");
        for (const [token, label] of TOKENS) {
            const code = el("code", "", token);
            code.title = "Click to add it to the pattern";
            code.addEventListener("click", () => {
                pattern.value += token;
                pattern.dispatchEvent(new Event("input"));
            });
            tokens.append(code, el("span", "", label));
        }
        panel.append(tokens);

        panel.append(
            checkbox("Only rename generic names (IMG_1234, image.png, Screenshot...) and keep names you chose yourself", this.settings.genericOnly, value => {
                this.settings.genericOnly = value;
                this.saveSettings();
            }),
            checkbox("Clean names: spaces become _, accents and emojis are removed", this.settings.clean, value => {
                this.settings.clean = value;
                this.saveSettings();
                updateExample();
            })
        );

        updateExample();
        return panel;
    }
};

function cleanName(name) {
    return name
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^\w.\-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

// Caractères interdits dans les noms de fichiers, et longueur raisonnable
function sanitize(name) {
    return String(name).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/^[\s.]+|[\s.]+$/g, "").slice(0, 120);
}

function checkbox(label, checked, onChange) {
    const wrap = el("label", "ar-check");
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
