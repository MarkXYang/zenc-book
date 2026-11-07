# 18.4 Implementing an Object-Oriented Design Pattern

The **State Pattern** is a classic object-oriented design pattern in which an object's external behavior changes dynamically as its internal state transitions. Rather than scattering `if` / `else` or `match` checks across every method of a `Post` struct, each state is represented by its own struct implementing a shared `PostState` trait, and `Post` delegates state-dependent queries directly to `self.state`.

---

## 1. Modeling a Publishing Workflow with the State Pattern

Suppose we are building a blog publishing workflow with three states:

```
  [ DraftState ]  --->  [ PendingReviewState ]  --->  [ PublishedState ]
  - can_edit: true      - can_edit: false             - can_edit: false
  - can_view: false     - can_view: false             - can_view: true
```

1. **`DraftState`**: A new `Post` begins as a `Draft`. While in `DraftState`, calling `post.write_body(text)` updates the body and increments `draft.revisions`, but calling `post.content()` returns an empty string `""` because draft articles must not be shown to readers before approval.
2. **`PendingReviewState`**: Once the author submits the post for review (`post.transition_to(&review)`), further edits are rejected (`can_edit() == false`), and `post.content()` still returns `""`.
3. **`PublishedState`**: Once the reviewer approves the post (`post.transition_to(&published)`), `can_view()` becomes `true`, and `post.content()` returns the published article text!

Notice how clean the `Post` methods become when delegating to `self.state: PostState`:

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

Neither `write_body` nor `content` knows how many states exist—if you later add a `ScheduledState` or `ArchivedState` struct implementing `PostState`, `Post` works with the new state without modifying a single line of `impl Post`!

---

## 2. Complete Example: The `Post` State Pattern with Trait Objects

Listing 18-4 implements `PostState` across `DraftState`, `PendingReviewState`, and `PublishedState`, and walks a `Post` instance through all three lifecycle stages.

**Listing 18-4**: Implementing the State Pattern with `PostState` trait objects (`examples/ch18/ch18-04-oop-patterns/main.zc`)

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

Run and verify Listing 18-4 with `zc run -q`:

```text
$ zc run -q examples/ch18/ch18-04-oop-patterns/main.zc
State: Draft, wrote=true, revisions=1, content=''
State: PendingReview, wrote=false, content=''
State: Published, content='Zen C trait objects compile to 16-byte C11 fat pointers.'
```

---

## 3. Trade-Offs: Trait Object State Pattern vs. `enum` + `match`

Both trait objects and tagged `enum`s are first-class citizens in Zen C. When designing a state machine or polymorphic subsystem, weigh these trade-offs:

| Criterion | Trait Objects (`trait PostState`) | Tagged Enum (`enum PostState` + `match`) |
| :--- | :--- | :--- |
| **Adding a New State Variant** | **Easy**: Define a new `struct` and `impl PostState`; no existing code changes. | Requires adding a variant to `enum` and updating every `match` expression. |
| **Adding a New Operation** | Requires adding a method to `trait PostState` and every `impl` block. | **Easy**: Write one new function with a `match` block. |
| **Compile-Time Exhaustiveness** | Dynamic transitions checked at runtime. | Compiler enforces exhaustive `match` over all states. |
| **Memory & Dispatch** | 16-byte `{ self, vtable }` fat pointer; 1 indirect call per method. | Contiguous inline union + tag; direct branch dispatch. |

---

## Summary of Chapter 18

In this chapter, you mastered Zen C's approach to composition and runtime polymorphism:

- **Struct Composition (`18.1`)**: Combining a primary flattened mixin (`use Transform2D;` at offset `0`) with named component composition (`use health: HealthPool;`) and invariant-enforcing methods instead of fragile class hierarchies.
- **Trait Objects (`18.2`)**: Using `Trait` as a value type to store and mutate heterogeneous structs inside a single `Vec<Widget>`.
- **C11 Vtables (`18.3`)**: Understanding how `zc` emits 16-byte `{ void* self, Trait_VTable* vtable }` fat pointers and static per-type `VTable` instances with **zero hidden `vptr` overhead** on concrete structs.
- **OOP Design Patterns (`18.4`)**: Implementing the Gang of Four State Pattern with `PostState` trait objects and knowing when to choose trait objects vs. `enum` + `match`.

Next, in **[Chapter 19: Metaprogramming and Compile-Time Execution](ch19-00-metaprogramming.md)**, we will explore how to execute Zen C code at compile time with `comptime`, generate boilerplate automatically with `@derive`, embed static assets with `@embed`, and write conditional compilation directives.
