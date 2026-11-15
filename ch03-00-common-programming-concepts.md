# Common Programming Concepts

This chapter covers concepts that appear in almost every programming language and how they work in Zen C. Many of these concepts will be familiar if you have experience with C, C++, Rust, or JavaScript, but Zen C brings modern ergonomics and safety guarantees to them.

In this chapter, you will learn about:

- **Variables and Constants**: Understanding compile-time manifest constants (`def`), variables (`let`), type inference, and read-only type qualifications (`const`).
- **Data Types**: Scalar primitive types (integers, floating-point numbers, booleans, characters, strings), fixed-size arrays (`T[N]`), and tuples.
- **Functions**: Defining functions (`fn`), parameter types, explicit return types (`-> T`), named arguments, `const` arguments, and default arguments.
- **Comments, Printing and String Interpolation**: Standard output keywords (`println`), string shorthands, implicit `{}` interpolation, raw strings (`r"..."`), multiline blocks (`"""`), and interactive input prompts (`?`).
- **Control Flow**: Using conditional expressions (`if / else if / else`), repeating loops (`while`, `for`, `loop`, `break`, `continue`), and early-return guard clauses with `if`.

> [!NOTE]
> Advanced functional features such as closures (lambdas) and raw function pointers (`fn*`) are explored in [Chapter 14](ch14-00-functional-features.md). Pattern matching on tagged unions is explored in depth in [Chapter 6](ch06-00-enums.md).

Let's start by looking at variables and constants!
