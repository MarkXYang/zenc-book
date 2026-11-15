# 扩展服务器：路由、静态文件、计时与 JSON

在 21.1–21.3 节中，你构建了一个带有有界工作线程池和平滑关闭的多线程 TCP 服务器。在现实世界的 Web 服务中，服务器还需要分发多个路由、从磁盘提供静态文件服务、输出结构化的 JSON 状态响应，并记录请求延迟。

在本节中，我们使用三个此前尚未一同亮相的核心标准库模块来扩展我们的 HTTP 服务器：

- **`std/fs.zc`**：检查文件是否存在（`File::exists`）并读取静态 HTML 资源（`File::read_all`）。
- **`std/json.zc`**：为 `/status` 遥测端点构建结构化 JSON 负载（`JsonValue::object()`、`.set(...)`、`.to_string()`）。
- **`std/time.zc`**：测量服务器正常运行时间及每个请求的处理延迟（`Time::now()`）。

---

## 设计路由器与 `HttpResponse`

我们不再在每个分支中内联格式化原始 HTTP 字符串，而是定义一个包含状态行、`Content-Type` 和 `String` 正文的小型 `HttpResponse` 结构体，以及一个自动计算 `Content-Length` 的统一 `build_http_frame` 辅助函数。

`route_request` 审查传入的 HTTP 请求行并将其分发到：

1. `GET /` —— 返回纯文本欢迎横幅（`200 OK`）。
2. `GET /status` —— 返回包含 `"status": "ok"`、已服务总请求数 `"requests"` 以及 `"uptime_ms"` 的 JSON 遥测对象（`application/json`）。
3. `GET /static/index.html` —— 检查 `File::exists(...)` 并通过 `File::read_all(...)` 从磁盘读取 HTML 文件，返回 `text/html`。
4. 任何其他路径 —— 兜底回退到 `404 NOT FOUND`。

```zenc
// File: examples/ch21/ch21-04-extending-server/main.zc

import "std/fs.zc"
import "std/json.zc"
import "std/net/tcp.zc"
import "std/string.zc"
import "std/thread.zc"
import "std/time.zc"

include <string.h>

struct HttpResponse {
    status: string;
    content_type: string;
    body: String;
}

fn build_http_frame(resp: HttpResponse*) -> String {
    let body_len = resp.body.length();
    let frame = String::new("HTTP/1.1 ");
    frame.append_c(resp.status);
    frame.append_c("\r\nContent-Type: ");
    frame.append_c(resp.content_type);
    frame.append_c("\r\nContent-Length: ");
    let len_str = "{body_len}";
    frame.append_c(len_str);
    frame.append_c("\r\nConnection: close\r\n\r\n");
    frame.append(&resp.body);
    return frame;
}

fn route_request(request_line: char*, start_ms: u64, req_count: int) -> HttpResponse {
    let now_ms = Time::now();
    let elapsed_ms = now_ms - start_ms;

    if strncmp(request_line, "GET / ", 6) == 0 {
        return HttpResponse {
            status: "200 OK",
            content_type: "text/plain",
            body: String::new("Welcome to Zen C Extended Server!"),
        };
    }

    if strncmp(request_line, "GET /status ", 12) == 0 {
        let obj = JsonValue::object();
        obj.set("status", JsonValue::string("ok"));
        obj.set("requests", JsonValue::number((f64)req_count));
        obj.set("uptime_ms", JsonValue::number((f64)elapsed_ms));
        let json_cstr = obj.to_string();
        return HttpResponse {
            status: "200 OK",
            content_type: "application/json",
            body: String::new(json_cstr),
        };
    }

    if strncmp(request_line, "GET /static/index.html ", 23) == 0 {
        let asset_path = "examples/ch21/ch21-04-extending-server/index.html";
        if File::exists(asset_path) {
            let res = File::read_all(asset_path);
            if res.is_ok() {
                return HttpResponse {
                    status: "200 OK",
                    content_type: "text/html",
                    body: res.unwrap(),
                };
            }
        }
    }

    return HttpResponse {
        status: "404 NOT FOUND",
        content_type: "text/plain",
        body: String::new("404 Not Found"),
    };
}
```

<span class="caption">代码清单 21-4a：路由、JSON 状态构建与静态文件服务</span>

## 运行与验证扩展服务器

`examples/ch21/ch21-04-extending-server/main.zc` 中的完整可运行程序在后台 `Thread` 中启动监听端口 `7884` 的服务器，通过真实的 TCP 连接执行所有四个路由（`GET /`、`GET /status`、`GET /static/index.html` 和 `GET /missing`），并验证状态码、`Content-Type` 首部与响应体：

```sh
zc run -q examples/ch21/ch21-04-extending-server/main.zc
```

输出：

```text
[router] Request #1 handled in 0 ms -> 200 OK
[router] Request #2 handled in 1 ms -> 200 OK
[router] Request #3 handled in 0 ms -> 200 OK
[router] Request #4 handled in 0 ms -> 404 NOT FOUND
All extended server checks passed!
```

## 深入探索的建议

现在你已经通读了全书并在 Zen C 中构建了一个可工作的多线程 HTTP 服务器，以下是一些自然的后续进阶方向：

- **结合 21.3 节与 21.4 节**：将 `route_request` 直接接入 21.3 节的 `GracefulServer` 线程池中，让所有路由跨工作线程并发运行。
- **嵌入静态资产**：使用 `embed "index.html" as string`（第 19 章）在磁盘上不存在静态目录时将后备资源直接编译进二进制文件中。
- **MISRA 强化**：使用 `zc check --misra` 编译你的服务器核心，审计指针处理、整数转换以及返回值检查。
