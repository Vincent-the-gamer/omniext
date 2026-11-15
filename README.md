# Omniext

Omnipotent browser extension.

> [!WARNING]
> This repo is under construction.

## Abilities

- Unlock any copy limitation.
- Block WebRTC, so a site cannot read your real or local IP address.

and soon...

## WebRTC protection

`Block WebRTC leak` uses the same mechanism as Google's *WebRTC Network Limiter*:
Chrome's built-in `webRTCIPHandlingPolicy`, which decides which network addresses
WebRTC is allowed to use. While the switch is on you pick one of four modes:

| Mode | Effect |
| --- | --- |
| No restriction | Browser default — WebRTC behaves normally. |
| Default public + private interfaces | WebRTC uses the default public address plus local addresses. |
| Public IP only | Only the default public interface is used; LAN addresses stay hidden. |
| Proxy only (default) | WebRTC UDP is disabled unless it goes through a proxy, so a leak test finds no WebRTC IP at all. |

The policy is browser-wide — it applies to every tab, not just the domains in your
rules, so this feature has no domain rules. Turning the switch off restores the
browser default.

The strictest mode also breaks WebRTC apps such as Meet, Zoom or Discord — choose
"Public IP only" or turn the switch off when you need them.

## Preview

![preview](preview/preview.png)

## License

[MIT](./LICENSE)
