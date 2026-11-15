/**
 * 页面层面的 WebRTC 屏蔽。
 *
 * 参考 "WebRTC Control" 插件的做法：抢在页面脚本之前把 WebRTC 相关的全局对象
 * 全部置为 undefined，包括音视频（`navigator.mediaDevices`、`getUserMedia`），
 * 这样页面连 `RTCPeerConnection` 都创建不了，自然读不到真实 IP 或局域网 IP。
 *
 * 内容脚本运行在隔离世界，直接改全局不会影响页面，所以补丁以内联 <script>
 * 的形式注入到页面世界。页面 CSP 若禁止内联脚本，注入会失败——此时浏览器层面
 * 的 IP 策略（见 policy.ts）仍然是兜底。
 */

const GLOBALS = [
  "RTCPeerConnection",
  "RTCSessionDescription",
  "MediaStreamTrack",
  "MediaStream",
  "RTCDataChannel",
  "RTCIceCandidate",
  "RTCConfiguration",
  "mozRTCPeerConnection",
  "mozRTCSessionDescription",
  "mozMediaStreamTrack",
  "webkitRTCPeerConnection",
  "webkitRTCSessionDescription",
  "webkitMediaStreamTrack",
];

const NAVIGATOR = [
  "getUserMedia",
  "mozGetUserMedia",
  "webkitGetUserMedia",
  "mediaDevices",
  "mozMediaDevices",
];

const GUARD_SOURCE = `
(function () {
  if (window.__omniextWebrtcGuard) return;

  var globals = ${JSON.stringify(GLOBALS)};
  var navigatorKeys = ${JSON.stringify(NAVIGATOR)};
  var savedGlobals = {};
  var savedNavigator = {};

  function hide(target, keys, saved) {
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      saved[key] = target[key];
      try {
        Object.defineProperty(target, key, {
          value: undefined,
          writable: true,
          configurable: true,
        });
      } catch (error) {}
    }
  }

  hide(window, globals, savedGlobals);
  hide(navigator, navigatorKeys, savedNavigator);

  window.__omniextWebrtcGuard = {
    savedGlobals: savedGlobals,
    savedNavigator: savedNavigator,
  };
})();
`;

const RESTORE_SOURCE = `
(function () {
  var guard = window.__omniextWebrtcGuard;
  if (!guard) return;

  function restore(target, saved) {
    for (var key in saved) {
      try {
        Object.defineProperty(target, key, {
          value: saved[key],
          writable: true,
          configurable: true,
        });
      } catch (error) {}
    }
  }

  restore(window, guard.savedGlobals);
  restore(navigator, guard.savedNavigator);
  delete window.__omniextWebrtcGuard;
})();
`;

/** 把一段代码注入到页面世界；head 还没建立时等 DOMContentLoaded。 */
function runInPageWorld(source: string): void {
  const target = document.head ?? document.documentElement;
  if (!target) {
    document.addEventListener("DOMContentLoaded", () => runInPageWorld(source), {
      once: true,
    });
    return;
  }

  const script = document.createElement("script");
  script.textContent = source;
  target.appendChild(script);
  script.remove();
}

export function createWebRtcGuardRuntime(): {
  activate: () => void;
  deactivate: () => void;
} {
  let active = false;

  return {
    activate() {
      if (active) return;
      active = true;
      runInPageWorld(GUARD_SOURCE);
    },
    deactivate() {
      if (!active) return;
      active = false;
      runInPageWorld(RESTORE_SOURCE);
    },
  };
}
