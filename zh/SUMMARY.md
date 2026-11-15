# Summary

[Zen C 程序设计语言](ch00-00-introduction.md)

# 第一部分 — 基础概念

- [入门](ch01-00-getting-started.md)
    - [安装](ch01-01-installation.md)
    - [Hello, World!](ch01-02-hello-world.md)
    - [Hello, zc!](ch01-03-hello-zc.md)

- [编写猜数游戏](ch02-00-guessing-game-tutorial.md)

- [通用编程概念](ch03-00-common-programming-concepts.md)
    - [变量与常量](ch03-01-variables-and-constants.md)
    - [数据类型](ch03-02-data-types.md)
    - [函数](ch03-03-functions.md)
    - [注释、打印与字符串插值](ch03-04-printing-and-interpolation.md)
    - [控制流](ch03-05-control-flow.md)

- [所有权、指针与资源清理](ch04-00-ownership-pointers-cleanup.md)
    - [栈、堆与移动语义](ch04-01-move-semantics.md)
    - [借用指针](ch04-02-pointers.md)
    - [切片](ch04-03-slices.md)
    - [确定性清理：defer 与 Drop](ch04-04-cleanup.md)

- [结构体与组合](ch05-00-structs.md)
    - [定义与实例化结构体](ch05-01-defining-structs.md)
    - [使用结构体的示例程序](ch05-02-example-structs.md)
    - [方法语法](ch05-03-method-syntax.md)
    - [使用 use 进行组合](ch05-04-composition.md)

- [枚举与模式匹配](ch06-00-enums.md)
    - [定义枚举](ch06-01-defining-an-enum.md)
    - [match 结构](ch06-02-match.md)
    - [模式与解构](ch06-03-patterns.md)

# 第二部分 — 构建实际程序

- [模块与多文件项目](ch07-00-modules.md)
    - [模块与导入](ch07-01-modules-and-imports.md)
    - [目录模块与重新导出](ch07-02-directory-modules.md)
    - [使用 opaque 实现封装](ch07-03-encapsulation.md)
    - [防止循环依赖](ch07-04-circular-dependencies.md)

- [常用集合](ch08-00-common-collections.md)
    - [动态数组 (Vec)](ch08-01-vectors.md)
    - [字符串](ch08-02-strings.md)
    - [哈希映射与哈希集合](ch08-03-hash-maps.md)

- [错误处理](ch09-00-error-handling.md)
    - [使用 panic 处理不可恢复的错误](ch09-01-panic.md)
    - [使用 Result 和 Option 处理可恢复的错误](ch09-02-option-and-result.md)
    - [在错误路径上使用 defer 清理资源](ch09-03-defer-cleanup.md)
    - [桥接 C 返回码与 errno](ch09-04-c-errors.md)
    - [何时使用 panic](ch09-05-panic-guidelines.md)

- [泛型、Trait 与运算符重载](ch10-00-generics-and-traits.md)
    - [泛型数据类型](ch10-01-generic-data-types.md)
    - [Trait：定义共享行为](ch10-02-traits.md)
    - [标准 Trait 与智能 Derive](ch10-03-standard-traits.md)
    - [运算符重载](ch10-04-operator-overloading.md)

- [编写自动化测试与调试](ch11-00-testing.md)
    - [如何编写测试](ch11-01-writing-tests.md)
    - [使用 zc 运行测试](ch11-02-running-tests.md)
    - [使用 GDB、LLDB 和 VS Code 进行调试](ch11-03-debugging.md)

- [使用 C 语言库](ch12-00-using-c-libraries.md)
    - [C 头文件导入与包含](ch12-01-c-headers.md)
    - [显式 FFI 声明](ch12-02-ffi-declarations.md)
    - [C 类型、字符串与变长参数](ch12-03-c-types-variadics.md)
    - [链接与构建指令](ch12-04-linking-directives.md)
    - [实战示例：Raylib 图形窗口](ch12-05-raylib-example.md)

- [I/O 项目：构建 zgrep](ch13-00-cli-project.md)
    - [接收命令行参数](ch13-01-cli-arguments.md)
    - [读取文件](ch13-02-reading-file.md)
    - [重构以提高模块化与错误处理能力](ch13-03-refactoring.md)
    - [使用环境变量](ch13-04-env-variables.md)
    - [将错误信息写入标准错误](ch13-05-stderr.md)

# 第三部分 — 进阶探索

- [函数式特性：闭包与迭代器](ch14-00-functional-features.md)
    - [Lambda 表达式与闭包捕获](ch14-01-lambdas.md)
    - [原始函数指针 (fn*)](ch14-02-fn-pointers.md)
    - [使用迭代器处理元素序列](ch14-03-iterators.md)
    - [性能比较：循环 vs 迭代器](ch14-04-performance.md)

- [zc 工具链与编译器后端](ch15-00-toolchain.md)
    - [配置编译器后端](ch15-01-compiler-backends.md)
    - [查看生成的 C 代码与名称修饰](ch15-02-generated-c.md)
    - [真正可移植的可执行文件 (APE)](ch15-03-portable-ape.md)
    - [开发者工具：zc-doc、zc-format、REPL 与 LSP](ch15-04-developer-tooling.md)

- [高级内存管理](ch16-00-advanced-memory-management.md)
    - [原始指针与不安全操作](ch16-01-raw-pointers.md)
    - [Arena 内存分配器](ch16-02-arenas.md)
    - [底层结构体布局：位域、打包与对齐](ch16-03-struct-layout.md)
    - [无标签联合体 (Untagged Unions)](ch16-04-unions.md)

- [并发编程](ch17-00-concurrency.md)
    - [使用线程同时运行代码](ch17-01-threads.md)
    - [共享状态并发：Mutex 与原子操作](ch17-02-mutex-sync.md)
    - [使用队列进行消息传递](ch17-03-message-passing.md)
    - [异步工作线程池](ch17-04-worker-pools.md)

- [多态：组合与 Trait 对象](ch18-00-polymorphism.md)
    - [Zen C 的面向对象特性](ch18-01-oop-characteristics.md)
    - [用于动态分发的 Trait 对象](ch18-02-trait-objects.md)
    - [C11 底层虚表 (Vtable) 机制](ch18-03-vtables-in-c.md)
    - [实现面向对象设计模式](ch18-04-oop-patterns.md)

- [元编程与编译期求值](ch19-00-metaprogramming.md)
    - [编译期执行 (comptime)](ch19-01-comptime.md)
    - [属性与智能 Derive](ch19-02-attributes-derives.md)
    - [资源嵌入 (@embed) 与编译器插件](ch19-03-embed-plugins.md)
    - [条件编译与泛型 C 宏](ch19-04-conditional-macros.md)

- [系统编程与安全关键编程](ch20-00-systems.md)
    - [内联汇编与 volatile](ch20-01-inline-assembly.md)
    - [原生 SIMD 向量化](ch20-02-simd.md)
    - [MISRA C:2012 合规模式](ch20-03-misra-mode.md)
    - [多语言互操作：C++、Objective-C 与 CUDA](ch20-04-cpp-objc-cuda.md)
    - [在 C 程序中嵌入 Zen C](ch20-05-embedding-zc.md)

- [最终项目：构建多线程 Web 服务器](ch21-00-final-project.md)
    - [构建单线程 Web 服务器](ch21-01-single-threaded.md)
    - [将单线程服务器改造为多线程服务器](ch21-02-multithreaded.md)
    - [优雅停机与资源清理](ch21-03-graceful-shutdown.md)
    - [扩展服务器：路由、静态文件、计时与 JSON](ch21-04-extending-server.md)

# 附录

- [附录 A：关键字](appendix-01-keywords.md)
- [附录 B：运算符与语法糖](appendix-02-operators.md)
- [附录 C：Zen C 标准库全览](appendix-03-std-tour.md)
- [附录 D：开发工具与编辑器](appendix-04-dev-tools.md)
- [附录 E：MISRA C 合规规则参考](appendix-05-misra-rules.md)
- [附录 F：面向 C 与 Rust 程序员的 Zen C 速查表](appendix-06-cheatsheet.md)
- [附录 G：诊断信息与编译器选项](appendix-07-diagnostics.md)
- [附录 H：迁移旧版 Zen C 代码](appendix-08-migration.md)
