# 使用 use 进行组合

## 结构体组合与 Mixin（`use`）

Zen C 并没有依赖僵化的面向对象类层次结构，而是通过结构体定义内部的 `use` 关键字提供了灵活的组合与 mixin 能力。

Zen C 支持两种形式的结构体复用：
1. **扁平化 Mixin**（未命名的 `use Type;`）
2. **具名组合**（`use name: Type;`）

### 1. 扁平化 Mixin（未命名的 `use Type;`）

当你编写没有字段名称的 `use Type;` 时，Zen C 会将目标类型的所有字段**扁平化（flatten）**嵌入到外部结构体中。此外，定义在被嵌入类型上的所有方法都会自动被外部结构体继承！

**代码清单 5-8**
```zenc
struct Entity {
    id: int;
}

struct Player {
    // Mixin (Unnamed): Flattens fields
    use Entity;  // Adds 'id' to Player directly
    name: string;
}

fn main() {
    // When initializing, provide the flattened fields directly:
    let player = Player {
        id: 1,
        name: "Hero",
    };

    // Direct access to mixed-in fields:
    println "Player ID: {player.id}, Name: {player.name}";
}
```

输出：
```text
Player ID: 1, Name: Hero
```

> [!NOTE]
> **Mixin 方法转发**：如果 `Entity` 实现了方法（例如 `id_string()`），则可以直接在 `Player` 实例上调用 `player.id_string()`！这是因为 `use` 会转发嵌入结构体的方法，而这些方法的定义方式你已在[方法语法](ch05-03-method-syntax.md)中学过。

### 2. 具名组合（`use name: Type;`）

具名组合将组件作为嵌套字段嵌入。通过 `outer.field_name` 进行访问：

**代码清单 5-9**
```zenc
struct Match {
    // Composition (Named): Nests fields
    use p1: Player; // Accessed via match.p1
    use p2: Player; // Accessed via match.p2
}

fn main() {
    let m = Match {
        p1: Player { id: 1, name: "Alice" },
        p2: Player { id: 2, name: "Bob" },
    };

    println "Match: {m.p1.name} (id {m.p1.id}) vs {m.p2.name} (id {m.p2.id})";
}
```

输出：
```text
Match: Alice (id 1) vs Bob (id 2)
```

---

## Mixin 方法转发

在 [5.1 节](ch05-01-defining-structs.md) 中，我们了解到结构体可以使用 `use` 关键字嵌入其他结构体。当结构体通过 mixin 嵌入另一个类型时，定义在被嵌入类型上的所有方法都会**自动可用**于外部结构体的实例：

**代码清单 5-10**
```zenc
struct Rectangle {
    width: int;
    height: int;
}

impl Rectangle {
    fn area(const self) -> int {
        return self.width * self.height;
    }
}

struct Window {
    use Rectangle; // Mixin: flattens fields and inherits Rectangle methods!
    title: string;
}

fn main() {
    let win = Window {
        width: 800,
        height: 600,
        title: "Main Application",
    };

    // area() is inherited directly from Rectangle!
    println "Window '{win.title}' area: {win.area()} px";
}
```

输出：
```text
Window 'Main Application' area: 480000 px
```

这种 mixin 模式提供了面向对象继承的代码复用优势，同时保留了扁平、可预测的 C 结构体内存布局。

---

## 小结

在本节中，你学习了：
- Zen C 如何通过 `use` 提供灵活的结构体组合，以此替代传统的类继承。
- 未命名的 mixin（`use Type;`）如何将字段直接扁平化合并到父结构体中。
- 具名组合（`use name: Type;`）如何整洁地嵌套字段。
- 定义在 mixin 类型上的方法如何自动被转发，并可在外部结构体上调用。

在 [第 6 章](ch06-00-enums.md) 中，我们将探索**枚举与模式匹配**！
