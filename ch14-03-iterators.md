# 14.3 Processing Items with Iterators

The **iterator pattern** allows you to perform a task on a sequence of items in turn without manually managing loop indices, bounds checks, or termination conditions.

In Zen C, iterators power two ergonomic language and library features:
1. **Native `for item in collection` loops**, which work on any type that implements the `iterator()` and `next()` protocol.
2. **Higher-order combinator methods** on `VecIter<T>` (such as `.filter(...)`, `.fold(...)`, `.find(...)`, `.any(...)`, `.all(...)`, and `.forEach(...)`), which accept the closures we learned to write in [Section 14.1](ch14-01-lambdas.md).

---

## 1. The `Iterator<T>` and `Iterable<T>` Protocol

In `std/iter.zc`, Zen C defines two foundational traits that describe how iteration works:

```zenc
// From std/iter.zc:
import "./option.zc"

trait Iterator<T> {
    fn next(self) -> Option<T>;
}

trait Iterable<T> {
    fn iterator(self) -> Iterator<T>;
}
```

Any struct in Zen C participates in `for item in expr` loops automatically if:
1. Calling `.iterator()` on the expression returns an iterator state struct, and
2. Calling `.next()` on that iterator struct returns an `Option<T>` (or an option-like result with `.is_none()` and `.unwrap()`), yielding `Some(item)` for each element and `None()` when the sequence is exhausted.

---

## 2. Value Iteration (`VecIter<T>`) vs. Reference Iteration (`VecIterRef<T>`)

When iterating over a `Vec<T>` (from `std/vec.zc`), Zen C provides two iterator modes:

| Expression | Method Called | Iterator Type | Item Yielded | Best Used When... |
| :--- | :--- | :--- | :--- | :--- |
| `for x in vec` or `vec.iterator()` | `Vec::iterator(self)` | `VecIter<T>` | `T` (copy of element) | `T` is a small scalar or value type (`int`, `f64`, small structs) or you want to chain `VecIter<T>` combinators (`filter`, `fold`, `any`, `all`). |
| `for ptr in &vec` or `vec.iter_ref()` | `Vec::iter_ref(self)` | `VecIterRef<T>` | `T*` (pointer to element in place) | `T` is a heap-owning type (`String`, `Vec<U>`) or a large struct that you want to inspect or mutate in place without copying or triggering `Drop`. |

```zenc
import "std/vec.zc"

let nums = Vec<int>::new();
nums.push(10);
nums.push(20);

// 1. Value iteration: yields `int` copies
for val in nums {
    println "Value: {val}";
}

// 2. Reference iteration: yields `int*` pointers into the vector's buffer
for ptr in &nums {
    *ptr += 5; // Mutates element in place!
}
```

---

## 3. Consuming and Adapting `VecIter<T>` with Closures

Calling `vec.iterator()` returns a `VecIter<T>` cursor equipped with rich functional methods that accept closures (`fn(T) -> ...`):

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`filter`** | `fn filter(self, pred: fn(T) -> bool) -> Vec<T>` | Evaluates `pred(item)` for every remaining item and collects all matching items into a new `Vec<T>`. |
| **`fold`** | `fn fold(self, init: T, f: fn(T, T) -> T) -> T` | Reduces all remaining items into a single accumulated value starting from `init` by repeatedly applying `acc = f(acc, item)`. |
| **`find`** | `fn find(self, pred: fn(T) -> bool) -> Option<T>` | Short-circuits and returns `Some(item)` for the first item where `pred(item)` is `true`, or `None()` if none match. |
| **`any`** | `fn any(self, pred: fn(T) -> bool) -> bool` | Short-circuits and returns `true` if `pred(item)` returns `true` for at least one item. |
| **`all`** | `fn all(self, pred: fn(T) -> bool) -> bool` | Short-circuits and returns `true` if `pred(item)` returns `true` for every item. |
| **`forEach`** | `fn forEach(self, f: fn(T))` | Invokes `f(item)` for side effects on each remaining item. |
| **`count`** | `fn count(self) -> usize` | Returns the number of items remaining in the iterator. |
| **`collect`** | `fn collect(self) -> Vec<T>` | Drains all remaining items into a newly allocated `Vec<T>`. |

Because these methods accept full Zen C closures (`fn(...)`), your predicates and reducers can capture local variables from the surrounding function:

```zenc
let min_passing = 75;

// `min_passing` is captured from the enclosing scope!
let passing = scores.iterator().filter([=] s -> s >= min_passing);
let total   = passing.iterator().fold(0, (acc, x) -> acc + x);
```

---

## 4. Implementing Your Own Custom Iterator

You are not limited to iterating over standard library collections. You can create your own lazy, zero-allocation generator by defining a struct with `.iterator(self)` and `.next(self) -> Option<T>`!

For example, let's build a `Fibonacci` struct that lazily generates the first `max_steps` Fibonacci numbers (`0, 1, 1, 2, 3, 5, 8, 13, ...`) on the fly without allocating an array:

```zenc
import "std/option.zc"

struct Fibonacci {
    curr: int,
    next_val: int,
    step: int,
    max_steps: int,
}

impl Fibonacci {
    fn new(max_steps: int) -> Fibonacci {
        return Fibonacci {
            curr: 0,
            next_val: 1,
            step: 0,
            max_steps: max_steps,
        };
    }

    fn iterator(self) -> Fibonacci {
        return self;
    }

    fn next(self) -> Option<int> {
        if self.step >= self.max_steps {
            return Option<int>::None();
        }
        let yielded = self.curr;
        let upcoming = self.curr + self.next_val;
        self.curr = self.next_val;
        self.next_val = upcoming;
        self.step += 1;
        return Option<int>::Some(yielded);
    }
}
```

Because `Fibonacci` defines `iterator` and `next`, you can use it directly in a `for` loop:

```zenc
for n in Fibonacci::new(8) {
    print "{n} "; // 0 1 1 2 3 5 8 13
}
```

---

## 5. Complete Runnable Example

Here is a complete runnable program (`examples/ch14/ch14-03-iterators/main.zc`) combining `VecIter<T>` combinators (`filter`, `fold`, `find`, `any`, `all`), reference iteration (`&scores`), and our custom `Fibonacci` iterator:

**Listing 14-3: `list14-3.zc` — `VecIter<T>` combinators and a custom `Fibonacci` iterator**

```zenc
// File: examples/ch14/ch14-03-iterators/main.zc
import "std/vec.zc"
import "std/option.zc"
import "std/slice.zc"

// Custom stateful iterator generating the first `max_steps` Fibonacci numbers
struct Fibonacci {
    curr: int,
    next_val: int,
    step: int,
    max_steps: int,
}

impl Fibonacci {
    fn new(max_steps: int) -> Fibonacci {
        return Fibonacci {
            curr: 0,
            next_val: 1,
            step: 0,
            max_steps: max_steps,
        };
    }

    fn iterator(self) -> Fibonacci {
        return self;
    }

    fn next(self) -> Option<int> {
        if self.step >= self.max_steps {
            return Option<int>::None();
        }
        let yielded = self.curr;
        let upcoming = self.curr + self.next_val;
        self.curr = self.next_val;
        self.next_val = upcoming;
        self.step += 1;
        return Option<int>::Some(yielded);
    }
}

fn main() {
    let scores = Vec<int>::new();
    scores.push(45);
    scores.push(82);
    scores.push(91);
    scores.push(60);
    scores.push(77);
    scores.push(95);

    // 1. filter() with a closure capturing a threshold
    let min_passing = 75;
    let passing = scores.iterator().filter([=] s -> s >= min_passing);
    println "Passing scores (>= {min_passing}): {passing.length()}";
    assert(passing.length() == 4, "Expected 4 passing scores (82, 91, 77, 95)");

    // 2. fold() to sum all passing scores
    let passing_sum = passing.iterator().fold(0, (acc, x) -> acc + x);
    println "Sum of passing scores: {passing_sum}";
    assert(passing_sum == 345, "82 + 91 + 77 + 95 should equal 345");

    // 3. find(), any(), and all()
    let first_honors = scores.iterator().find(s -> s >= 90);
    assert(first_honors.is_some() && first_honors.unwrap() == 91, "First score >= 90 is 91");

    let has_perfect = scores.iterator().any(s -> s == 100);
    let all_positive = scores.iterator().all(s -> s > 0);
    println "has_perfect={has_perfect}, all_positive={all_positive}";
    assert(!has_perfect && all_positive, "No 100s, all scores > 0");

    // 4. Reference iteration (`&scores`) vs. value iteration (`scores`)
    let bonus_count = 0;
    for score_ptr in &scores {
        if *score_ptr >= 90 {
            bonus_count += 1;
        }
    }
    println "Scores >= 90 via reference iterator: {bonus_count}";
    assert(bonus_count == 2, "Expected 2 scores >= 90 (91 and 95)");

    // 5. Using our custom Fibonacci iterator in a native `for ... in` loop
    let fib = Fibonacci::new(8);
    let fib_sum = 0;
    print "First 8 Fibonacci numbers:";
    for n in fib {
        print " {n}";
        fib_sum += n;
    }
    println "";
    println "Sum of first 8 Fibonacci numbers: {fib_sum}";
    assert(fib_sum == 33, "0 + 1 + 1 + 2 + 3 + 5 + 8 + 13 = 33");
}
```

Run the example with `zc run`:

```bash
$ zc run -q examples/ch14/ch14-03-iterators/main.zc
Passing scores (>= 75): 4
Sum of passing scores: 345
has_perfect=false, all_positive=true
Scores >= 90 via reference iterator: 2
First 8 Fibonacci numbers: 0 1 1 2 3 5 8 13
Sum of first 8 Fibonacci numbers: 33
```

---

## 🔍 Peek at the C: How `for n in fib` Desugars

When `zc` transpiles `for n in fib`, it does **not** use virtual method tables (`vtables`) or heap boxing. Instead, it statically resolves `Fibonacci__iterator` and `Fibonacci__next` directly on the stack-allocated `Fibonacci` struct:

```c
Fibonacci __it = Fibonacci__iterator(&fib);
for (; 1; ) {
    Option__int32_t __opt = Fibonacci__next(&__it);
    if (Option__int32_t__is_none(&__opt)) {
        break;
    }
    int32_t n = Option__int32_t__unwrap(&__opt);
    {
        fprintf(stdout, " %d", n);
        (fib_sum = (fib_sum + n));
    }
}
```

How does the performance of these iterator loops and closure combinators compare against hand-written indexed loops? Let's find out in **[14.4 Comparing Performance: Loops vs Iterators](ch14-04-performance.md)**!
