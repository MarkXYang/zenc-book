# 21.3 Graceful Shutdown and Cleanup

In production systems, servers must shut down cleanly during rolling updates, configuration reloads, or when receiving OS termination signals (`SIGINT`, `SIGTERM`).

Abruptly terminating a server with `kill -9` or immediate `exit(0)` causes severe real-world problems:
- In-flight database transactions are aborted mid-write.
- Active HTTP clients receive broken TCP resets (`ECONNRESET`) rather than completed responses.
- Open files, sockets, and memory buffers are abandoned without deterministic RAII cleanup.

In this final section, we complete our web server project by implementing **graceful shutdown**: stopping incoming requests, signaling all worker threads to drain pending jobs, and waiting for all workers to finish cleanly before exiting.

---

## 1. Cooperative Shutdown Architecture

Graceful shutdown requires coordination across three components:

1. **The Shutdown Flag (`shutdown: bool`)**: Protected by a `Mutex`, this atomic or synchronized flag signals when the server has entered termination mode.
2. **Condition Variable Broadcast (`CondVar::broadcast`)**: Idle worker threads are sleeping on `not_empty.wait(&mutex)`. When `stop()` is called, setting `shutdown = true` and calling `not_empty.broadcast()` wakes **all** sleeping workers simultaneously.
3. **Queue Draining**: Woken workers verify whether the queue has remaining connection handles:
   - If jobs remain in the queue, workers finish processing them.
   - Once `count == 0` and `shutdown == true`, workers break out of their loop and terminate cleanly.
4. **Thread Joining (`thread.join()`)**: The main thread iterates over all worker handles and calls `th.join().unwrap()`, ensuring all operating system threads have exited before process teardown.

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

## 2. RAII Cleanup with `Drop`

In Zen C, `TcpStream` and `TcpListener` implement `Drop`:

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

When a worker completes `handle_connection(stream)` or when the listener exits scope, the compiler automatically invokes `drop()`, closing the operating-system socket file descriptor. Combining automatic `Drop` with `thread.join()` guarantees **zero socket leaks and zero memory leaks**.

---

## 3. Complete Example: Listing 21-3

Listing 21-3 encapsulates the listener, bounded task queue, worker threads, and thread-safe transaction counters into a cohesive `GracefulServer` struct.

**Listing 21-3**: `list21-3.zc` — Graceful shutdown and cleanup (`examples/ch21/ch21-03-graceful-shutdown/main.zc`)

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

Run and verify Listing 21-3:

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

## 4. Congratulations!

By completing this capstone project, you have constructed a production-grade, concurrent systems service from the ground up:
- You built raw TCP networking using standard sockets.
- You implemented HTTP protocol parsing and response generation.
- You constructed a zero-allocation, bounded concurrent work queue with `Mutex` and dual `CondVar` backpressure.
- You coordinated a persistent pool of native operating-system worker threads.
- You implemented deterministic, clean graceful shutdown without dropped requests or resource leaks.

You have mastered the principles, syntax, idioms, and systems power of **The Zen C Programming Language**. You are now equipped to build fast, reliable, and secure software at scale!
