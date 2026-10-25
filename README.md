# Personnal Plugins

Personal [BetterDiscord](https://betterdiscord.app) plugins by findert.

| Plugin | Description |
| --- | --- |
| [StatusRotator](StatusRotator.plugin.js) | Rotates between multiple custom statuses at a set interval, and hides the status while playing, listening or streaming. |
| [TextExpander](TextExpander.plugin.js) | Define your own commands (like `;gg`) that get replaced by full sentences when you send a message. |
| [MessageScreenshot](MessageScreenshot.plugin.js) | Right-click a message to copy it (or the last few messages) to your clipboard as a clean image. |
| [ChannelGrid](ChannelGrid.plugin.js) | Replaces the long server channel list with a cleaner grid of channel tiles grouped by category. |
| [ServerFeed](ServerFeed.plugin.js) | A Twitter-like feed of every unread message in the server, with context, so you can catch up without opening each channel. |
| [HelloWorld](HelloWorld.plugin.js) | Minimal example plugin that shows a "Hello World" toast. |

## StatusRotator

- Set up as many custom statuses as you want, each with an emoji (picked from a real emoji picker), a text and an optional presence (Online, Idle, Do Not Disturb, Invisible).
- The statuses rotate automatically at the interval of your choice (15 seconds minimum).
- While you're playing a game, listening to music or streaming, the rotation pauses and your custom status is hidden. It resumes when the activity ends.
- A "Skip to next" button jumps to the next status right away.
- Your original status is restored when the plugin is turned off.

## TextExpander

- Define your own commands in the settings (for example `;gg` → "GG, well played! See you next time 👋").
- A command is replaced only when it's typed as a separate word, so it never breaks other words. Longer commands take priority over shorter ones.
- Works when sending and when editing a message.
- It doesn't read what you type: the replacement only happens at the moment the message is sent or edited.

## MessageScreenshot

- Right-click a message → **Copy as image** to copy it to the clipboard as an image, ready to paste anywhere.
- The submenu can also copy the last 3, 5 or 10 messages up to the one you clicked.
- The image looks like Discord: avatars, name colors, server tags, dates, and consecutive messages grouped like in the chat.
- Supports Markdown (bold, italic, underline, strikethrough, spoilers, headers, quotes, lists, code blocks), emojis (including custom ones), mentions, channel links, timestamps, image attachments and embeds.

## ChannelGrid

- Text channels are shown as tiles, grouped by category. Click a category name to fold it.
- Voice channels are full-width cards listing who is connected, with their server tag, speaking rings, mute/deafen/camera/live indicators and the game they are playing. Click a member to open their profile card, or hover someone who is live and click **Watch** to open their stream.
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
- Write in a channel or reply to a message (hover it → **Reply**) straight from its card, with an emoji button and @mention suggestions (members, roles, @everyone, @here). TextExpander commands still work.
- Names, avatars and name colors are the ones from the server profile, like in the chat. Click a mention to open the profile.
- Add or remove reactions (hover a message → **☺ +**, or click an existing reaction). The emoji picker has recent emojis, every server's custom emojis (with Nitro) and a search.
- Messages are shown with Discord's Markdown: bold, italic, underline, strikethrough, spoilers, code, headers, quotes, lists, masked links and timestamps.
- Click an image to open it full size, with arrows when a message has several. GIFs play like in Discord and videos have a player.
- Role mentions show the role's name and color.
- Muted channels (and channels in muted categories) are left out. Settings: hide messages from bots, ignore muted channels (on by default).

## HelloWorld

- Shows a "Hello World" toast when the plugin is turned on and off. Useful as a starting point for a new plugin.

## Installation

Copy the `.plugin.js` file into `%AppData%\BetterDiscord\plugins\`, then enable it in Discord's settings → BetterDiscord → Plugins.
