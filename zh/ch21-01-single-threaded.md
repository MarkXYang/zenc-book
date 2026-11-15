# 21.1 构建单线程 Web 服务器

在引入线程池与并发之前，我们首先从构建一个可工作的**单线程 HTTP/1.1 服务器**开始。

该原型确立了核心的网络基础：
1. 在指定端口上创建并绑定 TCP 监听套接字。
2. 依次按序接收传入的客户端连接。
3. 读取并审查 HTTP 请求首部。
4. 根据 HTTP/1.1 规范格式化并写入 HTTP 响应。

---

## 1. HTTP 请求与响应的结构解剖

HTTP 是构建在 TCP 之上的基于文本、面向行的请求-响应协议。

### 请求报文格式：
```http
METHOD REQUEST-URI HTTP-VERSION\r\n
Header-Name: Header-Value\r\n
\r\n
[Optional Request Body]
```

对于访问 `http://127.0.0.1:7878/` 的标准浏览器请求，浏览器会发送：
```http
GET / HTTP/1.1\r\n
Host: 127.0.0.1:7878\r\n
User-Agent: Mozilla/5.0 ...\r\n
\r\n
```

### 响应报文格式：
```http
HTTP-VERSION STATUS-CODE REASON-PHRASE\r\n
Header-Name: Header-Value\r\n
\r\n
[Response Body Content]
```

一个合法的 HTML 响应如下所示：
```http
HTTP/1.1 200 OK\r\n
Content-Type: text/html\r\n
Content-Length: 49\r\n
Connection: close\r\n
\r\n
<h1>Hello from Zen C Single-Threaded Server!</h1>
```

---

## 2. 使用 `TcpListener` 与 `TcpStream`

Zen C 通过 `std/net/tcp.zc` 提供原生 TCP 网络支持：

- **`TcpListener::bind(host: char*, port: int) -> Result<TcpListener>`**：创建 TCP 套接字，将其绑定到指定的 IP 地址和端口，并开始监听传入的客户端握手。
- **`listener.accept() -> Result<TcpStream>`**：阻塞调用线程直至有客户端连接，返回表示已建立的双向 TCP 套接字的全新 `TcpStream`。
- **`stream.read(buf, max_len)` 与 `stream.write(buf, len)`**：从客户端套接字读取数据或向其写入数据。
- **`stream.close()`**：关闭套接字连接。由于 `TcpStream` 实现了 `Drop`，如果尚未关闭，丢弃该流时会自动关闭底层文件描述符。

---

## 3. 处理传入连接

在我们的单线程处理器中，我们将 HTTP 请求读入栈缓冲区并检查请求路径：

```zenc
fn handle_connection(stream: TcpStream) {
    let buffer: char[1024];
    let n_res = stream.read(buffer, 1023);
    if n_res.is_err() {
        return;
    }
    let n = n_res.unwrap();
    buffer[n] = '\0';

    let status_line = "HTTP/1.1 200 OK";
    let body = "<h1>Hello from Zen C Single-Threaded Server!</h1>";
    if strncmp(buffer, "GET / ", 6) != 0 && strncmp(buffer, "GET /hello ", 11) != 0 {
        status_line = "HTTP/1.1 404 NOT FOUND";
        body = "<h1>404 Not Found</h1>";
    }

    let resp_buf: char[1024];
    snprintf(
        resp_buf,
        1024,
        "%s\r\nContent-Type: text/html\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n%s",
        status_line,
        strlen(body),
        body
    );

    stream.write((u8*)resp_buf, strlen(resp_buf));
}
```

---

## 4. 完整示例：代码清单 21-1

代码清单 21-1 实现了单线程服务器循环，并包含一个验证 `200 OK` 与 `404 NOT FOUND` 响应的自测试客户端测试套件。

**代码清单 21-1**：`list21-1.zc` —— 单线程 HTTP 服务器（`examples/ch21/ch21-01-single-threaded/main.zc`）

```zenc
// File: examples/ch21/ch21-01-single-threaded/main.zc
import "std/net/tcp.zc"
import "std/thread.zc"

fn handle_connection(stream: TcpStream) {
    let buffer: char[1024];
    let n_res = stream.read(buffer, 1023);
    if n_res.is_err() {
        return;
    }
    let n = n_res.unwrap();
    buffer[n] = '\0';

    let status_line = "HTTP/1.1 200 OK";
    let body = "<h1>Hello from Zen C Single-Threaded Server!</h1>";
    if strncmp(buffer, "GET / ", 6) != 0 && strncmp(buffer, "GET /hello ", 11) != 0 {
        status_line = "HTTP/1.1 404 NOT FOUND";
        body = "<h1>404 Not Found</h1>";
    }

    let resp_buf: char[1024];
    snprintf(
        resp_buf,
        1024,
        "%s\r\nContent-Type: text/html\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n%s",
        status_line,
        strlen(body),
        body
    );

    stream.write((u8*)resp_buf, strlen(resp_buf));
}

fn run_server(port: int, max_requests: int) {
    let listener_res = TcpListener::bind("127.0.0.1", port);
    if listener_res.is_err() {
        println "Failed to bind to port {port}";
        return;
    }
    let listener = listener_res.unwrap();
    println "Single-threaded server listening on http://127.0.0.1:{port}";

    for _ in 0..max_requests {
        let stream_res = listener.accept();
        if stream_res.is_ok() {
            let stream = stream_res.unwrap();
            handle_connection(stream);
        }
    }
}

fn main() {
    let port = 7878;

    // Run server in background thread for 2 requests to verify end-to-end
    let s_thread = Thread::spawn(fn[=]() {
        run_server(port, 2);
    }).unwrap();

    sleep_ms(50); // wait for server to start

    // 1. Send GET /
    let client1 = TcpStream::connect("127.0.0.1", port).unwrap();
    let req1 = "GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
    client1.write((u8*)req1, strlen(req1));

    let buf1: char[1024];
    let n1 = client1.read(buf1, 1023).unwrap();
    buf1[n1] = '\0';
    println "Response 1:\n{buf1}";
    assert(strstr(buf1, "200 OK") != NULL, "Expected 200 OK");
    assert(strstr(buf1, "Hello from Zen C") != NULL, "Expected body match");

    // 2. Send GET /unknown
    let client2 = TcpStream::connect("127.0.0.1", port).unwrap();
    let req2 = "GET /unknown HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
    client2.write((u8*)req2, strlen(req2));

    let buf2: char[1024];
    let n2 = client2.read(buf2, 1023).unwrap();
    buf2[n2] = '\0';
    println "Response 2:\n{buf2}";
    assert(strstr(buf2, "404 NOT FOUND") != NULL, "Expected 404 NOT FOUND");

    s_thread.join().unwrap();
    println "Single-threaded web server test passed!";
}
```

使用 `zc run -q` 运行并验证代码清单 21-1：

```console
$ zc run -q examples/ch21/ch21-01-single-threaded/main.zc
Single-threaded server listening on http://127.0.0.1:7878
Response 1:
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 49
Connection: close

<h1>Hello from Zen C Single-Threaded Server!</h1>
Response 2:
HTTP/1.1 404 NOT FOUND
Content-Type: text/html
Content-Length: 22
Connection: close

<h1>404 Not Found</h1>
Single-threaded web server test passed!
```

---

## 5. 单线程服务器的致命局限

尽管这种单线程架构简单明了，但它饱受队头阻塞（head-of-line blocking）的困扰：
- 如果一个客户端连接花费 10 秒钟发送其请求体（或故意在缓慢的蜂窝移动网络上拖延连接），整个服务器线程都会在 `handle_connection` 内部陷入阻塞。
- 所有后续在 `listener.accept()` 中排队的客户端都将被迫等待。

要构建一个能够处理数百或数千个并发用户的服务器，我们必须使用**工作线程池**并行处理连接。接下来让我们在[21.2 节](ch21-02-multithreaded.md)中构建它！
