# Omniext

Omnipotent browser extension.

> [!WARNING]
> This repo is under construction.

## Abilities

- Unlock any copy limitation.
- Disable WebRTC entirely, so a site cannot read your real or local IP address.

and soon...

## WebRTC protection

`Disable WebRTC` blocks WebRTC on two levels, so nothing leaks:

1. **Page level** — before a site's own scripts run, the content script removes
   `RTCPeerConnection`, `RTCSessionDescription`, `MediaStreamTrack`, `MediaStream`,
   `RTCDataChannel`, `getUserMedia` and `navigator.mediaDevices` from the page (in
   every frame). A site cannot open a WebRTC connection, and video/audio capture
   through WebRTC is gone too.
2. **Browser level** — Chrome's `webRTCIPHandlingPolicy`, the same mechanism as
   Google's *WebRTC Network Limiter*, is tightened. This covers what the page
   patch cannot reach, such as Web Workers and other tabs. While the switch is on
   you pick one of four modes:

| Mode | Effect |
| --- | --- |
| No restriction | Browser default — WebRTC behaves normally. |
| Default public + private interfaces | WebRTC uses the default public address plus local addresses. |
| Public IP only | Only the default public interface is used; LAN addresses stay hidden. |
| Proxy only (default) | WebRTC UDP is disabled unless it goes through a proxy, so a leak test finds no WebRTC IP at all. |

The browser-level policy is browser-wide — it applies to every tab, not just the
domains in your rules, so this feature has no domain rules. Turning the switch off
restores both the page APIs and the browser default.

Disabling WebRTC also breaks WebRTC apps such as Meet, Zoom or Discord — turn the
switch off when you need them.

## Preview

![preview](preview/preview.png)

## License

[MIT](./LICENSE)
