# 用于动态分发的 Trait 对象

在[第 8 章](ch08-01-vectors.md)中，我们看到泛型 `Vec<T>` 存储单一具体类型的元素——例如 `Vec<int>` 或 `Vec<Button>`。在[第 6 章](ch06-00-enums.md)中，我们看到当编写库时拥有一组预先已知的固定、封闭变体列表时，可以将它们归纳到一个 `enum` 中并存储为 `Vec<MyEnum>`。

然而，有时你希望你的库的用户能够**扩展**可存储在集合中的类型集合，而无需修改你的库源代码。例如，在图形或终端 UI 工具包中：

- 你的库定义了一个包含 `.min_width()`、`.advance_tick()` 和 `.render()` 的 `Widget` trait，以及内置组件如 `Button` 和 `ProgressBar`。
- 使用你的库的应用程序开发者将定义他们自己的自定义结构体——例如 `SparklineChart`、`ColorPicker` 或 `StatusLabel`——并希望将它们与 `Button`、`ProgressBar` 并排存放在同一个 `Vec<Widget>` 工具栏中！

Zen C 通过 **Trait 对象（Trait Objects）** 解决了这个**开放世界多态（open-world polymorphism）**问题。

---

## 1. 创建与存储 Trait 对象

每当你在 Zen C 中声明一个 `trait`：

```zenc
trait Widget {
    fn min_width(self) -> int;
    fn advance_tick(self);
    fn render(self) -> string;
}
```

该 trait 的名称 `Widget` 就可以直接作为**一等类型（first-class type）**使用：
- 作为局部变量类型：`let w: Widget = &my_button;`
- 作为函数参数类型：`fn draw_item(w: Widget)`
- 作为结构体字段类型：`state: PostState;`
- 作为数组或向量的元素类型：`Vec<Widget>` 或 `Widget[8]`

当你将指针 `&concrete_struct` 赋值给一个 `Widget` 变量（或将 `&concrete_struct` 传递给一个 `Widget` 参数）时，编译器会在编译期验证该 `concrete_struct` 实现了 `Widget`（`impl Widget for Button`），并将两个指针打包进该 `Widget` 值中：

1. **`self`**：指向内存中 `concrete_struct` 实例的 `void*` 指针。
2. **`vtable`**：指向编译器为该具体类型生成的 `Widget_VTable` 函数指针表的指针。

---

## 2. 异构集合（`Vec<Widget>`）与状态修改

因为每个 `Widget` trait 对象都具有完全相同的大小（在 64 位平台上为 `16` 字节，无论底层结构体是 8 字节还是 800 字节），所以你可以将指向完全不同具体结构体的 trait 对象推入同一个 `Vec<Widget>` 中：

```zenc
let btn = Button { label: "Deploy", padding: 2, clicks: 0 };
let bar = ProgressBar { width: 24, percent: 50 };
let lbl = StatusLabel { prefix: "Build", frame: 1 };

let toolbar = Vec<Widget>::with_capacity(3);
let w_btn: Widget = &btn;
let w_bar: Widget = &bar;
let w_lbl: Widget = &lbl;
toolbar.push(w_btn);
toolbar.push(w_bar);
toolbar.push(w_lbl);
```

此外，因为 trait 对象的 `.self` 字段直接指向底层的具体结构体（`&btn`、`&bar`、`&lbl`），所以调用可变的 trait 方法（如 `w.advance_tick()`）会直接就地修改原始结构体！

> [!WARNING]
> **被指向结构体的生命周期**：Trait 对象（`Widget`）是一个**非拥有型的胖指针（fat pointer）**（`{ void* self, Widget_VTable* vtable }`）。就像常规指针 `T*` 一样，只要还在使用 `Widget` trait 对象，底层的具体结构体（`btn`、`bar`、`lbl`，或 arena/堆分配的实例）就必须保持存活。切勿返回指向即将离开作用域的局部栈变量的 `Widget`！

---

## 3. 完整示例：使用 `Vec<Widget>` 的异构 UI 工具栏

代码清单 18-2 定义了 `Widget` trait，并在三个具有不同字段和大小的结构体（`Button`、`ProgressBar` 和 `StatusLabel`）上实现了该 trait。它将这三个组件都存入一个 `Vec<Widget>` 中，遍历该向量并通过动态分发（`w.advance_tick()`）推进每个组件的内部状态，最后计算工具栏的布局宽度。

**代码清单 18-2**：通过 `Vec<Widget>` 存储并修改异构结构体（`examples/ch18/ch18-02-trait-objects/main.zc`）

```zenc
// File: examples/ch18/ch18-02-trait-objects/main.zc
import "std/vec.zc"

trait Widget {
    fn min_width(self) -> int;
    fn advance_tick(self);
    fn render(self) -> string;
}

struct Button {
    label: string;
    padding: int;
    clicks: int;
}

impl Widget for Button {
    fn min_width(self) -> int {
        return (int)strlen(self.label) + self.padding * 2 + 2;
    }

    fn advance_tick(self) {
        self.clicks += 1;
    }

    fn render(self) -> string {
        return "[Button '{self.label}' clicks={self.clicks}]";
    }
}

struct ProgressBar {
    width: int;
    percent: int;
}

impl Widget for ProgressBar {
    fn min_width(self) -> int {
        return self.width;
    }

    fn advance_tick(self) {
        self.percent += 25;
        if self.percent > 100 {
            self.percent = 100;
        }
    }

    fn render(self) -> string {
        return "[ProgressBar {self.percent}% ({self.width}px)]";
    }
}

struct StatusLabel {
    prefix: string;
    frame: int;
}

impl Widget for StatusLabel {
    fn min_width(self) -> int {
        return (int)strlen(self.prefix) + 6;
    }

    fn advance_tick(self) {
        self.frame += 1;
    }

    fn render(self) -> string {
        return "[StatusLabel {self.prefix} #{self.frame}]";
    }
}

fn main() {
    let btn = Button { label: "Deploy", padding: 2, clicks: 0 };
    let bar = ProgressBar { width: 24, percent: 50 };
    let lbl = StatusLabel { prefix: "Build", frame: 1 };

    // Store heterogeneous concrete types inside a single `Vec<Widget>` of trait objects!
    let toolbar = Vec<Widget>::with_capacity(3);
    let w_btn: Widget = &btn;
    let w_bar: Widget = &bar;
    let w_lbl: Widget = &lbl;
    toolbar.push(w_btn);
    toolbar.push(w_bar);
    toolbar.push(w_lbl);

    // 1. Mutate every concrete widget through dynamic dispatch (`advance_tick`)
    let total_width = 0;
    for i in (usize)0..toolbar.length() {
        let w = toolbar.get(i);
        w.advance_tick();
        total_width += w.min_width();
        println "Widget {i}: {w.render()} (min_width={w.min_width()})";
    }

    println "Toolbar total min_width: {total_width}px";
    assert(btn.clicks == 1, "Button click count must increment via trait object");
    assert(bar.percent == 75, "ProgressBar must advance from 50% to 75%");
    assert(lbl.frame == 2, "StatusLabel frame must advance from 1 to 2");
    assert(total_width == 12 + 24 + 11, "Total min_width must equal 47");
}
```

使用 `zc run -q` 运行并验证代码清单 18-2：

```text
$ zc run -q examples/ch18/ch18-02-trait-objects/main.zc
Widget 0: [Button 'Deploy' clicks=1] (min_width=12)
Widget 1: [ProgressBar 75% (24px)] (min_width=24)
Widget 2: [StatusLabel Build #2] (min_width=11)
Toolbar total min_width: 47px
```

> [!NOTE]
> 每个 `render()` 返回的 `string` 都指向该方法所拥有的静态缓冲区（参见[第 10.2 节](ch10-02-traits.md)中的警告）。循环会立即打印每个结果，因此这是安全的。如果需要保存渲染出的文本，请使用 `String::from(w.render())` 复制一份。
