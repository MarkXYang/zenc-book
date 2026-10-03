# Hello, World!

Now that you've installed Zen C, it's time to write your first program. It’s traditional when learning a new language to write a small program that prints the text `Hello, world!` to the screen.

---

## Creating a Project Directory

Start by opening a terminal and creating a directory to hold your project code:

```bash
mkdir hello_world
cd hello_world
```

---

## Writing a Zen C Program

Next, create a new source file named `main.zc`. Zen C source files always use the `.zc` file extension.

Open `main.zc` in your editor and enter the following code:

**Listing 1-1: `list1-1.zc`**

```zenc
 1 | fn main() {
 2 |     println "Hello, world!";
 3 | }
```

Save the file.

---

## Running Your Program

You can compile and run your program in a single step using the `zc run` command:

```bash
zc run main.zc
```

You should see output similar to this:

```text
   Compiling main.zc...
     Running ./main
Hello, world!
```

Congratulations! You’ve officially written and executed your first Zen C program.

---

## Anatomy of a Zen C Program

Let's break down every part of this simple program in detail:

```zenc
fn main() {
    println "Hello, world!";
}
```

1. **`fn main()`**: The `fn` keyword declares a function. The function named `main` is special: it is the entry point for every executable Zen C program. Unlike standard C where you must declare return type `int main(void)` and explicit `return 0;`, Zen C automatically handles the return status setup for `main`.
2. **Curly Braces `{}`**: The function body is wrapped in curly braces (`{}`), defining the scope of the function block.
3. **`println "Hello, world!";`**: This line prints the string to standard output, followed by a newline character.
   - > [!IMPORTANT]
     > Note that in Zen C, `println` is a **keyword**, not a standard function call. Therefore, it does **not** take parentheses around its argument: `println "Hello, world!";`.
4. **Semicolon `;`**: Every statement in Zen C ends with a semicolon `;`.

---

## Compiling and Running as Separate Steps

`zc run` is convenient when you are rapidly developing, but you can also compile your program into a standalone executable binary using `zc build`:

```bash
zc build main.zc -o hello
```

This generates an optimized native binary named `hello` in your current directory. You can run it directly:

```bash
./hello
```

Output:
```text
Hello, world!
```

---

## Under the Hood: Transpiling to C

One of Zen C's most powerful features is **transparent compilation**. Zen C compiles into standard GNU C11 source code before invoking host compilers like GCC or Clang.

You can inspect the generated C code at any time using the `zc transpile` subcommand:

```bash
zc transpile main.zc -o main.c
```

Open `main.c`. You will see standard C headers (`stdio.h`, `stdlib.h`), type definitions, safety helpers, and the clean compiled `main` function:

```c
ZC_FUNC int main(void)
{
    {
        ({ fprintf(stdout, "%s", "Hello, world!"); fprintf(stdout, "\n"); 0; });
    }
}
```

Notice how `println "Hello, world!"` transpiles directly to standard C file stream printing (`fprintf(stdout, ...)`) without black boxes or external runtimes.

In the next section, we'll explore the `zc` toolchain in depth.
