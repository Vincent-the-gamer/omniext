import type { FeatureDefinition } from '@/features/types';
import { createCodeViewerRuntime } from './runtime';

/**
 * 代码查看器：JSON 格式化 + JavaScript / Shell 语法高亮。
 *
 * 三类页面共用同一个展示组件：深色底、品牌顶栏、行号与语法配色。JSON 会先
 * 格式化再着色，保留长数字原文；开关关闭后页面恢复浏览器原来的纯文本视图。
 */
const codeViewer: FeatureDefinition = {
  id: 'code-viewer',
  name: {
    en: 'Code viewer',
    zh: '代码查看',
  },
  icon: '🧾',
  description: {
    en: 'Formats JSON and highlights JavaScript, TypeScript and shell scripts that the browser opens as plain text.',
    zh: '浏览器直接打开 JSON、JavaScript / TypeScript 与 Shell 脚本时，自动格式化并着色。',
  },
  details: [
    {
      en: 'Only runs when the page itself is source text: a URL served as JSON, JavaScript or shell, or a `.json` / `.js` / `.ts` / `.sh` file opened directly. Regular web pages are never touched.',
      zh: '只在页面本身就是源码文本时生效：直接打开返回 JSON、JavaScript、Shell 的地址，或 `.json`、`.js`、`.ts`、`.sh` 文件；普通网页不会被改动。',
    },
    {
      en: 'Scripts without a file extension (for example `https://bun.sh/install`) are recognised by their contents, such as a shebang or shell control blocks.',
      zh: '没有扩展名的脚本地址（例如 `https://bun.sh/install`）会按内容特征识别，例如 shebang 或 Shell 控制块。',
    },
    {
      en: 'JSON is pretty-printed before highlighting; numbers stay exactly as written, so long IDs and nanosecond timestamps never lose digits. Copy gives you the formatted JSON.',
      zh: 'JSON 会先格式化再着色；数字按原文保留，长 ID、纳秒时间戳不会丢位。复制得到的是格式化后的 JSON。',
    },
    {
      en: 'JavaScript, TypeScript and shell scripts are only coloured: text, indentation and line breaks stay exactly as published, so copying keeps the original script.',
      zh: 'JavaScript、TypeScript 与 Shell 只着色，不改动内容、缩进与换行，复制出来仍是原始脚本。',
    },
    {
      en: 'If the browser’s own JSON viewer already took over the page, the source is read from it and the page is shown with the same layout.',
      zh: '如果页面已经被浏览器自带的 JSON 查看器接管，会从其中读出源码，仍然用同一套页面展示。',
    },
    {
      en: 'Line numbers sit in their own column, so horizontal scrolling never moves them, and the copy button never copies the numbers.',
      zh: '行号是独立一列，横向滚动不会把它顶走，复制按钮也不会带上行号。',
    },
  ],
  // 首次安装时所有开关都是关闭的，由用户主动开启。
  defaultEnabled: false,
  createRuntime: createCodeViewerRuntime,
};

export default codeViewer;
