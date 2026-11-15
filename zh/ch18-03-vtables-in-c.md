# 18.3 C11 底层虚表（Vtable）机制

Zen C 是如何在纯 C11 中实现动态分发，而无需任何 C++ 运行时库（`libstdc++`）或隐藏的每对象 `vptr` 头部开销的？

让我们仔细检查 `zc transpile` 为由 `Circle` 和 `Rectangle` 实现的 `Shape` trait 所生成的精确 C11 代码。

---

## 1. 胖指针与侵入式 C++ `vptr` 的对比

系统级语言表示对对象的多态引用有两种经典方式：

1. **侵入式对象 `vptr`（C++、Java）**：拥有 `virtual` 方法的类的每一个实例，都会在对象自身的字节偏移量 `0` 处存储一个 8 字节的隐藏 `vptr` 指针。
   - *缺陷*：一个 `Circle { radius: int }` 会从 **4 字节膨胀到 16 字节**（8 字节的 `vptr` + 4 字节的 `int` + 4 字节对齐填充）——对于由一百万个圆组成的数组而言，这会带来 **4 倍的内存膨胀**，哪怕你从未对该数组使用过动态分发！更糟糕的是，隐藏的 `vptr` 破坏了与 C 结构体的二进制兼容性。
2. **外部胖指针（Zen C、Rust、Go）**：具体结构体保持 100% 的纯 C 结构体形态，具有**零隐藏字段**（`sizeof(Circle) == 4` 字节）。当你创建一个 trait 对象时（`let s: Shape = &c1;`），`vtable` 指针与 `self` 数据指针一起存储在 **16 字节的 `Shape` 胖指针**内部：

```
Stack Concrete Structs (0 hidden bytes)        Shape Fat Pointer (16 bytes)        Static Read-Only Data
+------------------------+                    +---------------------------+       +----------------------------------+
| c1: Circle             | <----------------- | self:   &c1       (8 B)   |       | Circle__Shape__VTable            |
|   radius: 10   (4 B)   |                    | vtable: ------------------------+>|   area_x100      -> Circle__...  |
+------------------------+                    +---------------------------+     | |   perimeter_x100 -> Circle__...  |
                                                                                | +----------------------------------+
+------------------------+                    +---------------------------+     |
| c2: Circle             | <----------------- | self:   &c2       (8 B)   |     |
|   radius: 5    (4 B)   |                    | vtable: ------------------------+
+------------------------+                    +---------------------------+
```

---

## 2. 🔍 窥探底层 C 代码：生成的 VTable 与分发垫片（Dispatch Shims）

当 `zc transpile` 处理 `trait Shape` 及其在 `Circle` 和 `Rectangle` 上的实现时，它会生成四个清晰的 C11 构造：

```c
// 1. The VTable struct holding one function pointer per trait method
typedef struct Shape_VTable {
    int32_t (*area_x100)(void* self);
    int32_t (*perimeter_x100)(void* self);
} Shape_VTable;

// 2. The 16-byte fat pointer representing a `Shape` trait object
typedef struct Shape {
    void *self;
    Shape_VTable *vtable;
} Shape;

// 3. Inline dispatch shims called when you write `s.area_x100()`
int32_t Shape__area_x100(Shape* self) {
    return self->vtable->area_x100(self->self);
}

int32_t Shape__perimeter_x100(Shape* self) {
    return self->vtable->perimeter_x100(self->self);
}

// 4. Static global VTable instances—one per `(Struct, Trait)` pair
Shape_VTable Circle__Shape__VTable = {
    .area_x100      = (__typeof__(((Shape_VTable*)0)->area_x100))Circle__Shape__area_x100,
    .perimeter_x100 = (__typeof__(((Shape_VTable*)0)->perimeter_x100))Circle__Shape__perimeter_x100
};

Shape_VTable Rectangle__Shape__VTable = {
    .area_x100      = (__typeof__(((Shape_VTable*)0)->area_x100))Rectangle__Shape__area_x100,
    .perimeter_x100 = (__typeof__(((Shape_VTable*)0)->perimeter_x100))Rectangle__Shape__perimeter_x100
};
```

而当你编写 `let s_c1: Shape = &c1;` 时，生成的 C11 会在一个复合字面量中初始化该胖指针：

```c
Shape s_c1 = (Shape){
    .self   = (void*)&c1,
    .vtable = &Circle__Shape__VTable
};
```

---

## 3. 完整示例：在运行时验证结构体大小与虚表共享

示例 18-3 在运行中的 Zen C 代码中验证了这两项架构保证：
1. `sizeof(Circle)` 为 **4 字节**，`sizeof(Rectangle)` 为 **8 字节**（具体结构体上零 `vptr` 开销），而 `sizeof(Shape)` 为 **16 字节**（两个 8 字节指针）。
2. 通过检查 `s_c1`、`s_c2` 和 `s_r1` 的原始 `{ self_ptr, vtable_ptr }` 字，我们验证了 `s_c1` 和 `s_c2` 指向不同的 `.self` 地址（`&c1` 与 `&c2`），同时共享**完全相同**的静态 `Circle__Shape__VTable` 地址，而 `s_r1` 则指向 `Rectangle__Shape__VTable`。

**示例 18-3**：检查胖指针布局与虚表共享（`examples/ch18/ch18-03-vtables-in-c/main.zc`）

```zenc
// File: examples/ch18/ch18-03-vtables-in-c/main.zc

trait Shape {
    fn area_x100(self) -> int;
    fn perimeter_x100(self) -> int;
}

struct Circle {
    radius: int;
}

impl Shape for Circle {
    fn area_x100(self) -> int {
        return 314 * self.radius * self.radius;
    }

    fn perimeter_x100(self) -> int {
        return 628 * self.radius;
    }
}

struct Rectangle {
    width: int;
    height: int;
}

impl Shape for Rectangle {
    fn area_x100(self) -> int {
        return 100 * self.width * self.height;
    }

    fn perimeter_x100(self) -> int {
        return 200 * (self.width + self.height);
    }
}

// Mirror of the 16-byte `{ void* self, void* vtable }` fat pointer emitted by `zc`
struct RawFatPointer {
    self_ptr: usize;
    vtable_ptr: usize;
}

fn inspect_fat_pointer(s: Shape) -> RawFatPointer {
    let raw_ptr: RawFatPointer* = (RawFatPointer*)&s;
    return *raw_ptr;
}

fn main() {
    let c1 = Circle { radius: 10 };
    let c2 = Circle { radius: 5 };
    let r1 = Rectangle { width: 4, height: 6 };

    // 1. Zero per-instance vptr overhead on concrete structs
    let sz_circle = sizeof(Circle);
    let sz_rect = sizeof(Rectangle);
    let sz_shape = sizeof(Shape);
    println "sizeof(Circle)    = {sz_circle} bytes (only `radius: int`, no hidden vptr!)";
    println "sizeof(Rectangle) = {sz_rect} bytes (only `width` + `height`, no hidden vptr!)";
    println "sizeof(Shape)     = {sz_shape} bytes (two 8-byte pointers: `self` + `vtable`)";

    assert(sz_circle == 4, "Circle has no vptr overhead (4 bytes)");
    assert(sz_rect == 8, "Rectangle has no vptr overhead (8 bytes)");
    assert(sz_shape == 16, "Shape trait object is a 16-byte fat pointer on 64-bit");

    // 2. Inspecting the `{ self, vtable }` pointers inside three `Shape` trait objects
    let s_c1: Shape = &c1;
    let s_c2: Shape = &c2;
    let s_r1: Shape = &r1;

    let fp_c1 = inspect_fat_pointer(s_c1);
    let fp_c2 = inspect_fat_pointer(s_c2);
    let fp_r1 = inspect_fat_pointer(s_r1);

    assert(fp_c1.self_ptr == (usize)&c1, "s_c1.self must point to &c1");
    assert(fp_c2.self_ptr == (usize)&c2, "s_c2.self must point to &c2");
    assert(fp_c1.vtable_ptr == fp_c2.vtable_ptr, "Both Circle instances share Circle__Shape__VTable");
    assert(fp_c1.vtable_ptr != fp_r1.vtable_ptr, "Rectangle uses a distinct Rectangle__Shape__VTable");

    println "c1 & c2 share Circle__Shape__VTable: {fp_c1.vtable_ptr == fp_c2.vtable_ptr}";
    println "Circle vs Rectangle vtables differ:  {fp_c1.vtable_ptr != fp_r1.vtable_ptr}";
    println "c1 area_x100={s_c1.area_x100()}, r1 area_x100={s_r1.area_x100()}";
    assert(s_c1.area_x100() == 31400 && s_r1.area_x100() == 2400, "Vtable dispatch must compute exact areas");
}
```

使用 `zc run -q` 运行并验证示例 18-3：

```text
$ zc run -q examples/ch18/ch18-03-vtables-in-c/main.zc
sizeof(Circle)    = 4 bytes (only `radius: int`, no hidden vptr!)
sizeof(Rectangle) = 8 bytes (only `width` + `height`, no hidden vptr!)
sizeof(Shape)     = 16 bytes (two 8-byte pointers: `self` + `vtable`)
c1 & c2 share Circle__Shape__VTable: 1
Circle vs Rectangle vtables differ:  1
c1 area_x100=31400, r1 area_x100=2400
```
