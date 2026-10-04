# Circular Dependency Prevention

## 6. Compile-Time Circular Dependency Detection

Circular dependencies between modules can cause brittle coupling, initialization order bugs, and compilation slowdowns.

The `zc` compiler maintains an active import tracking stack during compilation. If module `A` imports module `B`, and module `B` attempts to import module `A`, the compiler immediately halts with a clean diagnostic:

```text
error: Circular import detected: '/path/to/module_a.zc'
```

This strictness ensures that your software architecture remains clean, hierarchical, and acyclic.

---

---

## Standard Project Layout & ZC_ROOT

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

The compiler locates standard library modules via the `ZC_ROOT` environment variable:
```bash
export ZC_ROOT=/home/mark/code/Zen-C
zc run main.zc
```
