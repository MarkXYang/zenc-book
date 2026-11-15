# 循环依赖防范

## 6. 编译期循环依赖检测

模块之间的循环依赖会导致脆弱的耦合、初始化顺序错误以及编译变慢。

`zc` 编译器在编译期间维护一个活跃的导入跟踪栈。如果模块 `A` 导入了模块 `B`，而模块 `B` 又尝试导入模块 `A`，编译器会立即停止并给出清晰的诊断信息：

```text
error: Circular import detected: '/path/to/module_a.zc'
```

这种严格性确保了你的软件架构保持清晰、具备层次感且无环。

### 如何打破循环依赖

如果两个模块 `a.zc` 和 `b.zc` 确实需要引用共享的类型或常量：

1. **将共享类型提取到更低层级的模块中**（例如 `types.zc` 或 `models.zc`），该底层模块不反向依赖于 `a.zc` 或 `b.zc`，以便两者都能干净地导入 `types.zc`。
2. **使用 `trait` 反转依赖**：在低层级模块中定义一个 `trait`，并在高层级模块中实现它，而不是让低层级模块去导入调用方。

---

## 标准项目布局与 `ZC_ROOT`

Zen C 项目通常将其代码组织成标准的目录布局：

```text
my_project/
├── main.zc
├── src/
│   ├── mod.zc
│   ├── network.zc
│   └── models.zc
└── tests/
    └── test_main.zc
```

编译器通过 `ZC_ROOT` 环境变量或其编译内置的安装前缀来定位标准库模块（例如 `std/vec.zc` 和 `std/fs.zc`）：

```bash
export ZC_ROOT=/home/mark/code/Zen-C
zc run main.zc
```

将应用程序的入口点（`main.zc`）保留在依赖有向无环图（DAG）的最顶层，将 `src/models.zc` 保留在最底层，并让 `tests/` 导入 `src/`，可以保证永远不会发生循环导入。
