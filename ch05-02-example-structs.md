# An Example Program Using Structs

To understand when and why to use structs, let's write a program that calculates the area of a rectangle. We'll start with single variables and then refactor the program until we're using structs instead.

---

## 1. Single Variables

Open your editor and create a program that computes the area of a rectangle specified by individual width and height variables:

```zenc
fn area(width: u32, height: u32) -> u32 {
    return width * height;
}

fn main() {
    let width1 = 30;
    let height1 = 50;

    println "The area of the rectangle is {area(width1, height1)} square pixels.";
}
```

While this works, the `area` function takes two separate parameters, and nowhere in our program is it clear that the parameters are related.

---

## 2. Refactoring with Structs

We can give meaning to the data by labeling width and height as fields of a `Rectangle` struct:

```zenc
struct Rectangle {
    width: u32;
    height: u32;
}

fn area(rect: Rectangle*) -> u32 {
    return rect.width * rect.height;
}

fn main() {
    let rect1 = Rectangle {
        width: 30,
        height: 50,
    };

    println "The area of the rectangle is {area(&rect1)} square pixels.";
}
```

Notice how much clearer this is: `area` now accepts a borrowed reference `Rectangle*`, signaling that both dimensions belong to a single geometric shape.

---

## 3. Extending the Model

Once the dimensions are grouped into one type, adding related behavior becomes straightforward. For example, we can add perimeter calculation and rectangle comparison without changing every call site:

```zenc
struct Rectangle {
    width: u32;
    height: u32;
}

fn area(rect: Rectangle*) -> u32 {
    return rect.width * rect.height;
}

fn perimeter(rect: Rectangle*) -> u32 {
    return 2 * (rect.width + rect.height);
}

fn can_hold(outer: Rectangle*, inner: Rectangle*) -> bool {
    return outer.width > inner.width && outer.height > inner.height;
}

fn main() {
    let screen = Rectangle { width: 1920, height: 1080 };
    let widget = Rectangle { width: 640, height: 300 };

    println "screen area: {area(&screen)}";
    println "screen perimeter: {perimeter(&screen)}";
    println "screen can hold widget: {can_hold(&screen, &widget)}";
}
```

This is exactly why structs matter: they turn related loose values into one coherent type that you can pass, validate, and evolve safely.

In the next section, we'll turn `area` into a **method** attached directly to the `Rectangle` type!
