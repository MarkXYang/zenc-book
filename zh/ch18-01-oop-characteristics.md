# Zen C 的面向对象特性

Zen C 是一门面向对象编程语言吗？答案取决于你看重面向对象传统的哪些部分。在最初的构想以及《设计模式》（“四人帮 / Gang of Four”）的传统中，面向对象设计围绕三个核心理念展开：

1. **对象将数据与行为打包**：结构体持有状态，`impl` 块附加操作 `self` 的方法。
2. **封装（Encapsulation）**：对象隐藏其内部实现细节，使外部调用者无法破坏数据不变式。
3. **代码复用与多态**：新类型可以复用已有的字段与行为而无需复制粘贴代码，且不同类型可以通过共享契约统一对待。

Zen C 欣然拥抱这三个目标，同时深思熟虑后拒绝了**实现类继承**（`class Derived : public Base`）。让我们看看这是为什么——以及 Zen C 的组合模型如何更清晰地解决相同的问题。

---

## 1. 对象与封装

在 Zen C 中，数据（`struct`）与行为（`impl`）是分开声明的，这既保持了 `struct` 的物理内存布局 100% 透明并与 C-ABI 兼容，又提供了干净的 `instance.method()` 语法：

- **模块级封装（`opaque struct`）**：正如我们在[7.3 节](ch07-03-encapsulation.md)中所见，将结构体标记为 `opaque struct` 允许外部模块在栈上分配它并按值传递，同时将直接字段访问（`obj.field`）限制在定义该结构体的模块内部。
- **维护不变式的方法**：即便在模块内部，将状态转换组织到专门的方法中（例如在 `apply_damage` 和 `heal` 内部将 `hp` 限制在 `0..=max_hp` 范围内），也能确保不变式在一个地方得到强制维护。

---

## 2. 为什么 Zen C 使用组合（`use`）而非类继承

在传统的类层次结构语言中，继承同时承担着两个互不相关的角色：**共享实现代码**（从父类继承字段和方法）与**子类型化**（允许在期望 `Base*` 的地方传递 `Child*`）。将这两个角色捆绑在一起会产生众所周知的工程隐患：

- **菱形继承问题（The Diamond Problem）**：如果 `FlyingCar` 同时继承自 `Airplane` 和 `Car`，而两者又都继承自 `Vehicle`，那么在内存中存在几份 `Vehicle` 的字段拷贝，哪个 `move()` 方法会胜出？
- **与基类布局紧密耦合**：向基类添加一个字段或虚方法会改变整个程序中所有派生类的大小和布局。
- **隐藏的每对象 `vptr` 开销**：在 C++ 中，即使向类中添加一个 `virtual` 方法，也会悄悄向该类的**每个实例**添加一个 8 字节的隐藏 `vptr` 指针，从而破坏了与原始 C 结构体的兼容性。

### 结合主混入（`use Base;`）与具名组件（`use field: Part;`）

在[5.4 节](ch05-04-composition.md)中，我们介绍了结构体内部的 `use` 关键字。当构建更大的实体架构（如游戏对象、UI 控件或网络协议处理器）时，Zen C 区分了嵌入组件的两种方式：

1. **主扁平化混入（偏移量 `0` 处的 `use Transform2D;`）**：
   - 将匿名的 `use Transform2D;` 放置为**第一个字段**，会将 `Transform2D` 的字段（`x`、`y`）直接嵌入到外部结构体字节偏移量 `0` 处，并**自动转发所有 `Transform2D` 方法**（例如 `hero.translate(8, 15)`）。
   - 在底层的 C11 中，调用 `hero.translate(8, 15)` 会将 `(Transform2D*)&hero` 传递给 `Transform2D__translate`——这以零开销运行，因为 `Transform2D` 的字段恰好位于 `Player` 的偏移量 `0` 处！
2. **具名组件组合（`use health: HealthPool;`）**：
   - 当实体拥有位于第一个字段之后非零字节偏移量处的其他子系统（`HealthPool`、`Inventory`、`PhysicsBody`）时，将其作为**具名组件**嵌入（`use health: HealthPool;` 或 `health: HealthPool;`）。
   - 调用者通过组件命名空间清晰地调用方法（`hero.health.apply_damage(65)`），避免了方法名冲突，并保持每个子结构体的指针偏移量精确无误。

```
Player Memory Layout (24 bytes total, 0 hidden vptr bytes):
Offset:  0..3     4..7     8..11       12..15          16..23
       +--------+--------+-----------+---------------+---------------+
       |   x    |   y    | health.hp | health.max_hp |   callsign    |
       +--------+--------+-----------+---------------+---------------+
       |<-- Transform2D ->|<------ HealthPool ------>|<-- string --->|
       (Unnamed mixin @ 0) (Named component @ +8)
```

> [!IMPORTANT]
> **仅限偏移量 `0` 处的单个匿名方法转发混入**：因为匿名 `use Base;` 混入上的转发方法会将外部结构体指针转换为 `(Base*)&outer`（偏移量 `0`），所以只有位于字节偏移量 `0` 处的**第一个**嵌入结构体在转发访问 `self` 字段的方法时才应使用匿名 `use Base;`。对于第二个及后续的嵌入组件，请始终使用具名组合（`use name: Component;`）！

---

## 3. 完整示例：使用 `Transform2D` 与 `HealthPool` 的实体组合

代码清单 18-1 构建了一个 `Player` 实体，在偏移量 `0` 处混入了 `Transform2D`（使 `Player` 直接继承 `.translate()` 和 `.manhattan_dist()`），并组合了一个强制维护 $0 \le \text{hp} \le \text{max\_hp}$ 不变式的 `HealthPool` 组件（`hero.health.apply_damage(...)`、`hero.health.heal(...)`）。

**代码清单 18-1**：结构体组合、方法转发与不变式封装（`examples/ch18/ch18-01-oop-characteristics/main.zc`）

```zenc
// File: examples/ch18/ch18-01-oop-characteristics/main.zc

// 1. Primary spatial base mixed in at offset 0 via unnamed `use Transform2D;`
struct Transform2D {
    x: int;
    y: int;
}

impl Transform2D {
    fn translate(self, dx: int, dy: int) {
        self.x += dx;
        self.y += dy;
    }

    fn manhattan_dist(self) -> int {
        let ax = self.x < 0 ? -self.x : self.x;
        let ay = self.y < 0 ? -self.y : self.y;
        return ax + ay;
    }
}

// 2. Reusable health component with encapsulated invariant (`0 <= hp <= max_hp`)
struct HealthPool {
    hp: int;
    max_hp: int;
}

impl HealthPool {
    fn apply_damage(self, amount: int) {
        if amount <= 0 {
            return;
        }
        self.hp -= amount;
        if self.hp < 0 {
            self.hp = 0;
        }
    }

    fn heal(self, amount: int) {
        if amount <= 0 {
            return;
        }
        self.hp += amount;
        if self.hp > self.max_hp {
            self.hp = self.max_hp;
        }
    }

    fn is_alive(self) -> bool {
        return self.hp > 0;
    }
}

// `Player` combines an unnamed primary mixin (`use Transform2D;` at offset 0)
// with named component composition (`use health: HealthPool;`)
struct Player {
    use Transform2D;
    use health: HealthPool;
    callsign: string;
}

impl Player {
    fn new(callsign: string, start_x: int, start_y: int, max_hp: int) -> Player {
        return Player {
            x: start_x,
            y: start_y,
            health: HealthPool { hp: max_hp, max_hp: max_hp },
            callsign: callsign,
        };
    }

    fn status_report(self) -> string {
        return "{self.callsign} @ ({self.x}, {self.y}) [HP: {self.health.hp}/{self.health.max_hp}]";
    }
}

fn main() {
    let hero = Player::new("Vanguard", 2, -3, 100);

    // 1. Call methods forwarded automatically from the primary `Transform2D` mixin
    hero.translate(8, 15); // (2 + 8, -3 + 15) = (10, 12)
    let dist = hero.manhattan_dist();
    println "After translate: {hero.status_report()}, dist={dist}";
    assert(hero.x == 10 && hero.y == 12 && dist == 22, "Transform2D mixin methods must update x and y");

    // 2. Call methods on the composed `health` component
    hero.health.apply_damage(65);
    println "After 65 damage: {hero.status_report()}";
    assert(hero.health.hp == 35 && hero.health.is_alive(), "HP should be 35 and alive");

    // 3. Invariant enforcement: healing clamps to `max_hp`, lethal damage clamps to 0
    hero.health.heal(200);
    assert(hero.health.hp == 100, "Heal must clamp to max_hp (100)");

    hero.health.apply_damage(250);
    println "After 250 damage: {hero.status_report()}, alive={hero.health.is_alive()}";
    assert(hero.health.hp == 0 && !hero.health.is_alive(), "Lethal damage must clamp hp to 0");
}
```

使用 `zc run -q` 运行并验证代码清单 18-1：

```text
$ zc run -q examples/ch18/ch18-01-oop-characteristics/main.zc
After translate: Vanguard @ (10, 12) [HP: 100/100], dist=22
After 65 damage: Vanguard @ (10, 12) [HP: 35/100]
After 250 damage: Vanguard @ (10, 12) [HP: 0/100], alive=false
```
