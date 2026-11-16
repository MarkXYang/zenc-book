# 实现面向对象设计模式

**状态模式（State Pattern）**是一种经典的面向对象设计模式，其中对象的外部行为会随着其内部状态的转变而动态变化。无需在 `Post` 结构体的每个方法中到处散落 `if` / `else` 或 `match` 检查，而是让每个状态由其自己的实现了共享 `PostState` trait 的结构体来表示，`Post` 则将依赖于状态的查询直接委托给 `self.state`。

---

## 1. 使用状态模式为发布工作流建模

假设我们正在构建一个具有三种状态的博客发布工作流：

```
  [ DraftState ]  --->  [ PendingReviewState ]  --->  [ PublishedState ]
  - can_edit: true      - can_edit: false             - can_edit: false
  - can_view: false     - can_view: false             - can_view: true
```

1. **`DraftState`（草稿状态）**：新的 `Post` 从 `Draft` 开始。处于 `DraftState` 时，调用 `post.write_body(text)` 会更新正文并递增 `draft.revisions`，但调用 `post.content()` 则返回空字符串 `""`，因为在获得批准前草稿文章绝不能向读者展示。
2. **`PendingReviewState`（待审核状态）**：一旦作者提交文章以供审核（`post.transition_to(&review)`），后续的编辑就会被拒绝（`can_edit() == false`），且 `post.content()` 依然返回 `""`。
3. **`PublishedState`（已发布状态）**：一旦审核人员批准了文章（`post.transition_to(&published)`），`can_view()` 就会变为 `true`，此时 `post.content()` 将返回已发布的文章正文！

注意到当委托给 `self.state: PostState` 时，`Post` 的方法变得多么干净简洁：

```zenc
struct Post {
    body: string;
    state: PostState;
}

impl Post {
    fn write_body(self, new_text: string) -> bool {
        if self.state.can_edit() {
            self.body = new_text;
            self.state.record_edit();
            return true;
        }
        return false;
    }

    fn content(self) -> string {
        if self.state.can_view() {
            return self.body;
        }
        return "";
    }
}
```

无论 `write_body` 还是 `content` 都不需要知道究竟存在多少种状态——如果你稍后添加了一个实现了 `PostState` 的 `ScheduledState`（定时状态）或 `ArchivedState`（归档状态）结构体，`Post` 就能直接与新状态协作，而无需修改 `impl Post` 中的任何一行代码！

---

## 2. 完整示例：基于 Trait 对象的 `Post` 状态模式

代码清单 18-4 在 `DraftState`、`PendingReviewState` 和 `PublishedState` 上实现了 `PostState`，并引导一个 `Post` 实例完整走过所有三个生命周期阶段。

**代码清单 18-4**：使用 `PostState` trait 对象实现状态模式（`examples/ch18/ch18-04-oop-patterns/main.zc`）

```zenc
// File: examples/ch18/ch18-04-oop-patterns/main.zc

// State interface for a document publishing workflow
trait PostState {
    fn status_name(self) -> string;
    fn can_edit(self) -> bool;
    fn can_view(self) -> bool;
    fn record_edit(self);
}

struct DraftState {
    revisions: int;
}

impl PostState for DraftState {
    fn status_name(self) -> string {
        return "Draft";
    }

    fn can_edit(self) -> bool {
        return true;
    }

    fn can_view(self) -> bool {
        return false;
    }

    fn record_edit(self) {
        self.revisions += 1;
    }
}

struct PendingReviewState {
    reviewer_id: int;
}

impl PostState for PendingReviewState {
    fn status_name(self) -> string {
        return "PendingReview";
    }

    fn can_edit(self) -> bool {
        return false;
    }

    fn can_view(self) -> bool {
        return false;
    }

    fn record_edit(self) {}
}

struct PublishedState {
    version: int;
}

impl PostState for PublishedState {
    fn status_name(self) -> string {
        return "Published";
    }

    fn can_edit(self) -> bool {
        return false;
    }

    fn can_view(self) -> bool {
        return true;
    }

    fn record_edit(self) {}
}

struct Post {
    body: string;
    state: PostState;
}

impl Post {
    fn new(initial_state: PostState) -> Post {
        return Post {
            body: "",
            state: initial_state,
        };
    }

    fn write_body(self, new_text: string) -> bool {
        if self.state.can_edit() {
            self.body = new_text;
            self.state.record_edit();
            return true;
        }
        return false;
    }

    fn transition_to(self, next_state: PostState) {
        self.state = next_state;
    }

    fn content(self) -> string {
        if self.state.can_view() {
            return self.body;
        }
        return "";
    }

    fn status(self) -> string {
        return self.state.status_name();
    }
}

fn main() {
    let draft = DraftState { revisions: 0 };
    let review = PendingReviewState { reviewer_id: 42 };
    let published = PublishedState { version: 1 };

    // 1. Start in `Draft` state: writing is allowed, but public `content()` is empty
    let post = Post::new(&draft);
    let wrote_in_draft = post.write_body("Zen C trait objects compile to 16-byte C11 fat pointers.");
    println "State: {post.status()}, wrote={wrote_in_draft}, revisions={draft.revisions}, content='{post.content()}'";
    assert(wrote_in_draft && draft.revisions == 1, "Draft state must allow writing and increment revisions");
    assert(strcmp(post.content(), "") == 0, "Draft post must not expose unpublished content");

    // 2. Request review: transition to `PendingReviewState`
    post.transition_to(&review);
    let wrote_in_review = post.write_body("Unauthorized edit during review!");
    println "State: {post.status()}, wrote={wrote_in_review}, content='{post.content()}'";
    assert(!wrote_in_review, "PendingReview state must reject edits");
    assert(strcmp(post.content(), "") == 0, "PendingReview post must not expose content yet");

    // 3. Approve: transition to `PublishedState`
    post.transition_to(&published);
    println "State: {post.status()}, content='{post.content()}'";
    assert(strcmp(post.content(), "Zen C trait objects compile to 16-byte C11 fat pointers.") == 0, "Published post must return the approved body");
}
```

使用 `zc run -q` 运行并验证代码清单 18-4：

```text
$ zc run -q examples/ch18/ch18-04-oop-patterns/main.zc
State: Draft, wrote=true, revisions=1, content=''
State: PendingReview, wrote=false, content=''
State: Published, content='Zen C trait objects compile to 16-byte C11 fat pointers.'
```

---

## 3. 权衡取舍：Trait 对象状态模式 vs. `enum` + `match`

Trait 对象与带标签 `enum` 都是 Zen C 中的一等公民。在设计状态机或多态子系统时，请权衡以下得失：

| 评判标准 | Trait 对象（`trait PostState`） | 带标签枚举（`enum PostState` + `match`） |
| :--- | :--- | :--- |
| **添加新的状态变体** | **简单**：定义新 `struct` 并 `impl PostState`；无需修改任何现有代码。 | 需要向 `enum` 添加变体并更新每个相关的 `match` 表达式。 |
| **添加新的操作** | 需要向 `trait PostState` 以及每个 `impl` 块添加方法。 | **简单**：编写一个带有 `match` 块的新函数即可。 |
| **编译期穷尽性** | 在运行时检查动态转换。 | 编译器强制对所有状态进行穷尽性 `match` 检查。 |
| **内存与分发** | 16 字节 `{ self, vtable }` 胖指针；每个方法 1 次间接调用。 | 连续内联联合体 + 标签；直接分支分发。 |

---

## 第 18 章小结

在本章中，你掌握了 Zen C 实现组合与运行时多态的方法：

- **结构体组合（18.1 节）**：将主扁平化混入（偏移量 `0` 处的 `use Transform2D;`）与具名组件组合（`use health: HealthPool;`）以及强制维护不变式的方法相结合，替代脆弱的类层次结构。
- **Trait 对象（18.2 节）**：将 `Trait` 作为值类型使用，以便在单个 `Vec<Widget>` 中存储并修改异构结构体。
- **C11 虚表机制（18.3 节）**：理解 `zc` 如何生成 16 字节 `{ void* self, Trait_VTable* vtable }` 胖指针和静态每类型 `VTable` 实例，而在具体结构体上保持**零隐藏 `vptr` 开销**。
- **OOP 设计模式（18.4 节）**：使用 `PostState` trait 对象实现四人帮状态模式，并清楚何时选择 trait 对象 vs. `enum` + `match`。

接下来，在**[第 19 章：元编程与编译期执行](ch19-00-metaprogramming.md)**中，我们将探索如何使用 `comptime` 在编译期执行 Zen C 代码、使用 `@derive` 自动生成样板代码、使用 `@embed` 嵌入静态资源，以及编写条件编译指令。
