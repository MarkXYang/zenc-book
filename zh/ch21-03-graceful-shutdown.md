# 优雅停机与资源清理

在生产系统中，服务器在滚动更新、配置重新加载或收到操作系统终止信号（`SIGINT`、`SIGTERM`）时，必须能够平滑且干净地关闭。

使用 `kill -9` 或直接调用 `exit(0)` 突然终止服务器会导致严重的实际生产问题：
- 正在进行中的数据库事务在写入中途被强行中止。
- 处于活跃状态的 HTTP 客户端收到破损的 TCP 重置连接（`ECONNRESET`），而不是完整的响应报文。
- 打开的文件、套接字和内存缓冲区在未执行确定性 RAII 清理的情况下被直接遗弃。

在这收官一节中，我们通过实现**平滑关闭（graceful shutdown）**来完成我们的 Web 服务器项目：停止接收新请求、通知所有工作线程排空挂起的工作任务，并在退出前等待所有工作线程干净利落地结束。

---

## 1. 协作式关闭架构

平滑关闭需要在三个核心组件之间进行协调：

1. **关闭标志（`shutdown: bool`）**：由 `Mutex` 保护，该原子或同步标志用于表明服务器已进入终止模式。
2. **条件变量广播（`CondVar::broadcast`）**：空闲的工作线程正在 `not_empty.wait(&mutex)` 上休眠。当调用 `stop()` 时，设置 `shutdown = true` 并调用 `not_empty.broadcast()` 将同时唤醒**所有**休眠中的工作线程。
3. **队列排空**：被唤醒的工作线程验证队列中是否仍有残留的连接句柄：
   - 如果队列中仍有工作任务，工作线程会继续处理完它们。
   - 一旦 `count == 0` 且 `shutdown == true`，工作线程将跳出循环并干净地终止。
4. **线程汇聚（`thread.join()`）**：主线程遍历所有工作线程句柄并调用 `th.join().unwrap()`，确保在进程销毁前所有操作系统线程均已退出。

```
Main Server Thread                               Worker Threads (0..N)
        |                                                 |
  server.shutdown()                                       |
        |                                                 |
  queue.stop()                                            |
    - shutdown = true                                     |
    - not_empty.broadcast() -------------------------> Woken from CondVar::wait
        |                                                 |
        |                                            Drain remaining jobs
        |                                            queue.pop() -> None
        |                                            Worker exits cleanly
        |                                                 |
  th.join() <---------------------------------------------+ (Thread terminated)
        |
  All resources freed!
```

---

## 2. 使用 `Drop` 进行 RAII 资源清理

在 Zen C 中，`TcpStream` 与 `TcpListener` 实现了 `Drop`：

```zenc
impl Drop for TcpStream {
    fn drop(self) {
        self.close();
    }
}

impl Drop for TcpListener {
    fn drop(self) {
        self.close();
    }
}
```

当工作线程完成 `handle_connection(stream)` 或监听器离开作用域时，编译器会自动调用 `drop()`，关闭操作系统的套接字文件描述符。将自动 `Drop` 与 `thread.join()` 相结合，保证了**零套接字泄漏和零内存泄漏**。

---

## 3. 完整示例：代码清单 21-3

代码清单 21-3 将监听器、有界任务队列、工作线程以及线程安全的事务计数器封装到一个高内聚的 `GracefulServer` 结构体中。

**代码清单 21-3**：平滑关闭与资源清理（`examples/ch21/ch21-03-graceful-shutdown/main.zc`）

```zenc
// File: examples/ch21/ch21-03-graceful-shutdown/main.zc
import "std/net/tcp.zc"
import "std/thread.zc"
import "std/sync.zc"
import "std/option.zc"
import "std/vec.zc"

def QUEUE_SIZE = 16;

struct WorkQueue {
    streams: isize[16];
    head: usize;
    tail: usize;
    count: usize;
    mutex: Mutex;
    not_empty: CondVar;
    not_full: CondVar;
    shutdown: bool;
}

impl WorkQueue {
    fn new() -> WorkQueue {
        let q: WorkQueue;
        q.head = 0;
        q.tail = 0;
        q.count = 0;
        q.mutex = Mutex::new();
        q.not_empty = CondVar::new();
        q.not_full = CondVar::new();
        q.shutdown = false;
        return q;
    }

    fn push(self, handle: isize) -> bool {
        self.mutex.lock();
        while self.count == (usize)QUEUE_SIZE && !self.shutdown {
            self.not_full.wait(&self.mutex);
        }
        if self.shutdown {
            self.mutex.unlock();
            return false;
        }

        self.streams[self.tail] = handle;
        self.tail = (self.tail + 1) % (usize)QUEUE_SIZE;
        self.count += 1;

        self.not_empty.signal();
        self.mutex.unlock();
        return true;
    }

    fn pop(self) -> Option<isize> {
        self.mutex.lock();
        while self.count == 0 && !self.shutdown {
            self.not_empty.wait(&self.mutex);
        }
        if self.count == 0 {
            self.mutex.unlock();
            return Option<isize>::None();
        }

        let handle = self.streams[self.head];
        self.head = (self.head + 1) % (usize)QUEUE_SIZE;
        self.count -= 1;

        self.not_full.signal();
        self.mutex.unlock();
        return Option<isize>::Some(handle);
    }

    fn stop(self) {
        self.mutex.lock();
        self.shutdown = true;
        self.not_empty.broadcast();
        self.not_full.broadcast();
        self.mutex.unlock();
    }
}

struct ServerStats {
    mutex: Mutex;
    requests_processed: int;
}

fn worker_loop(queue: WorkQueue*, stats: ServerStats*) {
    while true {
        let handle_opt = queue.pop();
        if handle_opt.is_none() {
            break; // Queue shut down and fully drained
        }

        let stream = TcpStream { handle: handle_opt.unwrap() };
        let buffer: char[1024];
        let n_res = stream.read(buffer, 1023);
        if n_res.is_ok() {
            let n = n_res.unwrap();
            buffer[n] = '\0';

            let body = "<h1>Graceful Server Running</h1>";
            if strstr(buffer, "GET /shutdown") != NULL {
                body = "<h1>Shutdown Signal Acknowledged</h1>";
            }

            let resp_buf: char[1024];
            snprintf(
                resp_buf,
                1024,
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n%s",
                strlen(body),
                body
            );
            stream.write((u8*)resp_buf, strlen(resp_buf));
        }

        stats.mutex.lock();
        stats.requests_processed += 1;
        stats.mutex.unlock();
    }
}

// Server coordinating listener, work queue, and worker thread pool
struct GracefulServer {
    port: int;
    queue: WorkQueue;
    workers: Vec<Thread>;
    stats: ServerStats;
}

impl GracefulServer {
    fn new(port: int, num_workers: usize) -> GracefulServer {
        return GracefulServer {
            port: port,
            queue: WorkQueue::new(),
            workers: Vec<Thread>::with_capacity(num_workers),
            stats: ServerStats { mutex: Mutex::new(), requests_processed: 0 },
        };
    }

    fn start(self, num_workers: usize) {
        let q_ptr: WorkQueue* = &self.queue;
        let s_ptr: ServerStats* = &self.stats;

        for _ in 0..num_workers {
            let th = Thread::spawn(fn[=]() {
                worker_loop(q_ptr, s_ptr);
            }).unwrap();
            self.workers.push(th);
        }
    }

    fn serve_requests(self, max_requests: int) {
        let listener_res = TcpListener::bind("127.0.0.1", self.port);
        if listener_res.is_err() {
            println "Bind failed";
            return;
        }
        let listener = listener_res.unwrap();
        println "Graceful server accepting requests on http://127.0.0.1:{self.port}";

        for _ in 0..max_requests {
            let stream_res = listener.accept();
            if stream_res.is_ok() {
                let stream = stream_res.unwrap();
                let handle = stream.handle;
                stream.handle = 0; // Prevent TcpStream drop from closing socket early
                self.queue.push(handle);
            }
        }
    }

    fn shutdown(self) {
        println "Shutting down worker pool...";
        self.queue.stop();
        for i in (usize)0..self.workers.length() {
            let th = self.workers.get(i);
            th.join().unwrap();
        }
        println "All workers joined and all active connections drained.";
    }
}

fn main() {
    let port = 7880;
    let server = GracefulServer::new(port, 4);
    server.start(4);

    let server_ptr: GracefulServer* = &server;

    // Run server accepting 3 requests
    let s_thread = Thread::spawn(fn[=]() {
        server_ptr.serve_requests(3);
    }).unwrap();

    sleep_ms(50);

    // Send 3 requests
    for i in 1..=3 {
        let client = TcpStream::connect("127.0.0.1", port).unwrap();
        let req = (i == 3) ? "GET /shutdown HTTP/1.1\r\n\r\n" : "GET / HTTP/1.1\r\n\r\n";
        client.write((u8*)req, strlen(req));

        let buf: char[1024];
        let n = client.read(buf, 1023).unwrap();
        buf[n] = '\0';
        assert(strstr(buf, "200 OK") != NULL, "Expected 200 OK");
        println "Client received request {i} response successfully.";
    }

    s_thread.join().unwrap();
    server.shutdown();

    let total = server.stats.requests_processed;
    println "Total completed HTTP transactions: {total}";
    assert(total == 3, "All 3 requests must be safely processed and logged");
    println "Graceful shutdown test verified successfully!";
}
```

使用 `zc run -q` 运行并验证代码清单 21-3：

```console
$ zc run -q examples/ch21/ch21-03-graceful-shutdown/main.zc
Graceful server accepting requests on http://127.0.0.1:7880
Client received request 1 response successfully.
Client received request 2 response successfully.
Client received request 3 response successfully.
Shutting down worker pool...
All workers joined and all active connections drained.
Total completed HTTP transactions: 3
Graceful shutdown test verified successfully!
```

---

## 4. 恭喜你！

通过完成这个收官项目，你已经从零开始构建了一个生产级的并发系统服务：
- 你使用标准套接字构建了原生 TCP 网络。
- 你实现了 HTTP 协议解析与响应生成。
- 你使用 `Mutex` 和双 `CondVar` 背压构建了零分配的有界并发任务队列。
- 你协同调度了原生操作系统工作线程的持久线程池。
- 你实现了确定性、干净利落的平滑关闭，既不丢弃请求，也不产生任何资源泄漏。

你已经全面掌握了 **The Zen C 编程语言**的原则、语法、惯用法以及系统级能力。现在，你已具备了构建大规模快速、可靠且安全软件的强大实力！
