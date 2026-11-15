# Extending the Server: Routing, Static Files, Timing, and JSON

In Sections 21.1–21.3, you built a multithreaded TCP server with a bounded worker pool and graceful shutdown. In real-world web services, a server also needs to dispatch multiple routes, serve static files from disk, emit structured JSON status responses, and log request latency.

In this section, we extend our HTTP server using three core standard library modules that haven't appeared together yet:

- **`std/fs.zc`**: Checking file existence (`File::exists`) and reading static HTML assets (`File::read_all`).
- **`std/json.zc`**: Building structured JSON payloads (`JsonValue::object()`, `.set(...)`, `.to_string()`) for a `/status` telemetry endpoint.
- **`std/time.zc`**: Measuring server uptime and per-request handling latency (`Time::now()`).

---

## Designing the Router and `HttpResponse`

Instead of formatting raw HTTP strings inline inside each branch, we define a small `HttpResponse` struct holding the status line, `Content-Type`, and `String` body, along with a single `build_http_frame` helper that computes `Content-Length` automatically.

`route_request` inspects the incoming HTTP request line and dispatches to:

1. `GET /` — Returns a plain-text welcome banner (`200 OK`).
2. `GET /status` — Returns a JSON telemetry object (`application/json`) containing `"status": "ok"`, total `"requests"` served, and `"uptime_ms"`.
3. `GET /static/index.html` — Checks `File::exists(...)` and reads the HTML file from disk via `File::read_all(...)`, returning `text/html`.
4. Any other path — Falls through to `404 NOT FOUND`.

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

<span class="caption">Listing 21-4a: Routing, JSON status building, and static file serving</span>

## Running and Verifying the Extended Server

The complete runnable program in `examples/ch21/ch21-04-extending-server/main.zc` spawns the server on port `7884` in a background `Thread`, exercises all four routes (`GET /`, `GET /status`, `GET /static/index.html`, and `GET /missing`) over real TCP connections, and verifies the status codes, `Content-Type` headers, and bodies:

```sh
zc run -q examples/ch21/ch21-04-extending-server/main.zc
```

Output:

```text
[router] Request #1 handled in 0 ms -> 200 OK
[router] Request #2 handled in 1 ms -> 200 OK
[router] Request #3 handled in 0 ms -> 200 OK
[router] Request #4 handled in 0 ms -> 404 NOT FOUND
All extended server checks passed!
```

## Ideas for Further Exploration

Now that you have completed the book and built a working multithreaded HTTP server in Zen C, here are a few natural next steps:

- **Combine Sections 21.3 and 21.4**: Plug `route_request` directly into the `GracefulServer` thread pool from Section 21.3 so all routes run concurrently across worker threads.
- **Embed Static Assets**: Use `embed "index.html" as string` (Chapter 19) to bake fallback assets into the binary when no static directory is present on disk.
- **MISRA Hardening**: Compile your server core with `zc check --misra` to audit pointer handling, integer conversions, and return-value checks.
