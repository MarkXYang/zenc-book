# 多语言互操作：C++、Objective-C 与 CUDA

许多系统项目并非孤立存在。你可能需要将 Zen C 算法集成到现有的 **C++** 游戏引擎中，调用 Apple **Objective-C** Cocoa 框架，或者将繁重的数据处理卸载到 **NVIDIA CUDA** GPU 加速器上。

`zc` 没有将开发者局限在单一后端，也没有要求编写脆弱的手动绑定，而是包含了专门的多语言编译器目标：

- **`--cpp`**：生成兼容现代 C++17 的源代码，具备适当的 C++ 名称修饰防范（`extern "C"`）、`nullptr` 映射以及模板析构特化。
- **`--objc`**：生成兼容 Apple Objective-C 的源代码，具有原生 Cocoa 描述映射。
- **`--cuda`**：生成支持 `@global` 核函数注解和 CUDA 语法的 NVIDIA CUDA `.cu` 代码。

---

## 1. C++ 兼容模式（`--cpp`）

当将 Zen C 代码集成到 C++ 代码库（例如虚幻引擎、Qt 或现有 C++ 微服务）中时，可以使用 `--cpp` 进行转译：

```bash
zc transpile main.zc --cpp -o app.cpp
```

### `--cpp` 下的核心转换：
1. **`NULL` 转换为 `nullptr`**：Zen C 的 `NULL` 常量映射为 C++17 的 `nullptr`，避免了传统 C 中整数到指针重载的二义性。
2. **`extern "C"` 链接保护**：函数声明和导出的符号被包裹在 `extern "C" { ... }` 中，因此它们可以干净地与现有的 C++ 翻译单元链接，而不会发生名称修饰（name mangling）冲突。
3. **模板 Drop 重载**：使用 C++ 模板重载分发自动清理，而非 C11 的 `_Generic` 宏：
   ```cpp
   template<typename T> inline void _z_drop(T& x) { (void)x; }
   template<typename T> inline void _z_drop(T* x) { (void)x; }
   ```

---

## 2. NVIDIA CUDA 模式（`--cuda`）

对于 GPU 加速工作负载，Zen C 允许你使用 `@global` 属性声明 GPU 核函数：

```zenc
@global
fn vector_add_kernel(a: f32*, b: f32*, c: f32*, n: int) {
    ...
}
```

使用 `zc transpile file.zc --cuda -o kernel.cu` 转译时，`zc` 会输出合法的 CUDA 语法：

```cpp
__global__ ZC_FUNC void vector_add_kernel(float* a, float* b, float* c, int32_t n) {
    ...
}
```

你可以直接使用 NVIDIA 的 `nvcc` 编译生成的 `.cu` 文件：

```bash
zc transpile file.zc --cuda -o kernel.cu
nvcc -O3 kernel.cu -o kernel_gpu
```

---

## 3. Apple Objective-C 模式（`--objc`）

在 macOS 和 iOS 上，系统 API（Foundation、AppKit、UIKit）都是使用 Objective-C 编写的。当你使用 `zc transpile file.zc --objc -o app.m` 进行编译时，`zc` 会包含 `<objc/objc.h>`、`<objc/runtime.h>`，并将 Zen C 的字符串插值直接桥接到 Objective-C 的 `[object description].UTF8String`。

---

## 4. 完整示例：代码清单 20-4

代码清单 20-4 定义了一个 3D 向量几何结构体及其方法、空指针检查以及验证逻辑，这些代码可以在标准 Zen C、C++17 和 CUDA 模式下干净地编译和运行。

**代码清单 20-4**：多语言互操作（`examples/ch20/ch20-04-cpp-objc-cuda/main.zc`）

```zenc
// File: examples/ch20/ch20-04-cpp-objc-cuda/main.zc
//
// Demonstrates writing polyglot-compatible Zen C code that can be:
// 1. Compiled and run natively: zc run -q main.zc
// 2. Transpiled to C++17:       zc transpile main.zc --cpp -o app.cpp
// 3. Transpiled to Objective-C: zc transpile main.zc --objc -o app.m
// 4. Transpiled to CUDA:        zc transpile main.zc --cuda -o app.cu

struct Vector3 {
    x: f32;
    y: f32;
    z: f32;
}

impl Vector3 {
    fn new(x: f32, y: f32, z: f32) -> Vector3 {
        return Vector3 { x: x, y: y, z: z };
    }

    fn dot(self, other: Vector3) -> f32 {
        return (self.x * other.x) + (self.y * other.y) + (self.z * other.z);
    }
}

// In polyglot mode:
// - Under C++ (--cpp), NULL expands to nullptr and drops use C++ template overloads
// - Under CUDA (--cuda), functions can target device kernels
// - Under Objective-C (--objc), C-compatible structs and methods interoperate directly
fn test_pointer_interop() -> bool {
    let p: int* = NULL;
    return p == NULL;
}

fn main() {
    println "Polyglot Interoperability in Zen C (C++, Objective-C, CUDA)";

    let v1 = Vector3::new(1.0, 2.0, 3.0);
    let v2 = Vector3::new(4.0, 5.0, 6.0);
    let d = v1.dot(v2);

    println "v1 . v2 dot product = {d}";
    assert(d == 32.0, "Dot product should be 32.0");

    let is_null = test_pointer_interop();
    assert(is_null, "Pointer null check must succeed");
    println "Pointer null check passed (emits nullptr in C++)";

    println "Polyglot verification successful!";
}
```

在原生环境下运行并验证代码清单 20-4：

```console
$ zc run -q examples/ch20/ch20-04-cpp-objc-cuda/main.zc
Polyglot Interoperability in Zen C (C++, Objective-C, CUDA)
v1 . v2 dot product = 32.000000
Pointer null check passed (emits nullptr in C++)
Polyglot verification successful!
```

你可以验证 C++ 输出是否可以通过 `g++` 编译：

```bash
zc transpile examples/ch20/ch20-04-cpp-objc-cuda/main.zc --cpp -o /tmp/app.cpp
g++ -std=c++17 -fsyntax-only /tmp/app.cpp
```

---

## 本节小结

- 使用 `--cpp` 生成带有 `nullptr`、`extern "C"` 绑定和模板析构的 C++17 翻译单元。
- 使用 `--cuda` 生成与 NVIDIA 的 `nvcc` 编译器兼容的 `.cu` 文件，使用 `@global` 注解 GPU 核函数。
- 使用 `--objc` 与 macOS 和 iOS Cocoa 运行时平滑对接。
- Zen C 允许你在多语言生产代码库之间共享高性能的算法模块。
