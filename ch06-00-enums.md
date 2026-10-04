# Enums and Pattern Matching

In [Chapter 5](ch05-00-structs.md), we explored structs, which allow you to bundle multiple related fields together into a single composite type. Structs are *Product Types* ($A 	imes B$): an instance of a struct contains field $A$ **and** field $B$.

However, real-world systems programming frequently requires modeling values that can be one of several possible alternatives at any given time:
- A network connection is either **Connecting**, **Connected**, **Idle**, or **Closed**.
- An HTTP response returns either a **Success** payload or an **Error** code.
- A user interface event is either a **Mouse Click** with coordinates, a **Key Press** with a character code, or a **Quit** request.

To represent these data structures safely and expressively, Zen C provides **Enums** (*Sum Types* or *Tagged Unions*).

---

## Chapter Roadmap

This chapter is organized into three sections:

1. **[Defining an Enum](ch06-01-defining-an-enum.md)**: Declaring enums, attaching payloads (unit, single, and tuple variants), tagged union C11 memory layouts, and methods on enums.
2. **[The match Construct](ch06-02-match.md)**: Exhaustive matching, wildcards (`_`), multiple patterns (`||`), and matching ranges.
3. **[Patterns and Destructuring](ch06-03-patterns.md)**: Reference binding (`ref`) to inspect values without moving ownership, destructuring in `let` statements, and pattern destructuring in loops.

Let's begin by defining our first enum!
