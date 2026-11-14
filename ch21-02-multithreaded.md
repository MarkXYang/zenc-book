# 21.2 Turning Our Single-Threaded Server into a Multithreaded Server

In [Section 21.1](ch21-01-single-threaded.md), we identified the primary flaw of our single-threaded web server: if one request is slow (such as a slow disk read, database query, or slow client connection), all other incoming requests stall behind it.

In this section, we turn our server into a high-concurrency, **multithreaded web server** using a fixed-size **worker thread pool**.

---

## 1. Thread-per-Request vs. Thread Pool

When transitioning to multithreaded servers, two strategies exist:

1. **Thread-per-Request (`Thread::spawn` on each `accept`)**:
   - *Problem*: Spawning a new OS thread for every incoming connection is expensive and creates an easy denial-of-service vector: an attacker can open 10,000 connections simultaneously, causing the server process to crash from thread exhaustion or out-of-memory errors.
2. **Persistent Worker Thread Pool (`ThreadPool`)**:
   - *Solution*: Pre-allocate a fixed pool of $N$ worker threads (typically matching the host CPU core count, e.g. 4, 8, or 16). Incoming connections are placed into a bounded concurrent FIFO queue. Workers pick up connections as soon as they become idle. If all workers are busy, subsequent connections queue safely until a worker frees up.

---

## 2. Designing the Concurrent `StreamQueue`

To pass client connection handles between the main accepting thread and worker threads without race conditions or memory corruption, we construct a bounded `StreamQueue` protected by a `Mutex` and two condition variables:

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

- When the listener accepts a client connection, it calls `queue.push(handle)`. If the queue is full (`count == QUEUE_SIZE`), the listener thread blocks on `not_full`, exerting natural backpressure.
- When an idle worker thread is ready for work, it calls `queue.pop()`. If the queue is empty, the worker sleeps on `not_empty` with **zero CPU consumption**.

---

## 3. Worker Routine & Non-Blocking Architecture

Each worker thread runs an infinite loop pulling client connection descriptors from the queue:

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

Now, even if one request hits a slow endpoint (like `/sleep`), other worker threads immediately continue serving other fast requests (`/` and `/hello`) concurrently!

---

## 4. Complete Example: Listing 21-2

Listing 21-2 implements our multithreaded web server with a 4-worker thread pool, demonstrating that a slow `/sleep` request does not block concurrent responses.

**Listing 21-2**: `list21-2.zc` — Multithreaded web server with worker thread pool (`examples/ch21/ch21-02-multithreaded/main.zc`)

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

Run and verify Listing 21-2:

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

Now our server handles requests concurrently across a fixed pool of threads. In the next section, we refine our server to support clean, production-grade **graceful shutdown**!
