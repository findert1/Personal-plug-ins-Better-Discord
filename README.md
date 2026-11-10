# Personnal Plugins

Personal [BetterDiscord](https://betterdiscord.app) plugins by findert.

| Plugin | Description |
| --- | --- |
| [StatusRotator](StatusRotator.plugin.js) | Rotates between multiple custom statuses at a set interval, and hides the status while playing, listening or streaming. |
| [TextExpander](TextExpander.plugin.js) | Define your own commands (like `;gg`) that get replaced by full sentences when you send a message, with an optional preview. |
| [TextExpanderEnhanced](TextExpanderEnhanced.plugin.js) | Message templates with blanks to fill in: type a command, fill in a small form with a live preview, and the finished message is put in your message bar. |
| [MessageScreenshot](MessageScreenshot.plugin.js) | Right-click a message to copy it (or the last few messages) to your clipboard as a clean image. |
| [ChannelGrid](ChannelGrid.plugin.js) | Replaces the long server channel list with a cleaner grid of channel tiles grouped by category. |
| [ServerFeed](ServerFeed.plugin.js) | A Twitter-like feed of every unread message in the server, with context, so you can catch up without opening each channel. |
| [SideChats](SideChats.plugin.js) | Open other chats (any server channel, DM or group) live next to the main view, like split screens, and talk in them. |
| [EnglishFixer](EnglishFixer.plugin.js) | Press a shortcut to preview your message with its English typos and mistakes fixed, then accept or skip the corrections. |
| [FrenchFixer](FrenchFixer.plugin.js) | The same as EnglishFixer, for French: preview your message with its typos, missing accents and grammar mistakes fixed. |
| [AutoRename](AutoRename.plugin.js) | Automatically renames the files you upload (`IMG_2034.jpg`, `image.png`...) using a pattern with the date, channel, server and more. |
| [HelloWorld](HelloWorld.plugin.js) | Minimal example plugin that shows a "Hello World" toast. |

## StatusRotator

- Set up as many custom statuses as you want, each with an emoji (picked from a real emoji picker), a text and an optional presence (Online, Idle, Do Not Disturb, Invisible).
- With Nitro, the emoji picker also has your servers' custom emojis (animated ones too), like Discord's own status picker. Without Nitro they aren't offered, and a status that already has one is set without it.
- The statuses rotate automatically at the interval of your choice (15 seconds minimum).
- While you're playing a game, listening to music or streaming, the rotation pauses and your custom status is hidden. It resumes when the activity ends.
- A "Skip to next" button jumps to the next status right away.
- Your original status is restored when the plugin is turned off.

## TextExpander

- Define your own commands in the settings (for example `;gg` → "GG, well played! See you next time 👋").
- A command is replaced only when it's typed as a separate word, so it never breaks other words. Longer commands take priority over shorter ones.
- Works when sending and when editing a message.
- Preview, chosen in the settings:
  - **No preview** (default): commands are replaced when you send, like before.
  - **While typing**: as soon as your message contains a command, a preview above the message bar shows it as it will be sent, with the replaced parts highlighted.
  - **Before sending**: pressing Enter shows the preview first. Press Enter again to send, or Esc (or keep typing) to go back to editing.
- Nothing leaves your computer: the preview is built locally, and the replacement itself happens when the message is sent or edited.

## TextExpanderEnhanced

- Prepare message templates with blanks, like a skeleton to complete (event announcements, bug reports, welcome messages...).
- Type a template's command (for example `;event`) at the end of your message and press **Tab** or **Enter**, or pick a template with the button in the message bar. A form opens with one box per blank and a live preview, then the finished message is put in your message bar so you can check it before sending.
- Put a blank between braces wherever you want to fill something in: `{Title}`, `{Date}`, `{Who's coming}`... Each blank becomes a free text box in the form. The same blank used twice is filled in once.
- Works alongside TextExpander: TextExpander is for instant replacements, TextExpanderEnhanced for messages you complete each time.

## MessageScreenshot

- Right-click a message → **Copy as image** to copy it to the clipboard as an image, ready to paste anywhere.
- The submenu can also copy the last 3, 5 or 10 messages up to the one you clicked.
- The image looks like Discord: avatars, name colors, server tags, dates, and consecutive messages grouped like in the chat.
- Supports Markdown (bold, italic, underline, strikethrough, spoilers, headers, quotes, lists, code blocks), emojis (including custom ones), mentions, channel links, timestamps, image attachments and embeds.

## ChannelGrid

- Text channels are shown as tiles, grouped by category. Click a category name to fold it.
- The threads you've joined are listed inside their channel's tile, with their unread state and mentions, like in Discord's list. The thread you're reading is shown too.
- Voice channels are full-width cards listing who is connected, with their server tag, speaking rings, mute/deafen/camera/live indicators and the game they are playing. Click a member to open their profile card, or hover someone who is live and click **Watch** to open their stream.
- Voice channel statuses are shown under the channel name. In the voice channel you're connected to, click the status (or **Set a channel status**) to change it, if the server lets you.
- The server's boost goal and Discord's shortcuts (Browse Channels, Events, Members...) are shown at the top of the grid.
- Unread channels are highlighted, mentions get a red badge, and "New unreads" / "New mentions" buttons jump to unread channels outside the view. Discord's own unread bar is hidden so they don't overlap.
- Right-click a channel or a voice member to get Discord's usual context menu, even in categories folded in the normal list.
- Works with server banners: the grid starts right under the banner.
- Hidden channels added by ShowHiddenChannels appear with a lock icon.
- A Grid / List switch at the top brings back Discord's normal list at any time.
- Settings: hide muted channels, show or hide voice members.

## ServerFeed

- Click **☰ Feed** at the top right of the chat (or press Ctrl+Shift+F) to see all the unread messages of the current server in one feed.
- One card per channel, with the last few read messages greyed out above a "New" line for context, and "10 min later"-style separators when the conversation pauses.
- **More context** loads older messages, **Jump to first unread** opens the channel at the right place, and clicking any message jumps to it.
- **Mark read** marks the channel as read and removes its card; **Mark all read** clears the whole feed. **Refresh** reloads everything.
- New messages appear live without moving the cards around; a channel you already marked read comes back at the bottom.
- Write in a channel or reply to a message (hover it → **Reply**) straight from its card, with an emoji button, @mention suggestions (members, roles, @everyone, @here) and #channel suggestions. TextExpander commands still work.
- Names, avatars and name colors are the ones from the server profile, like in the chat. Click a mention to open the profile.
- Messages that mention you (directly, through one of your roles, or with @everyone/@here) are highlighted like in Discord, and their channels come first with a red **@** badge.
- Edit your own messages from the feed (hover → **Edit**, or press ↑ in an empty message box).
- Stickers are shown as images.
- Add or remove reactions (hover a message → **☺ +**, or click an existing reaction). The emoji picker has recent emojis, every server's custom emojis (with Nitro) and a search.
- Messages are shown with Discord's Markdown: bold, italic, underline, strikethrough, spoilers, code, headers, quotes, lists, masked links and timestamps.
- Click an image to open it full size, with arrows when a message has several. GIFs play like in Discord and videos have a player.
- Role mentions show the role's name and color. Channel mentions and copied channel or message links show as **#channel** (with a 💬 for a message) and open it when clicked.
- Muted channels (and channels in muted categories) are left out. Settings: hide messages from bots, ignore muted channels (on by default).

## SideChats

- Click **⧉ Chats** at the top right of the channel (next to ServerFeed's Feed button) and pick any chat: a channel of any server, a DM or a private group. It opens live on the right of the main view, which stays fully usable.
- Open as many as you want. Each one shows the conversation in real time, with typing indicators and a "new messages" button when you've scrolled up.
- Write, reply, edit your messages (↑ in an empty box), delete them (🗑, Shift+click to skip the confirmation), forward any message to another chat (↱, with an optional message), react, use emojis, @mentions and #channels, send GIFs (favorites, trending and search), and upload files with **+**, by pasting an image or by dropping a file on the chat. TextExpander commands and EnglishFixer still work.
- Drag the left edge of a chat to resize it, fold it into a thin strip (with an unread counter) with **–**, open it in the main view with **↗**, or close it with **✕**.
- Choose the layout at the bottom of the chat list: **Side by side**, **Stacked**, or **Grid** (columns of 2, 3 or 4 stacked chats, e.g. 4 chats in 2 rows and 2 columns).
- Right-click a channel, a group or a person → **Open in Side Chat**.
- Your chats and their sizes are restored when Discord restarts. Settings: mark side chats as read while you watch them, show others when you're typing (never with InvisibleTyping on).

## EnglishFixer

- While writing a message, press **Ctrl+Shift+G** (configurable) or click the button on the right of the message bar to check your English with [LanguageTool](https://languagetool.org).
- A preview shows your message with each fix highlighted. Press **Enter** to swap your text for the corrected one, or **Esc** to keep it as is.
- Click a fix to try the other suggestions or to skip it.
- Mentions, emojis, links and code are never touched, and names are left alone. Add your own words (slang, nicknames...) to the list of words that are never corrected.
- Works in Discord's message box and in other plugins' text boxes, like ServerFeed's.
- Settings: shortcut, show or hide the button, US or UK English, punctuation, capitalization and style fixes.
- Your message is only sent to LanguageTool when you press the shortcut.

## FrenchFixer

- Works like EnglishFixer, for messages written in French. Press **Ctrl+Shift+O** (configurable) or click the **FR** button on the right of the message bar.
- Fixes typos, missing accents ("deja" → "déjà"), agreement and conjugation ("j'ai manger" → "j'ai mangé", "qu'il vient" → "qu'il vienne"), homophones and commas.
- Leaves chat French alone by default: "je sais pas" stays as is, and French typography (space before ? ! : ;, curly apostrophes, « ») isn't forced. Both can be turned on in the settings.
- Common abbreviations (mdr, tkt, jsp, stp...) are never corrected, and you can add your own.
- Can be turned on at the same time as EnglishFixer, with a different shortcut and button.
- Settings: shortcut, show or hide the button, French variant (France, Canada, Belgium, Switzerland), punctuation, capitalization, style (pleonasms like "monter en haut"), negations and typography.

## AutoRename

- Every file you add to a message (with the + button, drag and drop or paste) is renamed before it is sent, following a pattern you choose. The extension is kept.
- Default pattern: `{channel}_{date}_{time}`, so `IMG_2034.JPG` becomes `general_2026-11-10_14-32-05.jpg`.
- Keywords: `{name}` (original name), `{date}`, `{time}`, `{timestamp}`, `{channel}` (the person's name in DMs), `{server}`, `{user}`, `{n}` (file number when sending several) and `{random}`. Click a keyword in the settings to add it, with a live example.
- By default only generic names are renamed (`IMG_1234`, `image.png`, `Screenshot...`, `PXL_...`, pasted images): files you named yourself are left alone. This can be turned off.
- Names are cleaned by default (spaces become `_`, accents and emojis removed). Two files of the same upload never get the same name, and spoiler files stay spoilers.

## HelloWorld

- Shows a "Hello World" toast when the plugin is turned on and off. Useful as a starting point for a new plugin.

## Installation

Copy the `.plugin.js` file into `%AppData%\BetterDiscord\plugins\`, then enable it in Discord's settings → BetterDiscord → Plugins.
