# Zen C 程序设计语言（教程指南）

[Zen C (`zenc`)](https://www.zenc-lang.org/) 官方教程与实战指南 —— Zen C 是一种现代系统编程语言，可直接转译为纯净的 GNU C11，且零运行时开销。

本书遵循《Rust 权威指南》（The Rust Book）的组织架构编写。

---

## 目录

- [介绍](ch00-00-introduction.md)
- [第 1 章：入门](ch01-00-getting-started.md)
  - [1.1 安装](ch01-01-installation.md)
  - [1.2 Hello, World!](ch01-02-hello-world.md)
  - [1.3 Hello, zc!](ch01-03-hello-zc.md)
- [完整目录（20 章）](SUMMARY.md)

---

## 代码示例

基于系统安装的 `zc v0.4.4` 进行测试：

```bash
# Run Hello World example
zc run examples/ch01/hello_world/main.zc

# Build standalone binary
zc build examples/ch01/hello_world/main.zc -o hello

# Inspect transpiled GNU C11 source
zc transpile examples/ch01/hello_world/main.zc -o main.c
```

---

## 许可证

MIT 与 Apache 2.0 双重许可证。
