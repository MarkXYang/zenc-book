# Programming a Guessing Game

Let's jump into Zen C by working through a hands-on project together! This chapter introduces core Zen C concepts by showing you how to use them in a real program. You'll learn about variables, user input, conditional control flow, loops, string interpolation, and standard C library interoperability.

We will build a classic beginner programming problem: a **number guessing game**. Here is how it works:
1. The program generates a random secret number between 1 and 100.
2. It prompts the player to type a guess.
3. Upon entering a guess, the program indicates whether the guess is **too high**, **too low**, or **correct**.
4. If the guess is correct, the game prints a congratulatory message and exits. Otherwise, it prompts for another guess until the player wins.

---

## Setting Up a New Project

To set up a new project, create a new directory for the game and navigate into it:

```bash
mkdir guessing_game
cd guessing_game
```

Create a new source file named `main.zc`:

```bash
touch main.zc
```

---

## Processing a User's Guess

Let's start by prompting the user for input and echoing the input back to the screen. Open `main.zc` and add the following code:

```zenc
fn main() {
    println "=== Guess the Number! ===";

    print "Please input your guess: ";

    let guess: int = 0;
    scanf("%d", &guess);

    println "You guessed: {guess}";
}
```

### Explaining the Code Line by Line

Let's examine every part of this code:

1. **`fn main()`**: As you learned in Chapter 1, `fn main()` is the entry point of your program.
2. **`println "=== Guess the Number! ===";`**: Prints the header title followed by a newline. Remember that `println` is a statement keyword in Zen C and does not require parentheses.
3. **`print "Please input your guess: ";`**: Unlike `println`, `print` outputs text without adding a newline at the end. This leaves the terminal cursor on the same line so the user can type their input right after the prompt.
4. **`let guess: int = 0;`**:
   - The `let` keyword introduces a variable declaration.
   - `: int` explicitly specifies the type of `guess` as a 32-bit signed integer.
   - `=` assigns the initial value `0`.
5. **`scanf("%d", &guess);`**: Zen C transpiles directly to standard C. Standard C library functions like `scanf` can be invoked directly to read input into the pointer address of `guess` (`&guess`).
6. **`println "You guessed: {guess}";`**: Zen C provides powerful **string interpolation**. Any variable placed inside `{}` brackets within a string literal is automatically formatted and displayed at runtime without needing manual format specifier placeholders!

### Testing the First Part

Compile and run your program using `zc run`:

```bash
zc run main.zc
```

Output:
```text
=== Guess the Number! ===
Please input your guess: 42
You guessed: 42
```

---

## Generating a Secret Number

Next, we need to generate a random secret number between 1 and 100 so that the game is fun to play every time.

Update `main.zc` to seed the random number generator and produce a secret integer:

```zenc
fn main() {
    println "=== Guess the Number! ===";

    // Seed the random number generator with current Unix time
    srand(time(0));
    let secret_number = (rand() % 100) + 1;

    print "Please input your guess: ";

    let guess: int = 0;
    scanf("%d", &guess);

    println "You guessed: {guess}";
}
```

### Understanding Type Inference (`let`)

Notice how `secret_number` was declared:

```zenc
let secret_number = (rand() % 100) + 1;
```

In Zen C, you don't always have to write explicit type annotations like `: int`. Zen C features **automatic type inference**. Because `rand()` returns an integer, Zen C automatically infers that `secret_number` is of type `int`.

- `rand() % 100` generates a random integer from `0` to `99`.
- Adding `+ 1` shifts the range to `1` through `100`.

---

## Comparing the Guess to the Secret Number

Now that we have both a user guess and a secret number, we can compare them using `if`, `else if`, and `else` conditional statements.

Update `main.zc`:

```zenc
fn main() {
    println "=== Guess the Number! ===";

    srand(time(0));
    let secret_number = (rand() % 100) + 1;

    print "Please input your guess: ";

    let guess: int = 0;
    scanf("%d", &guess);

    println "You guessed: {guess}";

    if guess < secret_number {
        println "Too small!";
    } else if guess > secret_number {
        println "Too big!";
    } else {
        println "You win!";
    }
}
```

Output:
```text
=== Guess the Number! ===
Please input your guess: 50
You guessed: 50
Too small!
```

### How Comparisons Work

- `if guess < secret_number`: Checks if the user's guess is less than the secret number. If true, it prints `"Too small!"`.
- `else if guess > secret_number`: Checks if the guess is greater than the secret number. If true, it prints `"Too big!"`.
- `else`: If neither is true, the guess must be equal to the secret number, printing `"You win!"`.

---

## Allowing Multiple Guesses with Looping

Currently, the game exits after taking only a single guess. To allow the player to keep guessing until they find the secret number, we wrap the guessing logic in an infinite `loop`.

Update `main.zc` to include a `loop` block and `break` statements:

```zenc
fn main() {
    println "=== Guess the Number! ===";

    // Seed the random number generator
    srand(time(0));
    let secret_number = (rand() % 100) + 1;

    loop {
        print "Please input your guess: ";

        let guess: int = 0;
        if scanf("%d", &guess) != 1 {
            println "Please enter a valid integer!";
            break;
        }

        println "You guessed: {guess}";

        if guess < secret_number {
            println "Too small!";
        } else if guess > secret_number {
            println "Too big!";
        } else {
            println "You win! You guessed the secret number!";
            break; // Exit the loop on victory
        }
    }
}
```

### Explaining the Loop Control Flow

1. **`loop { ... }`**: Creates an infinite loop. The code inside the curly braces repeats indefinitely until a `break` statement is reached.
2. **`if scanf("%d", &guess) != 1`**: Validates input. If `scanf` fails to read an integer (for instance, if the user inputs text or sends EOF), the game alerts the player and breaks out of the loop safely.
3. **`break;`**: Exits the `loop` immediately once the user correctly guesses the secret number.

---

## Complete Executable Code

Here is the complete, working code for your Zen C Guessing Game:

```zenc
fn main() {
    println "=== Guess the Number! ===";

    // Seed the random number generator
    srand(time(0));
    let secret_number = (rand() % 100) + 1;

    loop {
        print "Please input your guess: ";

        let guess: int = 0;
        if scanf("%d", &guess) != 1 {
            println "Please enter a valid integer!";
            break;
        }

        println "You guessed: {guess}";

        if guess < secret_number {
            println "Too small!";
        } else if guess > secret_number {
            println "Too big!";
        } else {
            println "You win! You guessed the secret number!";
            break;
        }
    }
}
```

---

## Building and Playing the Game

Compile your game into an optimized native executable binary using `zc build`:

```bash
zc build main.zc -o guessing_game
```

Now launch and play your game!

```bash
./guessing_game
```

Example Gameplay:
```text
=== Guess the Number! ===
Please input your guess: 50
You guessed: 50
Too small!
Please input your guess: 75
You guessed: 75
Too big!
Please input your guess: 62
You guessed: 62
You win! You guessed the secret number!
```

---

## Summary

In Chapter 2, you successfully built a complete interactive project in Zen C! You learned how to:
- Declare variables with explicit types (`let guess: int`) or automatic type inference (`let secret_number`).
- Perform standard input/output using `print`, `println`, and string interpolation (`{guess}`).
- Execute conditional logic with `if`, `else if`, and `else`.
- Create repeating execution loops using `loop` and controlled exit with `break`.
- Seamlessly interoperate with standard C functions (`rand`, `srand`, `time`, `scanf`).

In **Chapter 3**, we will explore Zen C's common programming concepts in depth: variables, constants, primitive data types, functions, lambdas, and advanced control flow constructs!
