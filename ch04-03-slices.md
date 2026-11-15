# Slices

A *slice* is a lightweight, non-owning view into a contiguous sequence of elements in memory. Instead of copying an entire array or vector to pass a subset of elements to a function, you can pass a `Slice<T>` that borrows a range of elements without allocating or transferring ownership.

---

## The Anatomy of a Slice

Under the hood, `Slice<T>` (defined in `std/slice.zc`) is a simple fat pointer with two fields:

1. A pointer to the first element (`data: T*`).
2. The number of elements in the view (`len: usize`).

Because a slice does not own the memory it points to, creating, sub-slicing, or passing a `Slice<T>` by value is a zero-cost operation—it copies just two machine words and never performs heap allocation.

## Creating and Iterating Over Slices

You can construct a `Slice<T>` over any contiguous buffer—stack arrays, heap allocations, or sub-ranges—using `Slice<T>::from_array(ptr, len)` or `Slice<T>::new(data, len)`:

```zenc
// File: examples/ch04/ch04-03-slices/main.zc

import "std/slice.zc"

fn sum_slice(items: Slice<int>) -> int {
    let total = 0;
    for x in items {
        total += x;
    }
    return total;
}

fn find_max(items: Slice<int>) -> int {
    assert(items.len > 0, "slice must be non-empty");
    let best = items.data[0];
    for x in items {
        if x > best {
            best = x;
        }
    }
    return best;
}

fn main() {
    let scores: int[5] = [10, 25, 15, 40, 30];

    // Non-owning views over the stack array (zero heap allocation)
    let all = Slice<int>::from_array(&scores[0], 5);
    let middle = Slice<int>::new(&scores[1], 3);

    println "all.len = {all.len}, sum = {sum_slice(all)}";
    println "middle.len = {middle.len}, sum = {sum_slice(middle)}";
    println "max in middle = {find_max(middle)}";

    assert(sum_slice(all) == 120, "sum of all must be 120");
    assert(sum_slice(middle) == 80, "sum of middle must be 80");
    assert(find_max(middle) == 40, "max in middle must be 40");

    println "All slice checks passed!";
}
```

<span class="caption">Listing 4-3: Creating non-owning `Slice<int>` views and iterating over them</span>

## Safety Rules for Slices

Because a slice is a non-owning view, keep two invariants in mind:

1. **Lifetime**: Never return or store a `Slice<T>` that outlives the backing array or heap buffer it points into (otherwise `data` becomes a dangling pointer).
2. **Bounds**: Always check `items.len` before indexing `items.data[idx]` directly, or iterate safely with `for x in items`.

> ### 🔍 Peek at the C
>
> `Slice<int>` compiles down to a plain two-field C struct (`struct Slice_int { int *data; size_t len; };`). Passing it to `sum_slice` passes those two registers directly on the ABI without touching `malloc` or `free`.

Next, let's examine deterministic cleanup with `defer` and `Drop`!
