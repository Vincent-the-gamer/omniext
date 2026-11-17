import type { FeatureDefinition } from '@/features/types';
import { createGitHubFolderDownloadRuntime } from './runtime';

const githubFolderDownload: FeatureDefinition = {
  id: 'github-folder-download',
  name: {
    en: 'GitHub folder download',
    zh: 'GitHub 文件夹下载',
  },
  icon: '📥',
  description: {
    en: 'Adds a floating button on GitHub repository pages that downloads the folder you are currently viewing as a ZIP archive.',
    zh: '在 GitHub 仓库页面加一个浮动按钮，把当前正在浏览的文件夹下载为 ZIP 压缩包。',
  },
  details: [
    {
      en: 'Only appears inside a repository folder view (a `/tree/…` URL); repository home pages and single-file views are left alone.',
      zh: '只在仓库的文件夹视图（`/tree/…` 地址）出现；仓库主页与单文件页面不会显示。',
    },
    {
      en: 'The button sits fixed at the bottom-right corner and follows you as you scroll; it disappears when you leave a folder view.',
      zh: '按钮固定在页面右下角，滚动时始终可见；离开文件夹视图时自动消失。',
    },
    {
      en: 'Clicking it opens download-directory.github.io with the current page URL, which fetches the folder and saves it as a ZIP. A GitHub token may be required for private repositories.',
      zh: '点击后会打开 download-directory.github.io 并带上当前页面地址，由它抓取文件夹并保存为 ZIP；私有仓库可能需要 GitHub 令牌。',
    },
  ],
  defaultEnabled: false,
  createRuntime: createGitHubFolderDownloadRuntime,
};

export default githubFolderDownload;
