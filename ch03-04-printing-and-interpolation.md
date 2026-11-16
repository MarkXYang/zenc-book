# Comments, Printing and String Interpolation

This section covers how to annotate code with comments, print output to stdout and stderr, embed expressions into strings via **string interpolation**, write multiline strings, and read interactive user input.

---

## Comments

Zen C uses the same comment syntax as C, plus a documentation comment form:

| Syntax | Kind | Description |
| :--- | :--- | :--- |
| `// ...` | Line comment | Ignored until the end of the line. |
| `/* ... */` | Block comment | Can span several lines. |
| `/// ...` | Documentation comment | Attached to the next declaration; collected by `zc-doc`. |

```zenc
/// Returns the area of a width-by-height rectangle.
fn area(width: int, height: int) -> int {
    // Multiply the two sides.
    return width * height; /* inline block comment */
}

fn main() {
    println "Area: {area(3, 4)}"; // prints 12
}
```

Running `zc-doc` on this file produces Markdown that includes the `///` text above the signature of `area`. You will see more of `zc-doc` in [Chapter 15](ch15-04-developer-tooling.md).

---

## Printing Keywords

Zen C includes built-in keywords for printing formatted text to standard output (`stdout`) or standard error (`stderr`):

| Keyword | Destination | Trailing Newline | Description |
| :--- | :--- | :--- | :--- |
| `print "..."` | `stdout` | No | Prints text to `stdout` without adding a newline. |
| `println "..."` | `stdout` | **Yes** | Prints text to `stdout` **with** an automatic trailing newline. |
| `eprint "..."` | `stderr` | No | Prints error output to `stderr` without adding a newline. |
| `eprintln "..."` | `stderr` | **Yes** | Prints error output to `stderr` **with** an automatic trailing newline. |

**Listing 3-5**
```zenc
fn main() {
    print "Hello ";
    println "world!";

    eprint "Warning: ";
    eprintln "low disk space!";
}
```

Output:
```text
Hello world!
```

Stderr:
```text
Warning: low disk space!
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

**Listing 3-6**
```zenc
fn main() {
    "Processing item"..; // Equivalent to print
    " Done!";            // Equivalent to println

    !"Critical Error!"..; // Equivalent to eprint
    !" Details follow.";  // Equivalent to eprintln
}
```

Output:
```text
Processing item Done!
```

Stderr:
```text
Critical Error! Details follow.
```

---

## String Interpolation

You can embed variables and expressions directly into string literals using `{}` syntax.

In Zen C, string interpolation is **implicit**: any string literal containing `{...}` automatically transpiles into an interpolated string. You can also explicitly prefix a string with `f` (e.g., `f"..."`) to force format interpolation semantics.

**Listing 3-7**
```zenc
let count = 42;
let name = "Zen C";

// Implicit interpolation
println "Project: {name}, Items: {count}";

// Shorthand printing with interpolation
"Project: {name}, Items: {count}";
```

Output:
```text
Project: Zen C, Items: 42
Project: Zen C, Items: 42
```

### 1. Escaping Literal Braces

To produce literal `{` or `}` characters inside an interpolated string, double the braces (`{{` and `}}`):

**Listing 3-8**
```zenc
let json = "JSON payload: {{\"status\": 200}}";
println "{json}";
```

Output:
```text
JSON payload: {"status": 200}
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

**Listing 3-9**
```zenc
fn main() {
    let age: int;

    // Prompts "How old are you? " and scans user input into `age`
    ? "How old are you? " (age);

    println "You are {age} years old.";
}
```

Output (with input `25`):
```text
How old are you? 25
You are 25 years old.
```

---

Next, let's look at how Zen C controls the flow of execution with conditionals and loops!
