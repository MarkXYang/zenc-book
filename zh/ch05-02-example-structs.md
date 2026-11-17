# 使用结构体的示例程序

为了理解何时以及为何使用结构体，让我们编写一个计算矩形面积的程序。我们将从使用单个变量开始，然后逐步重构程序，直到改为使用结构体。

---

## 1. 单个变量

打开你的编辑器，创建一个通过独立的宽度和高度变量计算矩形面积的程序：

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

虽然这样可以正常运行，但 `area` 函数接受两个独立的参数，而且在我们的程序中没有任何地方明确表示这两个参数是相关的。

---

## 2. 使用结构体进行重构

我们可以通过将宽度和高度标注为 `Rectangle` 结构体的字段来为数据赋予意义：

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

注意这清晰了许多：`area` 现在接受一个借用引用 `Rectangle*`，表明这两个维度属于同一个几何形状。

---

## 3. 扩展这个模型

一旦把维度归并到一个类型里，继续添加相关行为就会非常直接。例如，我们可以在不改动所有调用点的前提下，增加周长计算和矩形比较：

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

这正是结构体的价值所在：把相关但分散的值收敛成一个连贯的类型，便于传递、校验和持续演进。

在下一节中，我们将把 `area` 转变为直接附加到 `Rectangle` 类型上的**方法**！
