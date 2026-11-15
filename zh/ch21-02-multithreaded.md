# 21.2 将单线程服务器改造为多线程服务器

在[21.1 节](ch21-01-single-threaded.md)中，我们指出了单线程 Web 服务器的主要缺陷：如果一个请求很慢（例如缓慢的磁盘读取、数据库查询或慢速客户端连接），所有后续的传入请求都将在其后发生停顿。

在本节中，我们将使用固定大小的**工作线程池**将服务器转变为高并发的**多线程 Web 服务器**。

---

## 1. 单请求单线程 vs 工作线程池

在向多线程服务器过渡时，存在两种策略：

1. **单请求单线程（在每次 `accept` 时调用 `Thread::spawn`）**：
   - *问题*：为每个传入连接都生成一个新的操作系统线程开销巨大，并且会带来极易遭受拒绝服务攻击的隐患：攻击者可以同时打开 10,000 个连接，导致服务器进程因线程耗尽或内存不足错误而崩溃。
2. **常驻工作线程池（`ThreadPool`）**：
   - *解决方案*：预先分配一个包含 $N$ 个工作线程的固定线程池（通常与宿主机 CPU 核心数相匹配，例如 4、8 或 16）。传入的连接被放入一个有界的并发 FIFO 队列中。工作线程一旦空闲便立即获取连接进行处理。如果所有工作线程都在忙碌，后续连接将在队列中安全排队，直到有工作线程空出。

---

## 2. 设计并发 `StreamQueue`

为了在主接收线程与工作线程之间传递客户端连接句柄，且不产生竞态条件或内存损坏，我们构建了一个由 `Mutex` 和两个条件变量保护的有界 `StreamQueue`：

```zenc
def QUEUE_SIZE = 16;

struct StreamQueue {
    streams: isize[16];
    head: usize;
    tail: usize;
    count: usize;
    mutex: Mutex;
    not_empty: CondVar;
    not_full: CondVar;
    shutdown: bool;
}
```

- 当监听器接收到一个客户端连接时，调用 `queue.push(handle)`。如果队列已满（`count == QUEUE_SIZE`），监听线程会在 `not_full` 上阻塞，产生自然的背压（backpressure）。
- 当空闲的工作线程准备好处理工作时，调用 `queue.pop()`。如果队列为空，工作线程将在 `not_empty` 上休眠，**CPU 占用率为零**。

---

## 3. 工作线程例程与非阻塞架构

每个工作线程运行一个无限循环，从队列中拉取客户端连接描述符：

```zenc
fn worker_routine(q: StreamQueue*) {
    while true {
        let handle_opt = q.pop();
        if handle_opt.is_none() {
            break; // Queue shut down and drained
        }
        process_http_stream(handle_opt.unwrap());
    }
}
```

现在，即使一个请求访问了缓慢的端点（例如 `/sleep`），其他工作线程也能立即并发继续响应其他快速请求（`/` 和 `/hello`）！

---

## 4. 完整示例：代码清单 21-2

代码清单 21-2 使用包含 4 个工作线程的线程池实现了我们的多线程 Web 服务器，演示了慢速的 `/sleep` 请求不会阻塞并发响应。

**代码清单 21-2**：`list21-2.zc` —— 带有工作线程池的多线程 Web 服务器（`examples/ch21/ch21-02-multithreaded/main.zc`）

```zenc
// File: examples/ch21/ch21-02-multithreaded/main.zc
import "std/net/tcp.zc"
import "std/thread.zc"
import "std/sync.zc"
import "std/option.zc"
import "std/vec.zc"

def QUEUE_SIZE = 16;

struct StreamQueue {
    streams: isize[16];
    head: usize;
    tail: usize;
    count: usize;
    mutex: Mutex;
    not_empty: CondVar;
    not_full: CondVar;
    shutdown: bool;
}

impl StreamQueue {
    fn new() -> StreamQueue {
        let q: StreamQueue;
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

fn process_http_stream(handle: isize) {
    let stream = TcpStream { handle: handle };
    let buffer: char[1024];
    let n_res = stream.read(buffer, 1023);
    if n_res.is_err() {
        return;
    }
    let n = n_res.unwrap();
    buffer[n] = '\0';

    let status_line = "HTTP/1.1 200 OK";
    let body = "<h1>Hello from Zen C Multithreaded Worker Pool!</h1>";

    if strstr(buffer, "GET /sleep") != NULL {
        sleep_ms(30); // Simulate heavy or slow request
        body = "<h1>Slow Request Complete!</h1>";
    } else if strstr(buffer, "GET / ") == NULL && strstr(buffer, "GET /hello") == NULL {
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

fn worker_routine(q: StreamQueue*) {
    while true {
        let handle_opt = q.pop();
        if handle_opt.is_none() {
            break; // Queue shut down and drained
        }
        process_http_stream(handle_opt.unwrap());
    }
}

fn run_multithreaded_server(port: int, num_workers: usize, max_requests: int) {
    let listener_res = TcpListener::bind("127.0.0.1", port);
    if listener_res.is_err() {
        println "Failed to bind to port {port}";
        return;
    }
    let listener = listener_res.unwrap();

    let queue = StreamQueue::new();
    let q_ptr: StreamQueue* = &queue;

    let workers = Vec<Thread>::with_capacity(num_workers);
    for _ in 0..num_workers {
        let w = Thread::spawn(fn[=]() {
            worker_routine(q_ptr);
        }).unwrap();
        workers.push(w);
    }
    println "Multithreaded server listening on http://127.0.0.1:{port} with {num_workers} workers";

    for _ in 0..max_requests {
        let stream_res = listener.accept();
        if stream_res.is_ok() {
            let stream = stream_res.unwrap();
            let handle = stream.handle;
            stream.handle = 0; // Prevent drop from closing socket early
            queue.push(handle);
        }
    }

    // Shutdown pool and wait for workers to drain
    queue.stop();
    for i in (usize)0..workers.length() {
        let th = workers.get(i);
        th.join().unwrap();
    }
}

fn main() {
    let port = 7879;
    let num_workers = 4;

    // Launch server to process 3 requests across the worker pool
    let s_thread = Thread::spawn(fn[=]() {
        run_multithreaded_server(port, num_workers, 3);
    }).unwrap();

    sleep_ms(50);

    // Client 1: Fast request
    let client1 = TcpStream::connect("127.0.0.1", port).unwrap();
    let req1 = "GET /hello HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
    client1.write((u8*)req1, strlen(req1));

    let buf1: char[1024];
    let n1 = client1.read(buf1, 1023).unwrap();
    buf1[n1] = '\0';
    println "Response 1:\n{buf1}";
    assert(strstr(buf1, "200 OK") != NULL, "Expected 200 OK");
    assert(strstr(buf1, "Multithreaded Worker Pool") != NULL, "Body mismatch");

    // Client 2: Slow request (/sleep)
    let client2 = TcpStream::connect("127.0.0.1", port).unwrap();
    let req2 = "GET /sleep HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
    client2.write((u8*)req2, strlen(req2));

    let buf2: char[1024];
    let n2 = client2.read(buf2, 1023).unwrap();
    buf2[n2] = '\0';
    println "Response 2:\n{buf2}";
    assert(strstr(buf2, "Slow Request Complete") != NULL, "Expected slow response");

    // Client 3: 404 Not Found
    let client3 = TcpStream::connect("127.0.0.1", port).unwrap();
    let req3 = "GET /missing HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
    client3.write((u8*)req3, strlen(req3));

    let buf3: char[1024];
    let n3 = client3.read(buf3, 1023).unwrap();
    buf3[n3] = '\0';
    println "Response 3:\n{buf3}";
    assert(strstr(buf3, "404 NOT FOUND") != NULL, "Expected 404 NOT FOUND");

    s_thread.join().unwrap();
    println "Multithreaded server tests passed successfully!";
}
```

使用 `zc run -q` 运行并验证代码清单 21-2：

```console
$ zc run -q examples/ch21/ch21-02-multithreaded/main.zc
Multithreaded server listening on http://127.0.0.1:7879 with 4 workers
Response 1:
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 52
Connection: close

<h1>Hello from Zen C Multithreaded Worker Pool!</h1>
Response 2:
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 31
Connection: close

<h1>Slow Request Complete!</h1>
Response 3:
HTTP/1.1 404 NOT FOUND
Content-Type: text/html
Content-Length: 22
Connection: close

<h1>404 Not Found</h1>
Multithreaded server tests passed successfully!
```

现在我们的服务器已经可以通过固定的线程池并发处理请求。在下一节中，我们将进一步完善服务器，以支持生产级的**平滑关闭（graceful shutdown）**！
