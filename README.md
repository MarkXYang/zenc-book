# The Zen C Programming Language (Tutorial Book)

Official tutorial book and hands-on guide for [Zen C (`zenc`)](https://www.zenc-lang.org/) — a modern systems programming language that transpiles directly to pure GNU C11 with zero runtime overhead.

Organized and structured following the architecture of *"The Rust Programming Language"* (The Rust Book).

---

## Table of Contents

- [Introduction](ch00-00-introduction.md)
- [Chapter 1: Getting Started](ch01-00-getting-started.md)
  - [1.1 Installation](ch01-01-installation.md)
  - [1.2 Hello, World!](ch01-02-hello-world.md)
  - [1.3 Hello, zc!](ch01-03-hello-zc.md)
- [Full Table of Contents (20 Chapters)](SUMMARY.md)

---

## Code Examples

Tested against `zc v0.4.4` installed on the system:

```bash
# Run Hello World example
zc run examples/ch01/hello_world/main.zc

# Build standalone binary
zc build examples/ch01/hello_world/main.zc -o hello

# Inspect transpiled GNU C11 source
zc transpile examples/ch01/hello_world/main.zc -o main.c
```

---

## License

MIT & Apache 2.0 dual license.
