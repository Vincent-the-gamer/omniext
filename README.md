# Omniext

Omnipotent browser extension.

> [!WARNING]
> This repo is under construction.

## Abilities

- Unlock any copy limitation.
- Limit WebRTC's network paths, so a site cannot read your real or local IP address.

and soon...

## WebRTC protection

`WebRTC Network Limiter` is a straight copy of Google's extension of the same
name: it only changes Chrome's built-in `webRTCIPHandlingPolicy`, the setting that
decides which network addresses WebRTC is allowed to use. Pick one of the four
modes, exactly as the original does:

| Mode | Effect |
| --- | --- |
| Give me the best media experience | Browser default — Chrome explores every network path, so leak tests still see your real and local IP. |
| Use my default public and private IP addresses | Media follows the same path as normal web traffic (plus the default private address behind a NAT). |
| Use only my default public IP address | Same as above, but the private default address is not used — LAN addresses stay hidden. |
| Use my proxy server (if present) | Media always goes through the proxy; with no proxy WebRTC has no network path at all. This is the strictest mode and stops the leak. |

The policy is browser-wide — it applies to every tab, not just the domains in your
rules, so this feature has no domain rules. Turning the switch off restores the
browser default, so nothing is left behind.

The strict modes also break WebRTC apps such as Meet, Zoom or Discord. The panel
shows the value Chrome actually reports, so you can confirm the change landed.

## Preview

![preview](preview/preview.png)

## License

[MIT](./LICENSE)
