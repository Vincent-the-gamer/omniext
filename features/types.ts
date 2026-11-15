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

/** 一个功能（插件能力）的完整描述。 */
export interface FeatureDefinition {
  /** 稳定 ID，同时用作设置存储的键后缀，不要随意改动。 */
  id: string;
  /** 弹窗中显示的名称。 */
  name: string;
  /** 弹窗中显示的说明。 */
  description: string;
  /** 弹窗中显示的图标（emoji，避免额外打包图片资源）。 */
  icon: string;
  /** 新安装时的默认开关状态。 */
  defaultEnabled: boolean;
  /** 设置页中展示的补充说明，每条一句话。 */
  details?: readonly string[];
  /**
   * 创建该功能在当前页面的运行实例。
   *
   * 宿主会在 `document_start` 时**同步**调用它，因此需要拦截页面事件的
   * 功能可以在这里就把监听器注册好，抢在页面脚本之前生效。
   */
  createRuntime(context: FeatureContext): FeatureRuntime;
}
