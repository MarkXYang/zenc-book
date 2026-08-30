# Printing and String Interpolation

Zen C provides rich options for printing output to stdout and stderr, embedding expressions into strings via **string interpolation**, writing multiline strings, and handling interactive user input prompts.

---

## Printing Keywords

Zen C includes built-in keywords for printing formatted text to standard output (`stdout`) or standard error (`stderr`):

| Keyword | Destination | Trailing Newline | Description |
| :--- | :--- | :--- | :--- |
| `print "..."` | `stdout` | No | Prints text to `stdout` without adding a newline. |
| `println "..."` | `stdout` | **Yes** | Prints text to `stdout` **with** an automatic trailing newline. |
| `eprint "..."` | `stderr` | No | Prints error output to `stderr` without adding a newline. |
| `eprintln "..."` | `stderr` | **Yes** | Prints error output to `stderr` **with** an automatic trailing newline. |

```zenc
fn main() {
    print "Hello ";
    println "world!"; // Outputs: Hello world!

    eprint "Warning: ";
    eprintln "low disk space!"; // Outputs to stderr: Warning: low disk space!
}
```

---

## Printing Shorthands

Zen C allows string literals to be used directly as statements for rapid, concise console printing:

| Shorthand Syntax | Equivalent Keyword | Output Target & Behavior |
| :--- | :--- | :--- |
| `"Hz"` | `println "Hz"` | Prints to `stdout` **with** newline |
| `"Hz"..` | `print "Hz"` | Prints to `stdout` **without** newline |
| `!"Err"` | `eprintln "Err"` | Prints to `stderr` **with** newline |
| `!"Err"..` | `eprint "Err"` | Prints to `stderr` **without** newline |

```zenc
fn main() {
    "Processing item"..; // Equivalent to print
    " Done!";            // Equivalent to println

    !"Critical Error!"..; // Equivalent to eprint
    !" Details follow.";  // Equivalent to eprintln
}
```

---

## String Interpolation

You can embed variables and expressions directly into string literals using `{}` syntax.

In Zen C, string interpolation is **implicit**: any string literal containing `{...}` automatically transpiles into an interpolated string. You can also explicitly prefix a string with `f` (e.g., `f"..."`) to force format interpolation semantics.

```zenc
let count = 42;
let name = "Zen C";

// Implicit interpolation
println "Project: {name}, Items: {count}";

// Shorthand printing with interpolation
"Project: {name}, Items: {count}";
```

### 1. Escaping Literal Braces

To produce literal `{` or `}` characters inside an interpolated string, double the braces (`{{` and `}}`):

```zenc
let json = "JSON payload: {{\"status\": 200}}";
println "{json}"; // Output: JSON payload: {"status": 200}
```

### 2. Raw Strings (`r"..."`)

To define a string where escape sequences (`\n`, `\t`) and interpolation braces (`{...}`) are treated as literal text, prefix the string literal with `r`:

```zenc
let regex = r"\w+\d+"; // Contains literal backslashes
let raw_json = r'{"key": "value"}'; // No brace escaping required
```

---

## Multiline Strings (`"""..."""`)

Zen C supports raw multiline string blocks using triple quotes (`"""`). Multiline strings preserve newlines and quotes without requiring manual `\n` or `\"` escaping, making them ideal for embedded languages (GLSL, SQL, HTML) or code generation:

```zenc
let prompt = """
  Please enter your choice:
  1. Start game
  2. Exit
""";
```

### Prefixed Multiline Strings

Like single-line strings, multiline strings can be explicitly prefixed:
- `f"""..."""`: Explicitly marks the multiline block as **interpolated**.
- `r"""..."""`: Explicitly marks the multiline block as **raw** (disables interpolation and escape processing).

```zenc
let target = "Server";
let template = f"""
  Configuration for {target}:
  Status: ACTIVE
""";

let raw_script = r"""
  fn test() {
      println "{not_interpolated}";
  }
""";
```

---

## Interactive Input Prompts (`?`)

Zen C provides a shorthand syntax for asking user input using the `?` prefix operator.

### 1. Basic Input Prompt

- `? "Prompt text"`: Prints the prompt (without newline) and reads a line from stdin.

### 2. Scanning Variables (`? "Prompt" (var)`)

- `? "Enter age: " (age)`: Prints the prompt string and automatically scans the user input directly into `age`. Format specifiers are inferred based on the variable's type.

```zenc
fn main() {
    let age: int;

    // Prompts "How old are you? " and scans user input into `age`
    ? "How old are you? " (age);

    println "You are {age} years old.";
}
```

---

## Summary of Chapter 3

In Chapter 3, you mastered all the core foundational concepts of Zen C:
- **Variables & Constants** (`def`, `let`, type inference, `const`).
- **Data Types** (scalar types, C interop types, arbitrary bit-width `iN`/`uN`, literals, fixed-size arrays `T[N]`).
- **Functions & Lambdas** (named arguments, `const` args, defaults, closures `[=]`/`[&]`, raw pointers `fn*`, variadics `...`).
- **Control Flow** (`if`, `match` pattern matching, `ref` binding, range loops, enumerated iteration, `guard`, `unless`).
- **Operators** (operator overloading `add`/`sub`/`get`/`set`, string equality rules, pipeline `|>`, null coalescing `??`, safe navigation `?.`, auto-dereference).
- **Printing and String Interpolation** (`print`/`println`/`eprint`/`eprintln`, string shorthands `"Hz"`/`!"Err"`, implicit `{}` interpolation, raw strings `r"..."`, multiline blocks `"""`, input prompts `?`).

In **Chapter 4**, we will explore Zen C's automatic memory management and resource cleanup: **Drop and Memory Safety (RAII)**!
