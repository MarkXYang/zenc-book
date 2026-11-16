# Polyglot Interoperability: C++, Objective-C, and CUDA

Many systems projects do not exist in isolation. You may need to integrate Zen C algorithms into an existing **C++** game engine, call into Apple **Objective-C** Cocoa frameworks, or offload heavy data processing to an **NVIDIA CUDA** GPU accelerator.

Rather than locking developers into a single backend or requiring fragile manual bindings, `zc` includes dedicated polyglot compiler targets:

- **`--cpp`**: Emits modern C++17 compatible source with proper C++ name-mangling guards (`extern "C"`), `nullptr` mapping, and template drop specializations.
- **`--objc`**: Emits Apple Objective-C compatible source with native Cocoa description mappings.
- **`--cuda`**: Emits NVIDIA CUDA `.cu` code supporting `@global` kernel annotations and CUDA syntax.

---

## 1. C++ Compatibility Mode (`--cpp`)

When integrating Zen C code into C++ codebases (e.g., Unreal Engine, Qt, or existing C++ microservices), transpile with `--cpp`:

```bash
zc transpile main.zc --cpp -o app.cpp
```

### Key Transformations Under `--cpp`:
1. **`NULL` to `nullptr`**: Zen C `NULL` constants map to C++17 `nullptr`, avoiding traditional C integer-to-pointer overload ambiguity.
2. **`extern "C"` Linkage Guards**: Function declarations and exported symbols are wrapped in `extern "C" { ... }` so they link cleanly against existing C++ translation units without name mangling collisions.
3. **Template Drop Overloads**: Instead of C11 `_Generic` macros, automatic cleanup dispatches via C++ template overloads:
   ```cpp
   template<typename T> inline void _z_drop(T& x) { (void)x; }
   template<typename T> inline void _z_drop(T* x) { (void)x; }
   ```

---

## 2. NVIDIA CUDA Mode (`--cuda`)

For GPU accelerated workloads, Zen C allows you to declare GPU kernels using the `@global` attribute:

```zenc
@global
fn vector_add_kernel(a: f32*, b: f32*, c: f32*, n: int) {
    ...
}
```

When transpiling with `zc transpile file.zc --cuda -o kernel.cu`, `zc` emits valid CUDA syntax:

```cpp
__global__ ZC_FUNC void vector_add_kernel(float* a, float* b, float* c, int32_t n) {
    ...
}
```

You can compile the resulting `.cu` file directly with NVIDIA's `nvcc`:

```bash
zc transpile file.zc --cuda -o kernel.cu
nvcc -O3 kernel.cu -o kernel_gpu
```

---

## 3. Apple Objective-C Mode (`--objc`)

On macOS and iOS, system APIs (Foundation, AppKit, UIKit) are written in Objective-C. When you compile with `zc transpile file.zc --objc -o app.m`, `zc` includes `<objc/objc.h>`, `<objc/runtime.h>`, and bridges Zen C string interpolation directly to Objective-C `[object description].UTF8String`.

---

## 4. Complete Example: Listing 20-4

Listing 20-4 defines a 3D vector geometry struct and method, a null pointer check, and verification logic that compiles and runs cleanly across standard Zen C, C++17, and CUDA modes.

**Listing 20-4**: Polyglot interoperability (`examples/ch20/ch20-04-cpp-objc-cuda/main.zc`)

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

Run and verify Listing 20-4 natively:

```console
$ zc run -q examples/ch20/ch20-04-cpp-objc-cuda/main.zc
Polyglot Interoperability in Zen C (C++, Objective-C, CUDA)
v1 . v2 dot product = 32.000000
Pointer null check passed (emits nullptr in C++)
Polyglot verification successful!
```

You can verify that the C++ output compiles with `g++`:

```bash
zc transpile examples/ch20/ch20-04-cpp-objc-cuda/main.zc --cpp -o /tmp/app.cpp
g++ -std=c++17 -fsyntax-only /tmp/app.cpp
```

---

## Summary

- Use `--cpp` to emit C++17 translation units with `nullptr`, `extern "C"` bindings, and template drops.
- Use `--cuda` to generate `.cu` files compatible with NVIDIA's `nvcc` compiler, using `@global` to annotate GPU kernels.
- Use `--objc` to interface smoothly with macOS and iOS Cocoa runtimes.
- Zen C allows you to share high-performance algorithmic modules across multi-language production codebases.
