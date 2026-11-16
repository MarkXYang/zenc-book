# Trait Objects for Dynamic Dispatch

In [Chapter 8](ch08-01-vectors.md), we saw that a generic `Vec<T>` stores elements of a single concrete type—such as `Vec<int>` or `Vec<Button>`. And in [Chapter 6](ch06-00-enums.md), we saw that when you have a fixed, closed list of variantsknown when writing your library, you can group them into an `enum` and store `Vec<MyEnum>`.

Sometimes, however, you want your library's users to be able to **extend** the set of types that can be stored in a collection without modifying your library's source code. For example, in a graphical or terminal UI toolkit:

- Your library defines a `Widget` trait with `.min_width()`, `.advance_tick()`, and `.render()`, plus built-in widgets like `Button` and `ProgressBar`.
- Application developers using your library will define their own custom structs—such as `SparklineChart`, `ColorPicker`, or `StatusLabel`—and want to store them right alongside `Button` and `ProgressBar` inside a single `Vec<Widget>` toolbar!

Zen C solves this **open-world polymorphism** problem with **Trait Objects**.

---

## 1. Creating and Storing Trait Objects

Whenever you declare a `trait` in Zen C:

```zenc
trait Widget {
    fn min_width(self) -> int;
    fn advance_tick(self);
    fn render(self) -> string;
}
```

the trait name `Widget` can be used directly as a **first-class type**:
- As a local variable type: `let w: Widget = &my_button;`
- As a function parameter type: `fn draw_item(w: Widget)`
- As a struct field type: `state: PostState;`
- As the element type of an array or vector: `Vec<Widget>` or `Widget[8]`

When you assign a pointer `&concrete_struct` to a `Widget` variable (or pass `&concrete_struct` to a `Widget` parameter), the compiler verifies at compile time that `concrete_struct` implements `Widget` (`impl Widget for Button`) and bundles two pointers into the `Widget` value:

1. **`self`**: A `void*` pointing to the `concrete_struct` instance in memory.
2. **`vtable`**: A pointer to the compiler-generated `Widget_VTable` table of function pointers for that concrete type.

---

## 2. Heterogeneous Collections (`Vec<Widget>`) and State Mutation

Because every `Widget` trait object has the exact same size (`16` bytes on 64-bit platforms, regardless of whether the underlying struct is 8 bytes or 800 bytes), you can push trait objects pointing to completely different concrete structs into a single `Vec<Widget>`:

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

Furthermore, because a trait object's `.self` field points directly to the underlying concrete struct (`&btn`, `&bar`, `&lbl`), calling a mutating trait method like `w.advance_tick()` modifies the original struct in place!

> [!WARNING]
> **Lifetime of the Pointed-To Struct**: A trait object (`Widget`) is a **non-owning fat pointer** (`{ void* self, Widget_VTable* vtable }`). Just like a regular pointer `T*`, the concrete struct (`btn`, `bar`, `lbl`, or an arena/heap-allocated instance) must remain alive for as long as the `Widget` trait object is used. Never return a `Widget` pointing to a local stack variable that is about to go out of scope!

---

## 3. Complete Example: Heterogeneous UI Toolbar with `Vec<Widget>`

Listing 18-2 defines the `Widget` trait and implements it on three distinct structs (`Button`, `ProgressBar`, and `StatusLabel`), each with different fields and sizes. It stores all three in a `Vec<Widget>`, iterates over the vector to advance each widget's internal state via dynamic dispatch (`w.advance_tick()`), and computes the toolbar layout width.

**Listing 18-2**: Storing and mutating heterogeneous structs via `Vec<Widget>` (`examples/ch18/ch18-02-trait-objects/main.zc`)

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

Run and verify Listing 18-2 with `zc run -q`:

```text
$ zc run -q examples/ch18/ch18-02-trait-objects/main.zc
Widget 0: [Button 'Deploy' clicks=1] (min_width=12)
Widget 1: [ProgressBar 75% (24px)] (min_width=24)
Widget 2: [StatusLabel Build #2] (min_width=11)
Toolbar total min_width: 47px
```

> [!NOTE]
> Each `render()` returns a `string` that points into a static buffer owned by that method (see the warning in [Chapter 10.2](ch10-02-traits.md)). The loop prints each result immediately, so this is safe. If you need to store rendered text, copy it with `String::from(w.render())`.
