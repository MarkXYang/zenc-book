# 目录模块与重新导出

## 4. 目录模块（`mod.zc`）

随着项目的增长，相关的功能通常会被归组到文件夹中。Zen C 使用 `mod.zc` 惯例来支持**目录模块**（类似于 Rust 的 `mod.rs` 或 Python 的 `__init__.py`）。

考虑以下项目目录结构：

```text
my_project/
├── main.zc
└── network/
    ├── mod.zc
    ├── packet.zc
    └── socket.zc
```

在 `network/mod.zc` 内部，我们定义 `network` 模块的公开接口并导入其内部子模块：

```zenc
// network/mod.zc
import "./packet.zc" as packet;

def DEFAULT_PORT = 8080;

fn connect(host: string, port: int) {
    println "Connecting to {host}:{port}...";
}
```

在 `main.zc` 中，你可以直接导入整个 `network` 文件夹：

**代码清单 7-6：`list7-6.zc`**

```zenc
 1 | // main.zc
 2 | import "./network";
 3 |
 4 | fn main() {
 5 |     connect("127.0.0.1", DEFAULT_PORT);
 6 | }
```

输出：
```text
Connecting to 127.0.0.1:8080...
```

或者使用显式命名空间导入该目录模块：

**代码清单 7-7：`list7-7.zc`**

```zenc
 1 | // main.zc
 2 | import "network/mod.zc" as net;
 3 |
 4 | fn main() {
 5 |     net::connect("127.0.0.1", net::DEFAULT_PORT);
 6 | }
```

输出：
```text
Connecting to 127.0.0.1:8080...
```

### 重新导出模块（`export import`）

模块可以使用 `export import` 重新导出另一个模块或子模块：

```zenc
// network/mod.zc
export import "./packet.zc" as packet;
export import "./socket.zc" as socket;
```

现在，任何导入 `network` 的使用者都可以通过 `network` 命名空间访问 `packet` 和 `socket`，而无需了解 `network/` 内部的文件布局。

### 设计清晰的模块边界

在多文件 Zen C 应用程序中组织目录模块时：

1. **保持 `mod.zc` 作为门面（facade）**：仅重新导出调用方所需的公开类型和入口点，同时将辅助工具保留在私有子模块中。
2. **在包内部使用相对路径**：在 `network/mod.zc` 中，编写 `import "./packet.zc"`，而不是硬编码来自仓库根目录的路径，从而使目录模块保持自包含。
3. **避免全局重新导出 C 头文件**：将 `include <...>` 语句保留在实际包装那些 C API 的 `.zc` 文件内部。

---
