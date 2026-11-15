import { browser } from '#imports';

/**
 * 界面上展示的应用信息。
 *
 * Chrome MV3 不再支持字符串形式的 manifest.author（只接受 `{ email }`），
 * 所以作者名放在这里，改这一行即可。
 */
export const APP_AUTHOR = 'Vincent-the-gamer';

/** 版本号始终读 manifest，和 package.json 保持一致。 */
export const APP_VERSION = browser.runtime.getManifest().version;
