# Personnal Plugins

Personal [BetterDiscord](https://betterdiscord.app) plugins by findert.

| Plugin | Description |
| --- | --- |
| [StatusRotator](StatusRotator.plugin.js) | Rotates between multiple custom statuses at a set interval, and hides the status while playing, listening or streaming. |
| [TextExpander](TextExpander.plugin.js) | Define your own commands (like `;gg`) that get replaced by full sentences when you send a message. |
| [MessageScreenshot](MessageScreenshot.plugin.js) | Right-click a message to copy it (or the last few messages) to your clipboard as a clean image. |
| [ChannelGrid](ChannelGrid.plugin.js) | Replaces the long server channel list with a cleaner grid of channel tiles grouped by category. |
| [HelloWorld](HelloWorld.plugin.js) | Minimal example plugin that shows a "Hello World" toast. |

## ChannelGrid

- Text channels are shown as tiles, grouped by category. Click a category name to fold it.
- Voice channels are full-width cards listing who is connected, with speaking rings, mute/deafen/camera/live indicators and the game they are playing. Click a member to open their profile.
- Unread channels are highlighted, mentions get a red badge, and "New unreads" / "New mentions" buttons jump to unread channels outside the view.
- Right-click a channel or a voice member to get Discord's usual context menu.
- A Grid / List switch at the top brings back Discord's normal list at any time.
- Settings: hide muted channels, show or hide voice members.

## Installation

Copy the `.plugin.js` file into `%AppData%\BetterDiscord\plugins\`, then enable it in Discord's settings → BetterDiscord → Plugins.
