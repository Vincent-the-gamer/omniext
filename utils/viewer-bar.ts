import { browser } from '#imports';
import { APP_AUTHOR, APP_VERSION } from '@/utils/app';
import { createElement } from '@/utils/dom';

interface ViewerBarOptions {
  /** 文档类型标签，例如 `JSON`、`Shell`。 */
  badge: string;
  /** 补充信息，例如文件体积。 */
  meta: string;
  /** 右侧按钮，按显示顺序传入。 */
  actions: readonly HTMLElement[];
}

/**
 * 查看器顶栏。
 *
 * 左侧是产品信息（logo、名称、版本、作者），右侧是操作按钮，结构与弹窗顶栏
 * 一致，让浏览器里打开的 JSON / 脚本页面也像扩展的一部分。按钮文案由调用方
 * 按当前插件语言生成，这里只负责结构与排版。
 */
export function createViewerBar({ badge, meta, actions }: ViewerBarOptions): HTMLElement {
  const bar = createElement('div', 'oe-bar');

  const brand = createElement('div', 'oe-brand');
  brand.append(createLogo(), createBrandText());

  const divider = createElement('span', 'oe-bar__divider');
  const typeBadge = createElement('span', 'oe-badge', badge);
  const metaText = createElement('span', 'oe-bar__meta', meta);

  const actionGroup = createElement('div', 'oe-bar__actions');
  for (const action of actions) actionGroup.appendChild(action);

  bar.append(brand, divider, typeBadge, metaText, actionGroup);
  return bar;
}

function createBrandText(): HTMLElement {
  const text = createElement('div', 'oe-brand__text');

  const title = createElement('div', 'oe-brand__title');
  title.append(
    createElement('span', 'oe-brand__name', 'Omniext'),
    createElement('span', 'oe-brand__version', `v${APP_VERSION}`),
  );

  text.append(title, createElement('span', 'oe-brand__author', APP_AUTHOR));
  return text;
}

/**
 * 顶栏图标。
 *
 * 优先用扩展自己的 PNG；`web_accessible_resources` 已声明，但有些站点（例如
 * GitHub raw）用 `default-src 'none'` 把扩展图片也挡住了，这时退回到内联 SVG。
 * 内联 SVG 是 DOM 节点而不是外部资源，不受页面 CSP 影响，不会留下破图。
 */
function createLogo(): HTMLImageElement | SVGElement {
  const image = createElement('img', 'oe-brand__logo');
  image.width = 22;
  image.height = 22;
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');

  image.addEventListener(
    'error',
    () => {
      image.replaceWith(createFallbackLogo());
    },
    { once: true },
  );

  image.src = browser.runtime.getURL('/icon/32.png');
  return image;
}

/** 与产品图标同款的矢量标记：白色圆角底 + 深色光球 + 旋涡高光。 */
function createFallbackLogo(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'oe-brand__logo');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('aria-hidden', 'true');

  svg.innerHTML = `
    <defs>
      <radialGradient id="oe-brand-orb" cx="35%" cy="30%" r="76%">
        <stop offset="0%" stop-color="#666d76"></stop>
        <stop offset="40%" stop-color="#1d2126"></stop>
        <stop offset="100%" stop-color="#050607"></stop>
      </radialGradient>
    </defs>
    <rect x="0.5" y="0.5" width="23" height="23" rx="5.5" fill="#f2f4f6"></rect>
    <circle cx="12" cy="12" r="8" fill="url(#oe-brand-orb)"></circle>
    <g fill="none" stroke="#ffffff" stroke-opacity="0.42" stroke-width="1" stroke-linecap="round">
      <path d="M7.6 8.4c2.3-2.1 5.8-2.2 8.1 0"></path>
      <path d="M17.3 14.3c-1 2.8-4.1 4.5-7 3.7"></path>
      <path d="M6.8 14.9c-1.1-2.8.2-6 2.9-7.4"></path>
    </g>
  `;

  return svg;
}
