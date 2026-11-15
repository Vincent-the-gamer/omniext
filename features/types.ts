/**
 * 功能（feature）的接口定义。
 *
 * 新增一个功能只需要两步：
 * 1. 在 `features/<id>/` 下实现一个 `FeatureDefinition`；
 * 2. 把它加进 `features/registry.ts` 的数组。
 *
 * 内容脚本宿主（`features/host.ts`）和弹窗界面（`entrypoints/popup`）都只
 * 依赖这份接口，因此会自动识别新功能，无需改动其它代码。
 */

import type { LocalizedText } from '@/utils/i18n';
import type { FeatureSettings } from '@/utils/feature-settings';

/** 功能运行时能拿到的页面信息。 */
export interface FeatureContext {
  /** 功能所在框架的域名，例如 `news.example.com`；没有域名时为空字符串。 */
  hostname: string;
}

/** 一个功能在某个页面上的运行实例。 */
export interface FeatureRuntime {
  /** 开启功能。需要可重复调用（宿主可能会重复触发）。 */
  activate(): void;
  /** 关闭功能，撤销 `activate` 做过的改动。 */
  deactivate(): void;
}

/**
 * 功能自带的可选参数，在界面里以下拉菜单呈现。
 *
 * 值保存在该功能的设置项的 `options` 字段里，因此同样会自动持久化。
 */
export interface FeatureOption {
  /** 设置里的键名。 */
  key: string;
  /** 下拉菜单的标题。 */
  label: LocalizedText;
  /** 用户没有改动时的默认值。 */
  default: string;
  /** 可选值，顺序就是界面里的顺序。 */
  values: readonly { value: string; label: LocalizedText }[];
  /** 菜单下方的一句话说明。 */
  note?: LocalizedText;
}

/** 一个功能（插件能力）的完整描述。 */
export interface FeatureDefinition {
  /** 稳定 ID，同时用作设置存储的键后缀，不要随意改动。 */
  id: string;
  /** 弹窗中显示的名称，英文与中文各一份。 */
  name: LocalizedText;
  /** 弹窗中显示的说明，英文与中文各一份。 */
  description: LocalizedText;
  /** 弹窗中显示的图标（emoji，避免额外打包图片资源）。 */
  icon: string;
  /**
   * 新安装时的默认开关状态。
   *
   * 约定：功能一律默认关闭，首次安装时用户看到的开关都是关的，
   * 需要用户主动开启（也便于新功能上线时不改变已有用户的行为）。
   */
  defaultEnabled: boolean;
  /** 设置页中展示的补充说明，每条一句话，英文与中文各一份。 */
  details?: readonly LocalizedText[];
  /** 功能自带的可选参数，界面里呈现为下拉菜单。 */
  options?: readonly FeatureOption[];
  /**
   * 该功能作用于浏览器本身，而不是某个页面（例如 WebRTC 的 IP 策略）。
   *
   * 全局功能没有域名规则：开关开启期间对所有标签页生效。
   */
  global?: boolean;
  /**
   * 可选：功能需要改动浏览器全局设置时（例如 WebRTC 的 IP 处理策略）在这里实现。
   *
   * 后台会在启动时以及每次设置变化时调用它；调用时传入归一化后的设置。
   */
  applySettings?: (settings: FeatureSettings) => void;
  /**
   * 可选：读取浏览器里该功能对应的真实状态，键名与 `options` 的键一致。
   *
   * 界面用它确认全局设置是否真的落地（例如 WebRTC 的 IP 策略被浏览器拒绝时
   * 给出提示）。
   */
  readBrowserState?: () => Promise<Record<string, string>>;
  /**
   * 创建该功能在当前页面的运行实例。
   *
   * 页面级功能必须提供；全局功能（`global: true`）不需要，宿主会跳过。
   *
   * 宿主会在 `document_start` 时**同步**调用它，因此需要拦截页面事件的
   * 功能可以在这里就把监听器注册好，抢在页面脚本之前生效。
   */
  createRuntime?: (context: FeatureContext) => FeatureRuntime;
}
