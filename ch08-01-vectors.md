# Vectors (Vec)

The most common and versatile dynamic collection in Zen C is the **Vector** (`Vec<T>`), provided by `std/vec.zc`. A vector is a contiguous, dynamically resizable array allocated on the heap.

Vectors are ideal when you need to store a sequence of elements of the same type and you do not know the exact number of elements in advance, or when the list needs to grow and shrink dynamically as your program runs.

---

## The Internal Memory Layout of `Vec<T>`

In Zen C, `Vec<T>` is defined as a simple 3-word structure:

```zenc
struct Vec<T> {
    data: T*;
    len:  usize;
    cap:  usize;
}
```

- **`data`**: A pointer to the heap-allocated contiguous buffer containing the actual elements.
- **`len`**: The current number of elements currently stored in the vector.
- **`cap`**: The total capacity of the allocated heap buffer (the maximum number of elements the buffer can hold before needing to reallocate).

When you push a new element to a vector and `len == cap`, the vector automatically triggers a dynamic resize (`grow()`):
1. It doubles the current capacity ($8 \to 16 \to 32 \to 64 \to \dots$).
2. It reallocates the heap buffer via `realloc`.
3. It updates `data` and `cap`, guaranteeing an amortized $O(1)$ append time.

---

## Creating a Vector

To use vectors, import `std/vec.zc`. Zen C provides two constructor methods:

### 1. `Vec<T>::new()` (Lazy Allocation)
Creates an empty vector with `data = NULL`, `len = 0`, and `cap = 0`. No heap allocation occurs until the first element is pushed!

### 2. `Vec<T>::with_capacity(cap)` (Pre-allocation)
If you know in advance how many elements the vector will hold, pre-allocating capacity avoids repeated `realloc` calls and buffer copies.

**Listing 8-4: `list8-4.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     // 1. Lazy allocation: 0 initial capacity
 5 |     let v = Vec<int>::new();
 6 |     println "Initial length: {v.length()}, capacity: {v.cap}";
 7 |
 8 |     // Pushing elements triggers growth
 9 |     v.push(10);
10 |     v.push(20);
11 |     v.push(30);
12 |
13 |     println "After 3 pushes -> length: {v.length()}, capacity: {v.cap}";
14 |     println "First: {v.first()}, Last: {v.last()}";
15 |     println "Element at index 1: {v[1]}";
16 |
17 |     // 2. Pre-allocated capacity: avoids resizing overhead
18 |     let preallocated = Vec<int>::with_capacity(64);
19 |     println "Preallocated capacity: {preallocated.cap}";
20 | }
```

Output:
```text
Initial length: 0, capacity: 0
After 3 pushes -> length: 3, capacity: 8
First: 10, Last: 30
Element at index 1: 20
Preallocated capacity: 64
```

---

## Modifying Elements: Insert, Remove, and Pop

In addition to `push()`, `Vec<T>` provides fine-grained control over adding and removing items:

- **`insert(idx, item)`**: Inserts `item` at position `idx`, shifting all subsequent elements to the right. Panics if `idx > len`.
- **`remove(idx) -> T`**: Removes and returns the element at `idx`, shifting subsequent elements to the left. Panics if `idx >= len`.
- **`pop() -> T`**: Removes and returns the final element. Panics if the vector is empty.
- **`pop_opt() -> Option<T>`**: Safe variant of `pop()`. Returns `Some(val)` if an element was popped, or `None()` if the vector was already empty.
- **`clear()`**: Resets `len = 0` without freeing the allocated heap buffer, allowing you to reuse the allocated capacity.

**Listing 8-5: `list8-5.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     let v = Vec<int>::new();
 5 |     v.push(10);
 6 |     v.push(20);
 7 |     v.push(30);
 8 |
 9 |     // Insert 15 at index 1: [10, 15, 20, 30]
10 |     v.insert(1, 15);
11 |     println "After insert(1, 15), length: {v.length()}";
12 |
13 |     // Remove element at index 2 (which is 20): [10, 15, 30]
14 |     let removed = v.remove(2);
15 |     println "Removed element: {removed}";
16 |
17 |     // Pop the last element (30): [10, 15]
18 |     let popped = v.pop();
19 |     println "Popped element: {popped}";
20 |
21 |     // Safe pop using pop_opt():
22 |     let opt = v.pop_opt();
23 |     if opt.is_some() {
24 |         println "Safely popped: {opt.unwrap()}";
25 |     }
26 |
27 |     println "Remaining length: {v.length()}";
28 | }
```

Output:
```text
After insert(1, 15), length: 4
Removed element: 20
Popped element: 30
Safely popped: 15
Remaining length: 1
```

---

## Reading Elements and Bounds Checking

You can access elements in a vector using:
1. **Indexing Syntax (`v[idx]`)** or **`v.get(idx)`**: Returns a copy of the element.
2. **`v.get_ref(idx) -> T*`**: Returns a direct pointer to the element inside the vector's buffer. This is especially useful for inspecting or modifying large structs without incurring copy overhead.
3. **`v.first()`** and **`v.last()`**: Return copies of the first and last elements respectively.

> [!CAUTION]
> Like arrays, vector indexing is zero-based (`0` to `len - 1`). If you attempt to access an index outside this range, Zen C immediately panics with `Panic: Index out of bounds`, preventing buffer overruns and uninitialized memory reads!

---

## Iterating Over Vectors

Zen C provides two idiomatic ways to iterate over vectors:

### 1. Iterating by Value (`for x in v`)
Consumes copies of each element during iteration.

### 2. Iterating by Reference (`for x in &v`)
Yields pointers (`T*`) to each element in the vector. This allows you to inspect elements without copying, or **mutate elements in place** using pointer dereference (`*x`):

**Listing 8-6: `list8-6.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     let scores = Vec<int>::new();
 5 |     scores.push(45);
 6 |     scores.push(58);
 7 |     scores.push(72);
 8 |
 9 |     println "--- Original Scores ---";
10 |     for s in &scores {
11 |         println "Score: {*s}";
12 |     }
13 |
14 |     // In-place mutation: curve every score by +10
15 |     for s in &scores {
16 |         *s = *s + 10;
17 |     }
18 |
19 |     println "\n--- Curved Scores ---";
20 |     for s in &scores {
21 |         println "Curved score: {*s}";
22 |     }
23 | }
```

Output:
```text
--- Original Scores ---
Score: 45
Score: 58
Score: 72

--- Curved Scores ---
Curved score: 55
Curved score: 68
Curved score: 82
```

---

## Functional Iterator Combinators

`Vec<T>` integrates seamlessly with Zen C's functional iterator combinators. Calling `.iterator()` produces a `VecIter<T>` that supports:

- **`filter(predicate)`**: Collects elements satisfying a boolean predicate into a new `Vec<T>`.
- **`fold(initial, accumulator)`**: Reduces the vector elements to a single accumulated value.
- **`find(predicate)`**: Returns `Option<T>::Some(val)` for the first matching element, or `None()`.
- **`forEach(callback)`**: Executes a function for each element.

**Listing 8-7: `list8-7.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     let nums = Vec<int>::new();
 5 |     nums.push(1);
 6 |     nums.push(2);
 7 |     nums.push(3);
 8 |     nums.push(4);
 9 |     nums.push(5);
10 |
11 |     // 1. Filter: select even numbers
12 |     let evens = nums.iterator().filter(fn(x: int) -> bool { return x % 2 == 0; });
13 |     println "Evens count: {evens.length()}";
14 |     for e in &evens {
15 |         println "  Even: {*e}";
16 |     }
17 |
18 |     // 2. Fold: sum all numbers
19 |     let sum = nums.iterator().fold(0, fn(acc: int, x: int) -> int { return acc + x; });
20 |     println "Sum: {sum}";
21 |
22 |     // 3. Find: find first value greater than 3
23 |     let found = nums.iterator().find(fn(x: int) -> bool { return x > 3; });
24 |     if found.is_some() {
25 |         println "First number > 3: {found.unwrap()}";
26 |     }
27 | }
```

Output:
```text
Evens count: 2
  Even: 2
  Even: 4
Sum: 15
First number > 3: 4
```

---

## Operator Overloading on `Vec`

Zen C overloads common operators for `Vec<T>` to make code expressive and concise:

| Operator | Syntax | Method | Description |
| :--- | :--- | :--- | :--- |
| `+` | `v1 + &v2` | `add` | Concatenates two vectors into a new vector. |
| `+=` | `v1 += &v2` | `add_assign` | Appends elements of `v2` into `v1` in place. |
| `<<` | `v << item` | `shl` | Appends `item` to the back (stream push). |
| `>>` | `v >> &out` | `shr` | Pops the last element into `out` (stream pop). |
| `*` | `v * n` | `mul` | Returns a new vector with elements repeated $n$ times. |
| `*=` | `v *= n` | `mul_assign` | Repeats elements in-place $n$ times. |
| `==` | `v1 == &v2` | `eq` | Checks structural equality (same length and byte-wise identical elements). |
| `!=` | `v1 != &v2` | `neq` | Structural inequality check. |
| `[]` | `v[i]` | `index` | Direct zero-based element indexing. |

**Listing 8-8: `list8-8.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     let a = Vec<int>::new();
 5 |     a << 10; // Stream push
 6 |     a << 20;
 7 |
 8 |     let b = Vec<int>::new();
 9 |     b << 30;
10 |     b << 40;
11 |
12 |     // Concatenate into a new vector
13 |     let c = a + &b;
14 |     println "Concatenated length: {c.length()}";
15 |
16 |     // Stream pop
17 |     let popped: int = 0;
18 |     c >> &popped;
19 |     println "Popped via >>: {popped}";
20 |
21 |     // Repeat vector elements
22 |     let repeated = a * 2;
23 |     println "Repeated length: {repeated.length()}";
24 |
25 |     // Structural equality
26 |     let a_copy = a.clone();
27 |     println "a == a_copy: {a == &a_copy}";
28 | }
```

Output:
```text
Concatenated length: 4
Popped via >>: 40
Repeated length: 4
a == a_copy: true
```

---

## Vectors of Custom Structs

Vectors work seamlessly with user-defined structs:

**Listing 8-9: `list8-9.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | struct Task {
 4 |     id: int;
 5 |     priority: int;
 6 | }
 7 |
 8 | fn main() {
 9 |     let tasks = Vec<Task>::new();
10 |     tasks.push(Task { id: 101, priority: 1 });
11 |     tasks.push(Task { id: 102, priority: 3 });
12 |     tasks.push(Task { id: 103, priority: 2 });
13 |
14 |     for t in &tasks {
15 |         println "Task #{(*t).id} (Priority: {(*t).priority})";
16 |     }
17 | }
```

Output:
```text
Task #101 (Priority: 1)
Task #102 (Priority: 3)
Task #103 (Priority: 2)
```

---

## Memory Management and Move Semantics

`Vec<T>` automatically implements the `Drop` trait:

```zenc
impl Drop for Vec {
    fn drop(self) {
        self.free();
    }
}
```

- **Scope Exit**: When a vector variable goes out of scope, its `drop()` method is automatically called, safely freeing its heap buffer (`dealloc<T>(self.data)`).
- **Deep Copying with `.clone()`**: Assigning or passing vectors passes value copies of the 3-word struct. To create an independent copy with its own separate heap buffer, call `v.clone()`.
- **Transferring Ownership with `.forget()`**: If you want to detach the underlying heap buffer from the vector (for example, to pass the raw buffer to a C library function without `Drop` freeing it), call `v.forget()`. This zeroes out `data`, `len`, and `cap`.

---

## A Complete Example

Here is a complete program demonstrating creation, modification, iteration, operators, and custom struct usage:

**Listing 8-10: `list8-10.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | struct Task {
 4 |     id: int;
 5 |     priority: int;
 6 | }
 7 |
 8 | fn main() {
 9 |     println "=== 1. Basic Vector Operations ===";
10 |     let v = Vec<int>::new();
11 |     v.push(10);
12 |     v.push(20);
13 |     v.push(30);
14 |
15 |     println "Length: {v.length()}, First: {v.first()}, Last: {v.last()}";
16 |     println "Element at index 1: {v[1]}";
17 |
18 |     println "\n=== 2. Insert, Remove, and Pop ===";
19 |     v.insert(1, 15);
20 |     println "After insert(1, 15), length: {v.length()}";
21 |
22 |     let removed = v.remove(2);
23 |     println "Removed element at index 2: {removed}";
24 |
25 |     let popped = v.pop();
26 |     println "Popped last element: {popped}";
27 |
28 |     let opt = v.pop_opt();
29 |     if opt.is_some() {
30 |         println "Safely popped: {opt.unwrap()}";
31 |     }
32 |
33 |     println "\n=== 3. Iteration by Reference and Mutation ===";
34 |     for x in &v {
35 |         *x = *x * 5;
36 |     }
37 |     for x in &v {
38 |         println "Mutated value: {*x}";
39 |     }
40 |
41 |     println "\n=== 4. Functional Combinators ===";
42 |     let nums = Vec<int>::new();
43 |     nums.push(1);
44 |     nums.push(2);
45 |     nums.push(3);
46 |     nums.push(4);
47 |     nums.push(5);
48 |
49 |     let evens = nums.iterator().filter(fn(x: int) -> bool { return x % 2 == 0; });
50 |     println "Filtered evens count: {evens.length()}";
51 |     for e in &evens {
52 |         println "  Even: {*e}";
53 |     }
54 |
55 |     let sum = nums.iterator().fold(0, fn(acc: int, x: int) -> int { return acc + x; });
56 |     println "Sum of nums: {sum}";
57 |
58 |     let first_even = nums.iterator().find(fn(x: int) -> bool { return x % 2 == 0; });
59 |     if first_even.is_some() {
60 |         println "First even number found: {first_even.unwrap()}";
61 |     }
62 |
63 |     println "\n=== 5. Operator Overloading ===";
64 |     let v2 = Vec<int>::new();
65 |     v2 << 100;
66 |     v2 << 200;
67 |
68 |     let combined = v + &v2;
69 |     println "Combined vector length: {combined.length()}";
70 |     for item in &combined {
71 |         println "  Combined item: {*item}";
72 |     }
73 |
74 |     let popped_val: int = 0;
75 |     v2 >> &popped_val;
76 |     println "Popped from v2 via >>: {popped_val}";
77 |
78 |     let repeated = v * 2;
79 |     println "Repeated vector length: {repeated.length()}";
80 |
81 |     println "\n=== 6. Vector of Custom Structs ===";
82 |     let task_list = Vec<Task>::new();
83 |     task_list.push(Task { id: 101, priority: 1 });
84 |     task_list.push(Task { id: 102, priority: 3 });
85 |     task_list.push(Task { id: 103, priority: 2 });
86 |
87 |     for t in &task_list {
88 |         println "Task #{(*t).id} (Priority: {(*t).priority})";
89 |     }
90 | }
```

Output:
```text
=== 1. Basic Vector Operations ===
Length: 3, First: 10, Last: 30
Element at index 1: 20

=== 2. Insert, Remove, and Pop ===
After insert(1, 15), length: 4
Removed element at index 2: 20
Popped last element: 30
Safely popped: 15

=== 3. Iteration by Reference and Mutation ===
Mutated value: 50

=== 4. Functional Combinators ===
Filtered evens count: 2
  Even: 2
  Even: 4
Sum of nums: 15
First even number found: 2

=== 5. Operator Overloading ===
Combined vector length: 3
  Combined item: 50
  Combined item: 100
  Combined item: 200
Popped from v2 via >>: 200
Repeated vector length: 2

=== 6. Vector of Custom Structs ===
Task #101 (Priority: 1)
Task #102 (Priority: 3)
Task #103 (Priority: 2)
```

> [!TIP]
> You can find and run the complete runnable example for this section in [`book/examples/ch08/ch08-01-vectors/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch08/ch08-01-vectors/main.zc).

---

Now that you have mastered vectors, let's explore **[Strings](ch08-02-strings.md)**!
