# 资源嵌入（`embed`）与编译器插件

系统级工具通常需要在一个自包含的二进制文件中打包静态资源——SQL 模式（schema）、着色器（shader）、HTML 模板或版本标语（banner）。Zen C 在语言层面通过 `embed` 直接支持该功能，并允许你使用原生编译器插件扩展转译器本身。

## 使用 `embed` 在编译期嵌入文件

`embed` 表达式在编译期间读取文件，并将其内容作为静态数据烘焙进生成的 C 源码中：

- `embed "path"` 返回一个原始字节切片（`{ data, len }`）。
- `embed "path" as string` 将内容嵌入为以 null 结尾的 `string`。
- `embed "path" as u8[N]` 将内容嵌入到长度为 `N` 的固定大小字节数组中。

请注意，`embed` 解析文件路径时，是相对于调用 `zc` 的当前工作目录（CWD）计算的。

```zenc
// File: examples/ch19/ch19-03-embed-plugins/main.zc

fn main() {
    println "Testing Asset Embedding (embed)...";

    // Embed as a compile-time string literal (path is relative to build CWD)
    let banner = embed "examples/ch19/ch19-03-embed-plugins/banner.txt" as string;
    println "Embedded string: {banner}";

    // Embed as a raw byte slice ({ data, len })
    let raw_bytes = embed "examples/ch19/ch19-03-embed-plugins/banner.txt";
    println "Embedded raw slice len = {raw_bytes.len}";
    assert(raw_bytes.len > 0, "Embedded slice must not be empty");

    // Embed into a fixed-size byte array (u8[41])
    let fixed = embed "examples/ch19/ch19-03-embed-plugins/banner.txt" as u8[41];
    assert(fixed[0] == 'Z', "First byte must be 'Z'");
    assert(fixed[4] == 'C', "Fifth byte must be 'C'");

    println "All embed checks passed!";
}
```

<span class="caption">代码清单 19-3：将静态资源嵌入为 `string`、原始字节切片以及固定大小的 `u8[N]` 数组</span>

## 通过编译器插件扩展转译器

当 `comptime` 字符串生成无法满足需求时——例如，当你希望直接在 `.zc` 文件内嵌入整套领域特定语言（DSL，如 SQL、Lisp 或 Forth）时——Zen C 支持通过动态共享库（`.so`）实现**原生编译器插件**。

插件宿主接口在 `plugins/zprep_plugin.h`（`ZEN_PLUGIN_API_VERSION = 2`）中定义：

- 插件实现 `ZPluginTranspileFn`：`void transpile(const char *input_body, const ZApi *api)`。
- `ZApi` 结构体使插件能够访问 `api->out`（内联 C 输出流）、`api->hoist_out`（文件作用域/头文件 C 输出流）、诊断功能（`api->error`、`api->warn`、`api->note`）以及构建元数据（`api->config.target`、`api->config.cc`）。
- 插件还可以选择提供 LSP 悬停处理器，以便 IDE 用户在悬停于 DSL 代码块上方时获得丰富的文档提示。

Zen C 仓库在 `plugins/` 下提供了示例插件（包括 `sql.zc`、`lisp.zc`、`forth.zc`、`brainfuck.zc` 和 `befunge.zc`），展示了如何在编译期将自定义语法块降级转换为 C 代码。

> ### 🔍 窥探底层 C 代码
>
> `embed "file" as u8[N]` 表达式会降级为一个静态 C 字节数组，使用该文件的精确十六进制字节进行初始化（`static const unsigned char _embed_0[41] = { 0x5a, ... };`）。这里完全没有运行时的 `fopen`，没有外部文件依赖，也没有任何启动期内存分配。
