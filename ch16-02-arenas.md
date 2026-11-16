# Arena Allocators

Allocating individual objects on the heap with `alloc<T>` and `dealloc<T>` works well when each object has an independent, unpredictable lifetime. However, many real-world systems allocate hundreds or thousands of small objects that **all live and die together**:

- **Compilers and Parsers**: Every token and Abstract Syntax Tree (AST) node created while parsing a file is needed during type checking and code generation, and can be discarded all at once after compilation finishes.
- **Network Servers**: All headers, query parameters, and JSON nodes allocated while handling a single HTTP request become garbage the moment the response is sent.
- **Game Engines and Simulations**: Temporary collision manifolds, particle commands, and UI layout nodes generated during a single frame are discarded at the end of that frame.

Calling `malloc` and `free` thousands of times per request or frame incurs heavy overhead: the system allocator must search free lists, maintain metadata headers next to every chunk, synchronize across threads, and scatter small objects across non-adjacent cache lines. Worse, freeing a complex graph or tree requires traversing every node to call `dealloc<T>` without leaking or double-freeing anything.

An **Arena allocator** (also called a **region** or **bump allocator**) solves both performance and lifetime management at once.

---

## 1. How Bump Allocation Works

Zen C's standard library provides a fast, lightweight region allocator in `std/arena.zc`:

```zenc
struct Arena {
    data: void*;
    capacity: usize;
    used: usize;
}
```

When you create an arena with `Arena::new(capacity)`, it performs **one** backing heap allocation of `capacity` bytes and sets `used = 0`. Every subsequent allocation simply rounds `used` up to an **8-byte aligned boundary** (`(self.used + 7) & ~7`), checks that `aligned_used + size <= self.capacity`, advances `self.used`, and returns a pointer into `self.data`:

```
Arena Backing Buffer (capacity = 4096 bytes)
+-----------------+-----------------+----------------------+------------------------+
| AstNode #1      | "ten\0" (+pad)  | AstNode #2           | Free Space             |
| (32 bytes)      | (8 bytes)       | (32 bytes)           | (4024 bytes remaining) |
+-----------------+-----------------+----------------------+------------------------+
^                                                          ^                        ^
data (offset 0)                                            used (offset 72)         capacity (4096)
```

Because `Arena` implements the `Drop` trait (`impl Drop for Arena`), its single backing buffer is automatically freed when the `Arena` variable leaves scope—you never free individual objects allocated inside the arena.

---

## 2. The `std/arena.zc` API

Import `"std/arena.zc"` to access all `Arena` methods:

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`Arena::new(cap)`** | `fn new(cap: usize) -> Arena` | Allocates a new arena with a `cap`-byte backing buffer (`used = 0`). |
| **`arena.alloc<T>()`** | `fn alloc<T>(self) -> T*` | Bump-allocates `sizeof(T)` bytes (8-byte aligned), **zero-initializes** the memory, and returns `T*` (or `NULL` if full). |
| **`arena.alloc_n<T>(count)`** | `fn alloc_n<T>(self, count: usize) -> T*` | Bump-allocates and zero-initializes a contiguous array of `count` elements of type `T`. |
| **`arena.alloc_bytes(size)`** | `fn alloc_bytes(self, size: usize) -> void*` | Low-level 8-byte-aligned bump allocation of `size` uninitialized bytes. |
| **`arena.dup_str(src)`** | `fn dup_str(self, src: char*) -> char*` | Copies a NUL-terminated C string `src` (including its trailing `'\0'`) into the arena. |
| **`arena.bytes_used()`** | `fn bytes_used(self) -> usize` | Returns the current bump offset (`self.used`). |
| **`arena.bytes_free()`** | `fn bytes_free(self) -> usize` | Returns the remaining unallocated capacity (`self.capacity - self.used`). |
| **`arena.save()`** | `fn save(self) -> usize` | Returns a checkpoint mark representing the current `used` offset. |
| **`arena.restore(mark)`** | `fn restore(self, mark: usize)` | Rewinds `self.used` back to `mark` in $O(1)$ time, reclaiming all allocations made after `save()`. |
| **`arena.reset()`** | `fn reset(self)` | Resets `self.used = 0` in $O(1)$ time while keeping the backing buffer allocated for reuse. |

---

## 3. Scoped Checkpoints with `save()` and `restore()`

Often a long-lived phase (such as compiling a module) needs a temporary scratch buffer for a single sub-step (such as sorting symbol names or formatting a diagnostic) without permanently consuming space in the main arena.

Instead of creating a second heap allocation, record a checkpoint before the temporary work with `let mark = arena.save()` and rewind the arena afterward with `arena.restore(mark)`:

```zenc
let mark: usize = arena.save();

// Allocate temporary scratch memory inside the same arena
let temp_table: int* = arena.alloc_n<int>(128);
temp_table[0] = 42;

// Rewind `arena.used` back to `mark` in O(1) time!
// Everything allocated BEFORE `mark` remains intact.
arena.restore(mark);
```

```
1. Before save():        [ Permanent AST Nodes (197 B) | Free Space ...                 ]
                                                       ^ mark = 197

2. Scratch allocation:   [ Permanent AST Nodes (197 B) | Scratch (512 B) | Free Space   ]
                                                       ^ mark = 197      ^ used = 712

3. After restore(mark):  [ Permanent AST Nodes (197 B) | Free Space (reclaimed!) ...    ]
                                                       ^ used = 197
```

---

## 4. Complete Example: Arena-Allocated Expression Tree and Checkpoints

Listing 16-2 builds an expression tree for `(10 + 20) * 3` inside a 4 KB `Arena`. Every `AstNode` struct and its label string (`arena.dup_str`) are bump-allocated side by side in the same contiguous buffer. It then allocates a temporary 128-integer scratch table after calling `arena.save()`, reclaims the scratch space with `arena.restore(mark)` while verifying the AST remains valid, and finally resets the entire arena with `arena.reset()`.

**Listing 16-2**: Region allocation, string duplication, and checkpointing (`examples/ch16/ch16-02-arenas/main.zc`)

```zenc
// File: examples/ch16/ch16-02-arenas/main.zc
import "std/arena.zc"

struct AstNode {
    op: char;
    value: int;
    label: char*;
    left: AstNode*;
    right: AstNode*;
}

fn make_leaf(arena: Arena*, val: int, text: char*) -> AstNode* {
    let node: AstNode* = arena.alloc<AstNode>();
    *node = AstNode {
        op: '#',
        value: val,
        label: arena.dup_str(text),
        left: NULL,
        right: NULL,
    };
    return node;
}

fn make_binary(arena: Arena*, op: char, left: AstNode*, right: AstNode*) -> AstNode* {
    let node: AstNode* = arena.alloc<AstNode>();
    *node = AstNode {
        op: op,
        value: 0,
        label: arena.dup_str("expr"),
        left: left,
        right: right,
    };
    return node;
}

fn eval_ast(node: AstNode*) -> int {
    if node == NULL { return 0; }
    if node.op == '#' { return node.value; }
    let l = eval_ast(node.left);
    let r = eval_ast(node.right);
    if node.op == '+' { return l + r; }
    if node.op == '*' { return l * r; }
    return 0;
}

fn main() {
    // Allocate a 4 KB backing buffer once; freed automatically on scope exit
    let arena = Arena::new(4096);
    println "Arena initialized: capacity=4096, free={arena.bytes_free()} bytes";

    // 1. Allocate an expression tree `(10 + 20) * 3` inside the arena
    let n10 = make_leaf(&arena, 10, "ten");
    let n20 = make_leaf(&arena, 20, "twenty");
    let sum_node = make_binary(&arena, '+', n10, n20);
    let n3 = make_leaf(&arena, 3, "three");
    let root = make_binary(&arena, '*', sum_node, n3);

    let result = eval_ast(root);
    let used_after_ast = arena.bytes_used();
    println "AST result: ({n10.label} + {n20.label}) * {n3.label} = {result}";
    println "Bytes used by AST: {used_after_ast}";
    assert(result == 90, "(10 + 20) * 3 must equal 90");

    // 2. Scoped checkpoint with `save()` and `restore()`
    let mark: usize = arena.save();
    let scratch: int* = arena.alloc_n<int>(128);
    scratch[0] = 42;
    scratch[127] = 99;
    println "Bytes used with temporary 128-int scratch table: {arena.bytes_used()}";
    assert(arena.bytes_used() > used_after_ast, "Scratch allocation should advance arena offset");

    // Reclaim the temporary scratch table in O(1) while keeping the AST valid!
    arena.restore(mark);
    println "Bytes used after arena.restore(mark): {arena.bytes_used()}";
    assert(arena.bytes_used() == used_after_ast, "restore(mark) must rewind used offset");
    assert(eval_ast(root) == 90, "AST allocated before mark remains intact");

    // 3. Reset the entire arena in O(1) for the next request/frame
    arena.reset();
    println "Bytes used after arena.reset(): {arena.bytes_used()}";
    assert(arena.bytes_used() == 0, "reset() must zero the bump offset");
}
```

Run and verify Listing 16-2 with `zc run -q`:

```text
$ zc run -q examples/ch16/ch16-02-arenas/main.zc
Arena initialized: capacity=4096, free=4096 bytes
AST result: (ten + twenty) * three = 90
Bytes used by AST: 197
Bytes used with temporary 128-int scratch table: 712
Bytes used after arena.restore(mark): 197
Bytes used after arena.reset(): 0
```

---

## 5. Best Practices and Pitfalls with Arenas

1. **Size the Arena for Peak Phase Capacity**: `Arena` in `std/arena.zc` uses a fixed-capacity buffer so that previously returned `T*` pointers are **never invalidated** by a `realloc` move. If an allocation exceeds `arena.bytes_free()`, `arena.alloc<T>()` returns `NULL`. Size your arena generously for the phase's upper bound or check for `NULL` when handling untrusted input sizes.
2. **Do Not Store RAII Destructor Types Inside an Arena**: `arena.reset()` and `Arena::drop()` reclaim raw bytes without running `Drop::drop()` on individual structs allocated inside the buffer. Store plain data structs, arena-allocated pointers, and `arena.dup_str(...)` strings inside an arena rather than types that own external file descriptors or independent `malloc` handles.
3. **Never Dereference Pointers After `restore()` or `reset()`**: Once `arena.restore(mark)` or `arena.reset()` rewinds the bump offset, any subsequent `arena.alloc<T>()` call will overwrite that region of memory. Treat pointers allocated after `mark` as dead immediately upon calling `restore(mark)`.
