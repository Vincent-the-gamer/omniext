import { browser } from '#imports';

/**
 * 界面上展示的应用信息。
 *
 * Chrome MV3 不再支持字符串形式的 manifest.author（只接受 `{ email }`），
 * 所以作者名放在这里，改这一行即可。
 */
export const APP_AUTHOR = 'Vincent-the-gamer';

/** 仓库主页链接，界面里的插件名点过去就是这里。 */
export const APP_REPO_URL = 'https://github.com/Vincent-the-gamer/omniext';

const manifest = browser.runtime.getManifest() as {
  version: string;
  version_name?: string;
};

/**
 * 版本号始终读 manifest，和 package.json 保持一致。
 *
 * manifest.version 只允许纯数字，`0.1.1-alpha.1` 这样的预发布标记会被构建器
 * 挪到 version_name；Firefox 不写 version_name，所以回退到 version。
 * 仅用于展示，不要拿它做版本比较。
 */
export const APP_VERSION = manifest.version_name ?? manifest.version;
