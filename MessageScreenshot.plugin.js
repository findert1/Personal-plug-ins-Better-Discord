/**
 * @name MessageScreenshot
 * @author findert
 * @description Right-click a message to copy it (or the last few messages) to your clipboard as a clean image.
 * @version 1.2.0
 */

// Nombre de messages proposés dans le sous-menu
const COUNTS = [1, 3, 5, 10];

// Deux messages du même auteur à moins de 7 minutes d'intervalle sont regroupés, comme dans Discord
const GROUP_DELAY = 7 * 60 * 1000;

// Dimensions de l'image (en pixels CSS, multipliées par SCALE pour la netteté)
const SCALE = 2;
const WIDTH = 640;
const PADDING = 16;
const AVATAR_SIZE = 40;
const TEXT_X = PADDING + AVATAR_SIZE + 16;
const TEXT_WIDTH = WIDTH - TEXT_X - PADDING;
const HEADER_HEIGHT = 22;
const GROUP_GAP = 16;
const MAX_IMAGE_WIDTH = 400;
const MAX_IMAGE_HEIGHT = 300;

// Mise en page Markdown
const QUOTE_INDENT = 16;
const BULLET_INDENT = 20;
const CODE_BLOCK_PADDING = 8;
const CODE_BLOCK_FONT_SIZE = 14;
const CODE_BLOCK_LINE_HEIGHT = 18;
const JUMBO_EMOJI_SIZE = 48;
const JUMBO_MAX_EMOJIS = 30;

// Aperçus de liens (embeds)
const EMBED_MAX_WIDTH = 432;
const EMBED_BORDER = 4;
const EMBED_PADDING = 12;
const EMBED_GAP = 8;
const EMBED_THUMBNAIL_SIZE = 80;

const FONT_FAMILY = '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';
const CODE_FONT_FAMILY = 'Consolas, "Andale Mono WT", "Courier New", monospace';
const COLORS = {
    background: "#313338",
    text: "#dbdee1",
    muted: "#949ba4",
    name: "#f2f3f5",
    header: "#f2f3f5",
    placeholder: "#4e5058",
    link: "#00a8fc",
    mention: "#c9cdfb",
    mentionBackground: "rgba(88, 101, 242, 0.3)",
    codeBackground: "#2b2d31",
    codeBorder: "#1e1f22",
    quoteBar: "#4e5058",
    spoiler: "#1e1f22",
    tagBackground: "rgba(255, 255, 255, 0.08)",
    embedBackground: "#2b2d31",
    embedBorder: "#1e1f22"
};

// Style de chaque type de bloc (taille du texte, hauteur de ligne, marge au-dessus)
const BLOCK_STYLES = {
    paragraph: { size: 16, lineHeight: 22, bold: false, color: COLORS.text, marginTop: 0 },
    h1: { size: 24, lineHeight: 30, bold: true, color: COLORS.header, marginTop: 8 },
    h2: { size: 20, lineHeight: 26, bold: true, color: COLORS.header, marginTop: 8 },
    h3: { size: 16, lineHeight: 22, bold: true, color: COLORS.header, marginTop: 4 },
    subtext: { size: 13, lineHeight: 18, bold: false, color: COLORS.muted, marginTop: 0 }
};

// Catégories d'emojis unicode de Discord
const EMOJI_CATEGORIES = ["people", "nature", "food", "activity", "travel", "objects", "symbols", "flags"];

// Séquences d'emojis unicode : drapeaux, touches (1️⃣), emojis avec teinte de peau et combinaisons (👨‍👩‍👧)
const UNICODE_EMOJI_RE = /\p{Regional_Indicator}{2}|[#*0-9]️?⃣|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*/gu;

const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

module.exports = class MessageScreenshot {
    constructor(meta) {
        this.meta = meta;
    }

    start() {
        this.unpatchMenu = BdApi.ContextMenu.patch("message", (tree, props) => {
            try {
                this.patchMenu(tree, props);
            }
            catch (error) {
                console.error(`[${this.meta.name}]`, error);
            }
        });
    }

    stop() {
        this.unpatchMenu?.();
    }

    patchMenu(tree, props) {
        const message = props?.message;
        const channel = props?.channel ?? BdApi.Webpack.getStore("ChannelStore")?.getChannel(message?.channel_id);
        if (!message || !channel) return;

        const groups = findMenuGroups(tree);
        // Discord re-rend le menu plusieurs fois : on évite d'ajouter l'option en double
        if (!groups || groups.some(child => child?.props?.id === "message-screenshot")) return;

        const item = BdApi.ContextMenu.buildItem({
            type: "submenu",
            id: "message-screenshot",
            label: "Copy as image",
            action: () => this.capture(channel, message, 1),
            items: COUNTS.map(count => ({
                id: `message-screenshot-${count}`,
                label: count === 1 ? "This message" : `Last ${count} messages`,
                action: () => this.capture(channel, message, count)
            }))
        });
        groups.push(BdApi.ContextMenu.buildItem({ type: "separator" }), item);
    }

    // --- Capture ---

    async capture(channel, target, count) {
        try {
            const messages = getMessagesUpTo(channel.id, target, count);
            const canvas = await renderMessages(messages, channel.guild_id);
            await copyCanvas(canvas);
            BdApi.UI.showToast(
                messages.length > 1 ? `${messages.length} messages copied as image` : "Message copied as image",
                { type: "success" }
            );
        }
        catch (error) {
            console.error(`[${this.meta.name}]`, error);
            BdApi.UI.showToast("MessageScreenshot: could not create the image", { type: "error" });
        }
    }
};

// Le menu des messages n'expose pas directement la liste de ses groupes : elle est enveloppée
// dans un ou plusieurs éléments. On descend dans props.children jusqu'à trouver un tableau.
function findMenuGroups(tree) {
    let node = tree;
    for (let depth = 0; node && depth < 10; depth++) {
        const children = node.props?.children;
        if (Array.isArray(children)) return children;
        node = children;
    }
    return null;
}

// Récupère le message ciblé et les (count - 1) messages chargés juste avant lui
function getMessagesUpTo(channelId, target, count) {
    const stored = BdApi.Webpack.getStore("MessageStore")?.getMessages(channelId);
    const list = stored?.toArray?.() ?? stored?._array ?? [];
    const index = list.findIndex(m => m.id === target.id);
    if (index === -1) return [target];
    return list.slice(Math.max(0, index - count + 1), index + 1);
}

// --- Rendu ---

// Le rendu se fait en deux passes : on calcule d'abord la mise en page (et donc la hauteur
// de l'image), puis on dessine sur un canvas de la bonne taille.
async function renderMessages(messages, guildId) {
    const operations = [];
    let y = PADDING;
    let previous = null;

    for (const message of messages) {
        const author = message.author;
        const grouped = previous
            && previous.author?.id === author?.id
            && getTime(message) - getTime(previous) < GROUP_DELAY;

        let blockBottom = y;

        if (!grouped) {
            if (previous) y += GROUP_GAP;
            const headerY = y;
            const name = getDisplayName(author, guildId);
            const color = getNameColor(author, guildId);
            const tag = getGuildTag(author);
            const avatar = await loadImage(getAvatarUrl(author, guildId));

            operations.push(ctx => {
                drawAvatar(ctx, avatar, PADDING, headerY);
                let x = TEXT_X;

                ctx.font = `600 16px ${FONT_FAMILY}`;
                ctx.fillStyle = color;
                ctx.fillText(name, x, headerY + 16);
                x += ctx.measureText(name).width + 6;

                if (tag) {
                    ctx.font = `700 12px ${FONT_FAMILY}`;
                    const tagWidth = ctx.measureText(tag).width + 8;
                    ctx.fillStyle = COLORS.tagBackground;
                    roundedRect(ctx, x, headerY + 3, tagWidth, 17, 4);
                    ctx.fill();
                    ctx.fillStyle = COLORS.text;
                    ctx.fillText(tag, x + 4, headerY + 16);
                    x += tagWidth + 6;
                }

                ctx.font = `12px ${FONT_FAMILY}`;
                ctx.fillStyle = COLORS.muted;
                ctx.fillText(formatDate(getTime(message)), x + 2, headerY + 16);
            });

            y += HEADER_HEIGHT;
            blockBottom = headerY + AVATAR_SIZE;
        }

        // Texte mis en forme
        const body = await layoutContent(message.content ?? "", guildId, TEXT_WIDTH);
        if (body.height) {
            const bodyY = y;
            operations.push(ctx => body.draw(ctx, TEXT_X, bodyY));
            y += body.height;
        }

        // Images jointes
        for (const attachment of message.attachments ?? []) {
            if (!isImage(attachment)) continue;
            const image = await loadImage(attachment.proxy_url ?? attachment.url);
            const imageY = y + 4;

            if (!image) {
                const label = `[image: ${attachment.filename ?? "unavailable"}]`;
                operations.push(ctx => {
                    ctx.font = `italic 14px ${FONT_FAMILY}`;
                    ctx.fillStyle = COLORS.muted;
                    ctx.fillText(label, TEXT_X, imageY + 14);
                });
                y += 22;
                continue;
            }

            const { width, height } = fit(image, MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT);
            operations.push(ctx => drawRoundedImage(ctx, image, TEXT_X, imageY, width, height, 8));
            y += height + 8;
        }

        // Aperçus de liens
        for (const embed of message.embeds ?? []) {
            const layout = await layoutEmbed(embed, guildId, TEXT_WIDTH);
            if (!layout) continue;
            const embedY = y + 4;
            operations.push(ctx => layout.draw(ctx, TEXT_X, embedY));
            y += layout.height + 8;
        }

        y = Math.max(y, blockBottom);
        previous = message;
    }

    const height = y + PADDING;
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * SCALE;
    canvas.height = height * SCALE;

    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, WIDTH, height);
    ctx.textBaseline = "alphabetic";
    for (const draw of operations) draw(ctx);

    return canvas;
}

function drawAvatar(ctx, image, x, y) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + AVATAR_SIZE / 2, y + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    if (image) {
        ctx.drawImage(image, x, y, AVATAR_SIZE, AVATAR_SIZE);
    }
    else {
        ctx.fillStyle = COLORS.placeholder;
        ctx.fillRect(x, y, AVATAR_SIZE, AVATAR_SIZE);
    }
    ctx.restore();
}

function drawRoundedImage(ctx, image, x, y, width, height, radius) {
    ctx.save();
    roundedRect(ctx, x, y, width, height, radius);
    ctx.clip();
    ctx.drawImage(image, x, y, width, height);
    ctx.restore();
}

function roundedRect(ctx, x, y, width, height, radius) {
    radius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

// Réduit une image pour qu'elle tienne dans maxWidth x maxHeight sans la déformer
function fit(image, maxWidth, maxHeight) {
    const ratio = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    return { width: image.width * ratio, height: image.height * ratio };
}

// --- Aperçus de liens (embeds) ---

async function layoutEmbed(embed, guildId, maxWidth) {
    const width = Math.min(maxWidth, EMBED_MAX_WIDTH);
    const innerX = EMBED_BORDER + EMBED_PADDING;
    const innerWidth = width - innerX - EMBED_PADDING;

    // Vidéos, GIF et images : la miniature s'affiche en grand. Sinon, en petit à droite.
    const isMedia = ["video", "gifv", "image"].includes(embed.type);
    const largeImageData = embed.image ?? (isMedia ? embed.thumbnail : null);
    const smallThumbData = !isMedia && !embed.image ? embed.thumbnail : null;

    const smallThumb = smallThumbData ? await loadImage(mediaUrl(smallThumbData)) : null;
    const textWidth = innerWidth - (smallThumb ? EMBED_THUMBNAIL_SIZE + 16 : 0);

    const parts = [];
    let y = EMBED_PADDING;
    const addText = async (text, style, gap = 4) => {
        if (!text) return;
        const layout = await layoutContent(text, guildId, textWidth, style);
        if (!layout.height) return;
        if (parts.length) y += gap;
        const partY = y;
        parts.push((ctx, x, top) => layout.draw(ctx, x + innerX, top + partY));
        y += layout.height;
    };

    await addText(embed.provider?.name, { size: 12, lineHeight: 16, color: COLORS.muted });
    await addText(embed.author?.name, { size: 14, lineHeight: 18, bold: true, color: COLORS.header });
    await addText(embed.rawTitle ?? embed.title, {
        size: 16, lineHeight: 22, bold: true, color: embed.url ? COLORS.link : COLORS.header
    });
    await addText(embed.rawDescription ?? embed.description, { size: 14, lineHeight: 18 });
    for (const field of embed.fields ?? []) {
        await addText(field.rawName ?? field.name, { size: 14, lineHeight: 18, bold: true, color: COLORS.header }, 8);
        await addText(field.rawValue ?? field.value, { size: 14, lineHeight: 18 }, 2);
    }

    if (smallThumb) {
        const thumbY = EMBED_PADDING;
        const { width: w, height: h } = fit(smallThumb, EMBED_THUMBNAIL_SIZE, EMBED_THUMBNAIL_SIZE);
        parts.push((ctx, x, top) => drawRoundedImage(ctx, smallThumb, x + width - EMBED_PADDING - w, top + thumbY, w, h, 4));
        y = Math.max(y, thumbY + h);
    }

    if (largeImageData) {
        const image = await loadImage(mediaUrl(largeImageData));
        if (image) {
            if (parts.length) y += EMBED_GAP;
            const imageY = y;
            const { width: w, height: h } = fit(image, innerWidth, MAX_IMAGE_HEIGHT);
            parts.push((ctx, x, top) => drawRoundedImage(ctx, image, x + innerX, top + imageY, w, h, 4));
            y += h;
        }
    }

    await addText(embed.footer?.text, { size: 12, lineHeight: 16, color: COLORS.muted }, EMBED_GAP);

    if (!parts.length) return null;
    const height = y + EMBED_PADDING;
    const borderColor = embedColor(embed.color);

    return {
        height,
        draw: (ctx, x, top) => {
            ctx.fillStyle = COLORS.embedBackground;
            roundedRect(ctx, x, top, width, height, 4);
            ctx.fill();
            ctx.save();
            roundedRect(ctx, x, top, width, height, 4);
            ctx.clip();
            ctx.fillStyle = borderColor;
            ctx.fillRect(x, top, EMBED_BORDER, height);
            ctx.restore();
            for (const draw of parts) draw(ctx, x, top);
        }
    };
}

function mediaUrl(media) {
    return media?.proxyURL ?? media?.proxy_url ?? media?.url;
}

// La couleur d'un embed peut être un nombre (0xff0000) ou déjà une chaîne ("#ff0000")
function embedColor(color) {
    if (typeof color === "number") return `#${color.toString(16).padStart(6, "0")}`;
    if (typeof color === "string" && color) return color;
    return COLORS.embedBorder;
}

// --- Markdown : découpage en blocs ---

// Découpe le message en blocs : blocs de code, titres, sous-texte, listes, citations, paragraphes.
function parseBlocks(content) {
    const blocks = [];
    const parts = content.split(/```(?:[\w+-]*\n)?([\s\S]*?)```/);

    // split avec un groupe capturant : indices pairs = texte, impairs = contenu des blocs de code
    let quoteAll = false;
    parts.forEach((part, index) => {
        if (index % 2 === 1) {
            blocks.push({ type: "code", text: part.replace(/\n$/, "") });
            return;
        }

        // Retire le retour à la ligne collé aux blocs de code voisins
        let text = part;
        if (index > 0) text = text.replace(/^\n/, "");
        if (index < parts.length - 1) text = text.replace(/\n$/, "");
        if (!text && index > 0) return;

        for (let line of text.split("\n")) {
            if (!quoteAll && line.startsWith(">>> ")) {
                quoteAll = true;
                line = line.slice(4);
            }
            let quote = quoteAll;
            if (!quote && /^> /.test(line)) {
                quote = true;
                line = line.slice(2);
            }

            let match;
            if ((match = /^(#{1,3}) (.+)/.exec(line))) {
                blocks.push({ type: `h${match[1].length}`, quote, text: match[2] });
            }
            else if ((match = /^-# (.+)/.exec(line))) {
                blocks.push({ type: "subtext", quote, text: match[1] });
            }
            else if ((match = /^\s*[-*] (.+)/.exec(line))) {
                blocks.push({ type: "paragraph", quote, bullet: true, text: match[1] });
            }
            else {
                blocks.push({ type: "paragraph", quote, text: line });
            }
        }
    });

    return blocks;
}

// --- Markdown : mise en forme dans le texte ---

// Chaque règle reconnaît un élément au début du texte restant et renvoie des segments stylés,
// ou null pour laisser la main aux règles suivantes. L'ordre compte : *** avant **, etc.
const INLINE_RULES = [
    { re: /^\\([*_~`|\\<>#\-[\]():])/, parse: (m, style) => [{ ...style, text: m[1] }] },
    { re: /^`([^`]+)`/, parse: (m, style) => [{ ...style, text: m[1], code: true }] },
    { re: /^<(a?):(\w+):(\d+)>/, parse: (m, style) => [{ ...style, emoji: { url: getCustomEmojiUrl(m[3]), fallback: `:${m[2]}:` } }] },
    { re: /^:([\w+-]+):/, parse: (m, style) => shortcodeEmoji(m[1], style) },
    { re: /^<@!?(\d+)>/, parse: (m, style, guildId) => mentionSegment(style, m[0], userMention(m[1], guildId)) },
    { re: /^<@&(\d+)>/, parse: (m, style, guildId) => mentionSegment(style, m[0], roleMention(m[1], guildId)) },
    { re: /^<#(\d+)>/, parse: (m, style) => mentionSegment(style, m[0], channelMention(m[1])) },
    { re: /^@(everyone|here)\b/, parse: (m, style) => mentionSegment(style, m[0], m[0]) },
    { re: /^<t:(-?\d+)(?::\w)?>/, parse: (m, style) => [{ ...style, text: formatDate(Number(m[1]) * 1000), code: true }] },
    { re: /^<?https?:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)(?:\/(\d+))?>?/, parse: (m, style, guildId) => channelLink(m, style, guildId) },
    { re: /^\[([^\]]+)\]\(<?(https?:\/\/[^)\s>]+)>?\)/, parse: (m, style, guildId) => parseInline(m[1], { ...style, link: true }, guildId) },
    { re: /^<?(https?:\/\/[^\s<>]*[^\s<>.,:;"')\]])>?/, parse: (m, style) => [{ ...style, text: m[1], link: true }] },
    { re: /^\*\*\*([\s\S]+?)\*\*\*(?!\*)/, parse: (m, style, guildId) => parseInline(m[1], { ...style, bold: true, italic: true }, guildId) },
    { re: /^\*\*([\s\S]+?)\*\*(?!\*)/, parse: (m, style, guildId) => parseInline(m[1], { ...style, bold: true }, guildId) },
    { re: /^__([\s\S]+?)__(?!_)/, parse: (m, style, guildId) => parseInline(m[1], { ...style, underline: true }, guildId) },
    { re: /^\*(?!\s)([\s\S]*?[^\s*])\*(?!\*)/, parse: (m, style, guildId) => parseInline(m[1], { ...style, italic: true }, guildId) },
    { re: /^_([^_]+?)_(?!\w)/, notAfterWord: true, parse: (m, style, guildId) => parseInline(m[1], { ...style, italic: true }, guildId) },
    { re: /^~~([\s\S]+?)~~/, parse: (m, style, guildId) => parseInline(m[1], { ...style, strike: true }, guildId) },
    { re: /^\|\|([\s\S]+?)\|\|/, parse: (m, style, guildId) => parseInline(m[1], { ...style, spoiler: true }, guildId) }
];

// Caractères qui peuvent commencer une règle : évite de tester toutes les regex à chaque caractère
const RULE_STARTS = new Set(["\\", "`", "<", ":", "@", "[", "h", "*", "_", "~", "|"]);

function parseInline(text, style, guildId) {
    const segments = [];
    let plain = "";
    const flush = () => {
        if (plain) segments.push(...splitUnicodeEmojis(plain, style));
        plain = "";
    };

    let i = 0;
    outer: while (i < text.length) {
        if (RULE_STARTS.has(text[i])) {
            const rest = text.slice(i);
            for (const rule of INLINE_RULES) {
                if (rule.notAfterWord && i > 0 && /\w/.test(text[i - 1])) continue;
                const match = rule.re.exec(rest);
                if (!match) continue;
                const result = rule.parse(match, style, guildId);
                if (!result) continue;
                flush();
                segments.push(...result);
                i += match[0].length;
                continue outer;
            }
        }
        plain += text[i];
        i++;
    }
    flush();
    return segments;
}

// Sépare les emojis unicode du texte pour les dessiner avec les images de Discord
function splitUnicodeEmojis(text, style) {
    const segments = [];
    let last = 0;
    for (const match of text.matchAll(UNICODE_EMOJI_RE)) {
        const url = getUnicodeEmojiUrl(match[0]);
        if (!url) continue;
        if (match.index > last) segments.push({ ...style, text: text.slice(last, match.index) });
        segments.push({ ...style, emoji: { url, fallback: match[0] } });
        last = match.index + match[0].length;
    }
    if (last < text.length) segments.push({ ...style, text: text.slice(last) });
    return segments;
}

function shortcodeEmoji(name, style) {
    const emoji = getUnicodeEmojiByName(name);
    return emoji ? [{ ...style, emoji: { url: emoji.url, fallback: emoji.surrogates } }] : null;
}

function mentionSegment(style, raw, label) {
    return label ? [{ ...style, text: label, mention: true }] : [{ ...style, text: raw }];
}

function userMention(id, guildId) {
    const user = BdApi.Webpack.getStore("UserStore")?.getUser(id);
    return user ? `@${getDisplayName(user, guildId)}` : null;
}

function roleMention(id, guildId) {
    const role = BdApi.Webpack.getStore("GuildRoleStore")?.getRole?.(guildId, id)
        ?? BdApi.Webpack.getStore("GuildStore")?.getGuild(guildId)?.roles?.[id];
    return `@${role?.name ?? "role"}`;
}

function channelMention(id) {
    const channel = BdApi.Webpack.getStore("ChannelStore")?.getChannel(id);
    return channel ? `# ${channel.name}` : null;
}

// Lien vers un salon ou un message : affiché comme Discord, « Serveur › # salon › 💬 ».
// Le nom du serveur n'apparaît que si le lien pointe vers un autre serveur.
function channelLink(match, style, guildId) {
    const [, linkGuildId, channelId, messageId] = match;
    const channel = BdApi.Webpack.getStore("ChannelStore")?.getChannel(channelId);
    if (!channel?.name) return null;

    const guild = linkGuildId !== "@me" && linkGuildId !== guildId
        ? BdApi.Webpack.getStore("GuildStore")?.getGuild(linkGuildId)
        : null;
    let label = `${guild ? `${guild.name} › ` : ""}# ${channel.name}`;
    if (messageId) label += " › 💬";
    return [{ ...style, text: label, mention: true }];
}

// --- Markdown : mise en page ---

// Calcule la mise en page d'un texte. Renvoie sa hauteur et une fonction qui le dessine.
// paragraphStyle remplace le style des paragraphes (utilisé pour les embeds).
async function layoutContent(content, guildId, maxWidth, paragraphStyle = {}) {
    if (!content?.trim()) return { height: 0, draw: () => {} };

    const blocks = parseBlocks(content);
    for (const block of blocks) {
        if (block.type !== "code") block.segments = parseInline(block.text, {}, guildId);
    }

    // On charge les images des emojis avant la mise en page
    const emojiImages = new Map();
    const urls = new Set(blocks.flatMap(b => b.segments ?? []).filter(s => s.emoji).map(s => s.emoji.url));
    await Promise.all([...urls].map(async url => emojiImages.set(url, await loadImage(url))));

    const jumbo = !paragraphStyle.size && isJumbo(blocks);
    const measure = document.createElement("canvas").getContext("2d");
    const operations = [];
    let y = 0;

    blocks.forEach((block, index) => {
        if (block.type === "code") {
            const result = layoutCodeBlock(measure, block.text, maxWidth, y);
            operations.push(result.draw);
            y += result.height;
            return;
        }

        const base = { ...BLOCK_STYLES[block.type], ...(block.type === "paragraph" ? paragraphStyle : {}) };
        if (jumbo) base.lineHeight = JUMBO_EMOJI_SIZE + 4;
        if (index > 0) y += base.marginTop;

        let indent = 0;
        if (block.quote) indent += QUOTE_INDENT;
        const bulletX = indent;
        if (block.bullet) indent += BULLET_INDENT;

        const emojiSize = jumbo ? JUMBO_EMOJI_SIZE : Math.round(base.size * 1.375);
        const atoms = toAtoms(measure, block.segments, base, emojiSize, jumbo);
        const lines = wrapAtoms(measure, atoms, maxWidth - indent, base);
        if (!lines.length) lines.push([]);

        const blockY = y;
        const blockHeight = lines.length * base.lineHeight;
        operations.push((ctx, x, top) => {
            if (block.quote) {
                ctx.fillStyle = COLORS.quoteBar;
                roundedRect(ctx, x, top + blockY, 4, blockHeight, 2);
                ctx.fill();
            }
            if (block.bullet) {
                ctx.font = font(base, {});
                ctx.fillStyle = base.color;
                ctx.fillText("•", x + bulletX + 4, top + blockY + baseline(base));
            }
            lines.forEach((line, i) => drawLine(ctx, line, x + indent, top + blockY + i * base.lineHeight, base, emojiImages));
        });
        y += blockHeight;
    });

    return {
        height: y,
        draw: (ctx, x, top) => operations.forEach(draw => draw(ctx, x, top))
    };
}

// Un message composé uniquement d'emojis (30 max) s'affiche en grand, comme dans Discord
function isJumbo(blocks) {
    if (blocks.length !== 1 || blocks[0].type !== "paragraph" || blocks[0].quote || blocks[0].bullet) return false;
    let count = 0;
    for (const segment of blocks[0].segments) {
        if (segment.emoji) {
            count++;
            continue;
        }
        if (segment.code || segment.mention || segment.link) return false;
        const text = segment.text.replace(/\s/g, "");
        if (!text) continue;
        if (!/^(\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️)+$/u.test(text)) return false;
        count += [...text.matchAll(/\p{Extended_Pictographic}|\p{Regional_Indicator}{2}/gu)].length;
    }
    return count > 0 && count <= JUMBO_MAX_EMOJIS;
}

// Découpe les segments en "atomes" (mots, espaces, emojis) mesurés, pour le retour à la ligne
function toAtoms(measure, segments, base, emojiSize, jumbo) {
    const atoms = [];
    for (const segment of segments) {
        if (segment.emoji) {
            atoms.push({ segment, emoji: true, width: emojiSize });
            continue;
        }
        for (const part of segment.text.split(/(\s+)/)) {
            if (!part) continue;
            measure.font = font(base, segment, jumbo);
            atoms.push({ segment, text: part, space: /^\s+$/.test(part), width: measure.measureText(part).width });
        }
    }
    return atoms;
}

function wrapAtoms(measure, atoms, maxWidth, base) {
    const lines = [];
    let line = [];
    let width = 0;

    for (let atom of atoms) {
        if (atom.space && !line.length) continue;
        if (width + atom.width <= maxWidth || atom.space) {
            line.push(atom);
            width += atom.width;
            continue;
        }

        if (line.length) lines.push(line);
        line = [];
        width = 0;

        // Mot plus large que la ligne (lien...) : coupé caractère par caractère
        if (!atom.emoji && atom.width > maxWidth) {
            measure.font = font(base, atom.segment);
            let chunk = "";
            for (const char of atom.text) {
                if (chunk && measure.measureText(chunk + char).width > maxWidth) {
                    lines.push([{ ...atom, text: chunk, width: measure.measureText(chunk).width }]);
                    chunk = "";
                }
                chunk += char;
            }
            atom = { ...atom, text: chunk, width: measure.measureText(chunk).width };
        }

        line.push(atom);
        width = atom.width;
    }

    if (line.length) lines.push(line);
    return lines;
}

function drawLine(ctx, atoms, x, top, base, emojiImages) {
    const textBaseline = top + baseline(base);

    for (const atom of atoms) {
        const { segment, width } = atom;

        if (atom.emoji) {
            const image = emojiImages.get(segment.emoji.url);
            if (image) {
                ctx.drawImage(image, x, top + (base.lineHeight - width) / 2, width, width);
            }
            else {
                ctx.font = font(base, segment);
                ctx.fillStyle = base.color;
                ctx.fillText(segment.emoji.fallback, x, textBaseline);
            }
            x += width;
            continue;
        }

        // Fonds : code, mention, spoiler
        const background = segment.spoiler ? COLORS.spoiler
            : segment.code ? COLORS.codeBackground
            : segment.mention ? COLORS.mentionBackground
            : null;
        if (background) {
            ctx.fillStyle = background;
            ctx.fillRect(x, top + 1, width, base.lineHeight - 2);
        }

        if (!segment.spoiler) {
            ctx.font = font(base, segment);
            ctx.fillStyle = segment.mention ? COLORS.mention : segment.link ? COLORS.link : base.color;
            ctx.fillText(atom.text, x, textBaseline);

            if (segment.underline || segment.link) {
                ctx.fillRect(x, textBaseline + 2, width, 1);
            }
            if (segment.strike) {
                ctx.fillRect(x, textBaseline - base.size * 0.3, width, 1.5);
            }
        }

        x += width;
    }
}

function layoutCodeBlock(measure, text, maxWidth, y) {
    measure.font = `${CODE_BLOCK_FONT_SIZE}px ${CODE_FONT_FAMILY}`;
    const innerWidth = maxWidth - CODE_BLOCK_PADDING * 2;

    const lines = [];
    for (const rawLine of text.split("\n")) {
        let line = "";
        for (const char of rawLine) {
            if (line && measure.measureText(line + char).width > innerWidth) {
                lines.push(line);
                line = "";
            }
            line += char;
        }
        lines.push(line);
    }

    const top = y + 4;
    const height = lines.length * CODE_BLOCK_LINE_HEIGHT + CODE_BLOCK_PADDING * 2;
    return {
        height: height + 8,
        draw: (ctx, x, offset) => {
            ctx.fillStyle = COLORS.codeBackground;
            roundedRect(ctx, x, offset + top, maxWidth, height, 4);
            ctx.fill();
            ctx.strokeStyle = COLORS.codeBorder;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.font = `${CODE_BLOCK_FONT_SIZE}px ${CODE_FONT_FAMILY}`;
            ctx.fillStyle = COLORS.text;
            lines.forEach((line, i) => {
                const lineTop = offset + top + CODE_BLOCK_PADDING + i * CODE_BLOCK_LINE_HEIGHT;
                ctx.fillText(line, x + CODE_BLOCK_PADDING, lineTop + 14);
            });
        }
    };
}

function font(base, segment, jumbo = false) {
    if (segment.code) return `${Math.round(base.size * 0.85)}px ${CODE_FONT_FAMILY}`;
    const size = jumbo ? JUMBO_EMOJI_SIZE - 4 : base.size;
    const weight = segment.bold || base.bold ? 700 : 400;
    return `${segment.italic ? "italic " : ""}${weight} ${size}px ${FONT_FAMILY}`;
}

// Position de la ligne de base du texte pour qu'il soit centré verticalement dans la ligne
function baseline(base) {
    return Math.round(base.lineHeight / 2 + base.size * 0.35);
}

// --- Emojis ---

let unicodeEmojis = null;

// Module interne de Discord qui contient tous les emojis unicode, et index surrogate -> image
function getUnicodeEmojis() {
    if (unicodeEmojis) return unicodeEmojis;

    const filter = m => typeof m?.getByCategory === "function" && typeof m?.getByName === "function";
    const module = BdApi.Webpack.getModule(filter) ?? BdApi.Webpack.getModule(filter, { searchExports: true });

    const bySurrogate = new Map();
    const add = emoji => {
        const url = emojiImageUrl(emoji);
        if (emoji?.surrogates && url) bySurrogate.set(emoji.surrogates, url);
    };
    for (const category of EMOJI_CATEGORIES) {
        let list;
        try { list = module?.getByCategory(category); } catch { list = null; }
        for (const emoji of list ?? []) {
            add(emoji);
            for (const child of Object.values(emoji.diversityChildren ?? {})) add(child);
        }
    }

    unicodeEmojis = { module, bySurrogate };
    return unicodeEmojis;
}

function emojiImageUrl(emoji) {
    try {
        return emoji?.url ?? null;
    }
    catch {
        return null;
    }
}

function getUnicodeEmojiUrl(surrogates) {
    const { bySurrogate } = getUnicodeEmojis();
    return bySurrogate.get(surrogates)
        ?? bySurrogate.get(surrogates.replace(/️/g, ""))
        ?? bySurrogate.get(`${surrogates}️`)
        ?? null;
}

function getUnicodeEmojiByName(name) {
    let emoji;
    try { emoji = getUnicodeEmojis().module?.getByName(name); } catch { emoji = null; }
    const url = emojiImageUrl(emoji);
    return emoji?.surrogates && url ? { surrogates: emoji.surrogates, url } : null;
}

// Les emojis animés existent aussi en .png (première image), ce qui suffit pour une capture
function getCustomEmojiUrl(id) {
    return `https://cdn.discordapp.com/emojis/${id}.png?size=96`;
}

// --- Données Discord ---

function getMember(guildId, userId) {
    if (!guildId || !userId) return null;
    return BdApi.Webpack.getStore("GuildMemberStore")?.getMember(guildId, userId);
}

function getDisplayName(user, guildId) {
    return getMember(guildId, user?.id)?.nick
        ?? user?.globalName
        ?? user?.global_name
        ?? user?.username
        ?? "Unknown";
}

// Couleur du style de pseudo (Nitro) si défini, sinon couleur du rôle
function getNameColor(user, guildId) {
    const styles = user?.displayNameStyles ?? user?.display_name_styles;
    const color = styles?.colors?.[0];
    if (typeof color === "number") return `#${color.toString(16).padStart(6, "0")}`;
    return getMember(guildId, user?.id)?.colorString ?? COLORS.name;
}

// Tag de serveur affiché à côté du pseudo (ex : « ISLA »)
function getGuildTag(user) {
    const primaryGuild = user?.primaryGuild ?? user?.primary_guild;
    if (primaryGuild && primaryGuild.identityEnabled === false) return null;
    return primaryGuild?.tag ?? user?.clan?.tag ?? null;
}

// Avatar du serveur s'il existe, sinon avatar du compte
function getAvatarUrl(user, guildId) {
    if (!user?.id) return DEFAULT_AVATAR;
    const member = getMember(guildId, user.id);
    if (member?.avatar) return `https://cdn.discordapp.com/guilds/${guildId}/users/${user.id}/avatars/${member.avatar}.png?size=128`;
    if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    try {
        return user.getAvatarURL?.(guildId, 128, false) ?? DEFAULT_AVATAR;
    }
    catch {
        return DEFAULT_AVATAR;
    }
}

function getTime(message) {
    return new Date(+message.timestamp || Date.now()).getTime();
}

function formatDate(time) {
    const date = new Date(time);
    const day = date.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
    const hour = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${day} ${hour}`;
}

function isImage(attachment) {
    if (attachment.content_type) return attachment.content_type.startsWith("image/");
    return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(attachment.url ?? "");
}

// --- Utilitaires ---

const imageCache = new Map();

// crossOrigin est nécessaire pour pouvoir exporter le canvas ensuite. Si l'image refuse
// le CORS, elle ne se charge pas (au lieu de bloquer l'export) et on affiche un remplaçant.
function loadImage(url) {
    if (!url) return Promise.resolve(null);
    if (!imageCache.has(url)) {
        imageCache.set(url, new Promise(resolve => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => resolve(image);
            image.onerror = () => {
                imageCache.delete(url);
                resolve(null);
            };
            image.src = url;
        }));
    }
    return imageCache.get(url);
}

async function copyCanvas(canvas) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Canvas export failed");

    try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    }
    catch (error) {
        // Repli sur le presse-papiers natif de l'application Discord
        const copyImage = window.DiscordNative?.clipboard?.copyImage;
        if (!copyImage) throw error;
        copyImage(new Uint8Array(await blob.arrayBuffer()), "message.png");
    }
}
