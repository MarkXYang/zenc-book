# Slices

A *slice* is a lightweight, non-owning view into a contiguous sequence of elements in memory. Instead of copying an entire array or vector to pass a subset of elements to a function, you can pass a slice.

---

## The Anatomy of a Slice

Under the hood, a slice consists of two components:
1. A pointer to the first element (`data: T*`).
2. The number of elements in the slice (`len: usize`).

Because a slice does not own the memory it points to, creating or passing a slice is a zero-cost operation that never performs heap allocation.

```zenc
import "std/slice.zc"

fn print_integers(items: Slice<int>) {
    for x in items {
        println "{x}";
    }
}
```

Slices allow high-performance zero-copy string parsing, buffer scanning, and algorithms across both fixed-size stack arrays and dynamic heap vectors.

Next, let's examine Deterministic Cleanup with `defer` and `Drop`!
