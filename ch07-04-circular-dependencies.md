# Circular Dependency Prevention

## 6. Compile-Time Circular Dependency Detection

Circular dependencies between modules cause brittle coupling, initialization order bugs, and compilation slowdowns.

The `zc` compiler maintains an active import tracking stack during compilation. If module `A` imports module `B`, and module `B` attempts to import module `A`, the compiler immediately halts with a clean diagnostic:

```text
error: Circular import detected: '/path/to/module_a.zc'
```

This strictness ensures that your software architecture remains clean, hierarchical, and acyclic.

### How to Break a Circular Dependency

If two modules `a.zc` and `b.zc` genuinely need to reference shared types or constants:

1. **Extract shared types into a lower-level module** (e.g., `types.zc` or `models.zc`) that neither `a.zc` nor `b.zc` depends back on, so both import `types.zc` cleanly.
2. **Invert the dependency with a `trait`**: Define a `trait` in the lower-level module and implement it in the higher-level module instead of having the lower-level module import the caller.

---

## Standard Project Layout & `ZC_ROOT`

Zen C projects typically organize their code into a standard directory layout:

```text
my_project/
├── main.zc
├── src/
│   ├── mod.zc
│   ├── network.zc
│   └── models.zc
└── tests/
    └── test_main.zc
```

The compiler locates standard library modules (such as `std/vec.zc` and `std/fs.zc`) via the `ZC_ROOT` environment variable or its compiled-in installation prefix:

```bash
export ZC_ROOT=/home/mark/code/Zen-C
zc run main.zc
```

Keeping your application entry point (`main.zc`) at the top of the dependency DAG, with `src/models.zc` at the bottom and `tests/` importing `src/`, guarantees that circular imports never occur.
