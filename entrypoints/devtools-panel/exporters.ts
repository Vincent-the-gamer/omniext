/**
 * 导出目标：把抓到的请求打包成第三方接口工具可以直接导入的集合。
 *
 * 目前只有 Postman（Collection v2.1）。要支持 ApiPost、Apifox 等其它软件时，
 * 实现一个 `ExportTarget` 并加入 `EXPORT_TARGETS` 即可——界面上的下拉框会
 * 自动列出所有目标，多选导出的逻辑不需要改动。
 */

export interface ExportHeader {
    name: string;
    value: string;
}

/** 导出只需要请求侧的字段，避免和面板里的响应数据结构耦合。 */
export interface ExportableRequest {
    method: string;
    url: string;
    requestHeaders: ExportHeader[];
    requestBody: string;
    requestMimeType: string;
}

export interface ExportTarget {
    /** 下拉框里的 value，保持稳定。 */
    id: string;
    /** 下拉框里显示的名称。 */
    label: string;
    /** 图标路径，指向 `public/` 下的静态资源。 */
    icon?: string;
    /** 导出文件的后缀，例如 `.postman_collection.json`。 */
    filenameSuffix: string;
    /** 集合名称：单个请求与多个请求可以分别命名。 */
    collectionName: (requests: ExportableRequest[]) => string;
    /** 生成导入文件的文本内容；所有请求放在同一个集合里。 */
    build: (requests: ExportableRequest[], collectionName: string) => string;
}

function isJsonMime(mime: string): boolean {
    return /json/i.test(mime);
}

function requestPath(url: string): string {
    try {
        return new URL(url).pathname || "/";
    } catch {
        return url;
    }
}

function postmanItem(r: ExportableRequest) {
    const header = r.requestHeaders.map((h) => ({
        key: h.name,
        value: h.value,
    }));

    const body = r.requestBody
        ? {
              mode: "raw",
              raw: r.requestBody,
              options: {
                  raw: {
                      language: isJsonMime(r.requestMimeType) ? "json" : "text",
                  },
              },
          }
        : undefined;

    return {
        name: `${r.method} ${requestPath(r.url)}`,
        request: {
            method: r.method,
            header,
            url: r.url,
            body,
        },
        response: [],
    };
}

const postmanTarget: ExportTarget = {
    id: "postman",
    label: "Postman",
    icon: "/postman.svg",
    filenameSuffix: ".postman_collection.json",
    collectionName: (requests) =>
        requests.length === 1
            ? `Request: ${requests[0]?.method ?? "GET"}`
            : `Omniext Network Capture (${requests.length} requests)`,
    build: (requests, collectionName) =>
        JSON.stringify(
            {
                info: {
                    name: collectionName,
                    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
                },
                item: requests.map(postmanItem),
            },
            null,
            2,
        ),
};

/**
 * 所有可用的导出目标；第一项是默认目标。
 * 新增 ApiPost 等软件时在这里追加即可。
 */
export const EXPORT_TARGETS: readonly ExportTarget[] = [postmanTarget];
