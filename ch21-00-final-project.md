# Chapter 21: Final Project: Building a Multithreaded Web Server

Throughout this book, you have journeyed across the entire landscape of the Zen C programming language:
- **Fundamentals**: Memory safety without a garbage collector, pointers as borrows, copy and move semantics, and RAII cleanup (`defer` and `Drop`).
- **Data Modeling & Architecture**: Structs, methods, composition with `use`, enums, pattern matching, generics, traits, and smart derives.
- **Systems Engineering**: Native OS threads (`std/thread.zc`), synchronization primitives (`std/sync.zc`), message passing channels, SIMD vectorization, polyglot compilation, and low-level C interoperability.

Now, we bring all of these concepts together in our capstone project: **building a fast, robust, multithreaded HTTP web server from scratch in pure Zen C**.

---

## 1. What We Are Building

HTTP (Hypertext Transfer Protocol) is the bedrock protocol of the modern web. Every time a browser, mobile app, or CLI tool (`curl`) requests a webpage or API, it opens a TCP connection and transmits an HTTP request.

Our web server will:
1. Listen on a TCP socket using `TcpListener` from `std/net/tcp.zc`.
2. Parse incoming HTTP/1.1 requests (`GET /`, `GET /hello`, `GET /sleep`).
3. Construct compliant HTTP/1.1 response frames (`200 OK`, `404 NOT FOUND`) with proper headers (`Content-Type`, `Content-Length`, `Connection: close`).
4. Distribute client connections across a persistent, bounded **worker thread pool** using `Mutex` and `CondVar` from `std/sync.zc`, preventing denial-of-service thread exhaustion.
5. Implement a clean, leak-free **graceful shutdown** sequence that drains in-flight client requests and closes sockets without dropping data.

```
                         Client Browsers / curl Requests
                                       |
                                       v
                         +---------------------------+
                         |  TcpListener.accept()     | (Main Listener Thread)
                         +---------------------------+
                                       |
                                       | push(stream_handle)
                                       v
                         +---------------------------+
                         |  Bounded StreamQueue      |
                         |  - Mutex + CondVar        |
                         +---------------------------+
                                   /   |   \
                                 /     |     \
                                v      v      v
                           +-----------------------+
                           |  Worker Thread Pool   | (N OS Threads)
                           |  - Read HTTP Request  |
                           |  - Route & Compute    |
                           |  - Write Response     |
                           |  - Close Connection   |
                           +-----------------------+
```

---

## 2. Chapter Organization

We build the web server across three progressive milestones:

1. **[21.1 Building a Single-Threaded Web Server](ch21-01-single-threaded.md)**:
   - Binding TCP sockets on `127.0.0.1`.
   - Reading and parsing raw HTTP request buffers.
   - Formatting and writing status lines, HTTP headers, and HTML response bodies.
   - Understanding why single-threaded servers stall under slow requests.

2. **[21.2 Turning Our Single-Threaded Server into a Multithreaded Server](ch21-02-multithreaded.md)**:
   - Designing a concurrent `StreamQueue` with bounded capacity.
   - Spawning persistent worker threads using `Thread::spawn`.
   - Distributing requests across workers so slow requests do not block fast clients.

3. **[21.3 Graceful Shutdown and Cleanup](ch21-03-graceful-shutdown.md)**:
   - Implementing cooperative cancellation flags and `CondVar::broadcast`.
   - Draining in-flight client connections before server process exit.
   - Ensuring zero resource leaks via deterministic `Drop` and `thread.join()`.

Let's begin by building the single-threaded prototype!
