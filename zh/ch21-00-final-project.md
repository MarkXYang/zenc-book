# 最终项目：构建多线程 Web 服务器

通读本书，你已经走过了 Zen C 编程语言的广阔图景：
- **基础篇**：无垃圾回收器的内存安全、作为借用的指针、复制与移动语义，以及 RAII 确定性资源清理（`defer` 与 `Drop`）。
- **数据建模与架构**：结构体、方法、通过 `use` 实现的组合、枚举、模式匹配、泛型、Trait 以及智能 Derive。
- **系统工程**：原生操作系统线程（`std/thread.zc`）、同步原语（`std/sync.zc`）、消息传递通道、SIMD 向量化、多语言编译以及底层 C 互操作。

现在，我们将在收官项目中汇聚所有这些概念：**使用纯 Zen C 从零开始构建一个快速、稳健的多线程 HTTP Web 服务器**。

---

## 1. 我们要构建什么

HTTP（超文本传输协议）是现代 Web 的基石协议。每当浏览器、移动应用或命令行工具（`curl`）请求网页或 API 时，它都会打开一个 TCP 连接并发送 HTTP 请求。

我们的 Web 服务器将实现：
1. 使用来自 `std/net/tcp.zc` 的 `TcpListener` 监听 TCP 套接字。
2. 解析传入的 HTTP/1.1 请求（`GET /`、`GET /hello`、`GET /sleep`）。
3. 构建合规的 HTTP/1.1 响应报文（`200 OK`、`404 NOT FOUND`）并带有适当的首部字段（`Content-Type`、`Content-Length`、`Connection: close`）。
4. 使用来自 `std/sync.zc` 的 `Mutex` 和 `CondVar` 将客户端连接分发到持久、有界的**工作线程池**中，防止拒绝服务攻击引起的线程耗尽。
5. 实现干净、零泄漏的**平滑关闭（graceful shutdown）**序列，在不丢失数据的前提下排空处理中的客户端请求并关闭套接字。

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

## 2. 章节组织结构

我们将分四个循序渐进的里程碑来构建该 Web 服务器：

1. **[21.1 构建单线程 Web 服务器](ch21-01-single-threaded.md)**：
   - 在 `127.0.0.1` 上绑定 TCP 套接字。
   - 读取并解析原始 HTTP 请求缓冲区。
   - 格式化并写入状态行、HTTP 首部以及 HTML 响应体。
   - 理解为何单线程服务器在面对慢速请求时会陷入停顿。

2. **[21.2 将单线程服务器改造为多线程服务器](ch21-02-multithreaded.md)**：
   - 设计一个具有有界容量的并发 `StreamQueue`。
   - 使用 `Thread::spawn` 创建常驻工作线程。
   - 在工作线程之间分发请求，避免慢速请求阻塞快速客户端。

3. **[21.3 平滑关闭与资源清理](ch21-03-graceful-shutdown.md)**：
   - 实现协作式取消标志与 `CondVar::broadcast`。
   - 在服务器进程退出前排空正在处理的客户端连接。
   - 通过确定性的 `Drop` 与 `thread.join()` 确保零资源泄漏。

4. **[21.4 扩展服务器：路由、静态文件、计时与 JSON](ch21-04-extending-server.md)**：
   - 添加清晰的路径路由（`GET /`、`/status`、`/static/index.html`、`404`）。
   - 使用 `std/fs.zc` 从磁盘提供静态 HTML 资源服务。
   - 使用 `std/json.zc` 构建 JSON 状态负载，并使用 `std/time.zc` 测量延迟。

让我们从构建单线程原型开始吧！
