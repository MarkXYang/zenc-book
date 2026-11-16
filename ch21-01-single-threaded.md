# Building a Single-Threaded Web Server

Before adding thread pools and concurrency, we begin by building a working **single-threaded HTTP/1.1 server**.

This prototype establishes the core networking foundations:
1. Creating and binding a TCP listening socket on a designated port.
2. Accepting incoming client connections sequentially.
3. Reading and inspecting HTTP request headers.
4. Formatting and writing HTTP responses according to the HTTP/1.1 specification.

---

## 1. Anatomy of an HTTP Request and Response

HTTP is a text-based, line-oriented request-response protocol built on top of TCP.

### The Request Format:
```http
METHOD REQUEST-URI HTTP-VERSION\r\n
Header-Name: Header-Value\r\n
\r\n
[Optional Request Body]
```

For a standard browser visit to `http://127.0.0.1:7878/`, the browser sends:
```http
GET / HTTP/1.1\r\n
Host: 127.0.0.1:7878\r\n
User-Agent: Mozilla/5.0 ...\r\n
\r\n
```

### The Response Format:
```http
HTTP-VERSION STATUS-CODE REASON-PHRASE\r\n
Header-Name: Header-Value\r\n
\r\n
[Response Body Content]
```

A valid HTML response looks like:
```http
HTTP/1.1 200 OK\r\n
Content-Type: text/html\r\n
Content-Length: 49\r\n
Connection: close\r\n
\r\n
<h1>Hello from Zen C Single-Threaded Server!</h1>
```

---

## 2. Using `TcpListener` and `TcpStream`

Zen C provides native TCP networking through `std/net/tcp.zc`:

- **`TcpListener::bind(host: char*, port: int) -> Result<TcpListener>`**: Creates a TCP socket, binds it to the specified IP address and port, and begins listening for incoming client handshakes.
- **`listener.accept() -> Result<TcpStream>`**: Blocks the calling thread until a client connects, returning a new `TcpStream` representing the established bi-directional TCP socket.
- **`stream.read(buf, max_len)` & `stream.write(buf, len)`**: Reads from or writes to the client socket.
- **`stream.close()`**: Closes the socket connection. Because `TcpStream` implements `Drop`, dropping the stream automatically closes the underlying file descriptor if not already closed.

---

## 3. Handling Incoming Connections

In our single-threaded handler, we read the HTTP request into a stack buffer and inspect the request path:

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

## 4. Complete Example: Listing 21-1

Listing 21-1 implements the single-threaded server loop and includes a self-testing client harness that validates both `200 OK` and `404 NOT FOUND` responses.

**Listing 21-1**: Single-threaded HTTP server (`examples/ch21/ch21-01-single-threaded/main.zc`)

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

Run and verify Listing 21-1 with `zc run -q`:

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

## 5. The Fatal Limitation of Single-Threaded Servers

While simple and clear, this single-threaded architecture suffers from head-of-line blocking:
- If a client connection takes 10 seconds to send its request body (or is intentionally stalling on a slow cellular link), the entire server thread blocks inside `handle_connection`.
- All subsequent clients waiting in `listener.accept()` are forced to wait.

To build a server capable of handling hundreds or thousands of simultaneous users, we must process connections in parallel using a **worker thread pool**. Let's build that next in [Section 21.2](ch21-02-multithreaded.md)!
