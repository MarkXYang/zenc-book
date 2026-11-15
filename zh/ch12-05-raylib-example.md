# 12.5 实战示例：Raylib 图形窗口

为了将第 12 章所学的一切融会贯通——C 头文件导入、按值传递的 C 结构体、`@ctype` 字符串参数、`defer` 资源清理以及跨平台的 `//>` 构建指令——我们将使用 **[Raylib](https://www.raylib.com/)** 构建一个实时 2D 图形与物理模拟循环。

Raylib 是展现 Zen C 零开销 C ABI 兼容性的理想范例，因为它的 API 在 CPU 寄存器中**按值传递**小型结构体（`Vector2`、`Color`、`Rectangle`），并通过显式的 `InitWindow` / `CloseWindow` 对管理操作系统窗口与 OpenGL 上下文。

---

## 1. 使用 `import "raylib.h" as rl` 的跨平台桌面窗口

如果你的系统中已经安装了 Raylib（例如通过 `apt install libraylib-dev`、`pacman -S raylib` 或 `brew install raylib`），你可以使用 `import "raylib.h" as rl;` 在单个 `.zc` 文件中编写一个完整的跨平台图形应用程序：

```zenc
// Cross-platform Raylib build directives:
//> linux: link: -lraylib -lm -lpthread -ldl -lrt -lX11
//> macos: pkg-config: raylib
//> macos: framework: OpenGL Cocoa IOKit CoreVideo
//> windows: link: -lraylib -lopengl32 -lgdi32 -lwinmm

import "raylib.h" as rl;

def SCREEN_WIDTH = 800;
def SCREEN_HEIGHT = 450;

fn main() {
    rl::InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "Zen C + Raylib Bouncing Ball");
    // Guarantee the OpenGL context and OS window close cleanly when main() exits:
    defer rl::CloseWindow();

    rl::SetTargetFPS(60);

    let ball_pos = rl::Vector2{ x: 400.0, y: 225.0 };
    let ball_vel = rl::Vector2{ x: 240.0, y: 180.0 };
    let ball_radius: f32 = 24.0;

    while !rl::WindowShouldClose() {
        let dt: f32 = rl::GetFrameTime();

        // Integrate velocity
        ball_pos.x = ball_pos.x + (ball_vel.x * dt);
        ball_pos.y = ball_pos.y + (ball_vel.y * dt);

        // Bounce off horizontal walls
        if (ball_pos.x + ball_radius >= (f32)SCREEN_WIDTH) || (ball_pos.x - ball_radius <= 0.0) {
            ball_vel.x = -ball_vel.x;
        }
        // Bounce off vertical walls
        if (ball_pos.y + ball_radius >= (f32)SCREEN_HEIGHT) || (ball_pos.y - ball_radius <= 0.0) {
            ball_vel.y = -ball_vel.y;
        }

        rl::BeginDrawing();
        rl::ClearBackground(rl::RAYWHITE);
        rl::DrawText("Zen C Zero-Overhead Raylib FFI", 20, 20, 20, rl::DARKGRAY);
        rl::DrawCircleV(ball_pos, ball_radius, rl::MAROON);
        rl::DrawFPS(SCREEN_WIDTH - 100, 20);
        rl::EndDrawing();
    }
}
```

### 为何能无缝协作

1. **跨平台 `//>` 指令**：只需一条 `zc run` 命令，即可链接适当的平台库（Linux 上链接 `-lraylib -lX11`，macOS 上链接 `Cocoa`/`IOKit` framework，Windows 上链接 `opengl32`/`gdi32`/`winmm`）。
2. **RAII 窗口生命周期（`defer`）**：在 `rl::InitWindow(...)` 之后立即放置 `defer rl::CloseWindow();`，可确保在 `main` 返回时干净地销毁 GPU 上下文与窗口。
3. **按值传递 C 结构体**：`rl::Vector2{ x: 400.0, y: 225.0 }` 会编译为标准 C99 复合字面量 `(Vector2){.x = 400.0, .y = 225.0}`，并直接在浮点寄存器中传递给 `DrawCircleV`。

---

## 2. 自包含的可运行示例（无头 Raylib 模拟器）

在编写自动化测试或在没有 X11/Wayland 显示器或 GPU 的无头（headless）CI 服务器上运行时，你可以将 Zen C 的显式 FFI 绑定（`struct Vector2`、`struct Color`、`extern fn` 和 `@link_name`）与轻量级 C 模拟器后端配对使用。

以下完整示例（`examples/ch12/ch12-05-raylib-example/main.zc`）使用与 Raylib 完全相同的数据结构和函数签名，并在 60 FPS 下单步执行 5 帧，以便你可以在任何机器上运行和验证它：

```zenc
// File: examples/ch12/ch12-05-raylib-example/main.zc
//> link: -lm

// Self-contained Raylib-compatible C ABI types & headless window simulator
// (Allows running `zc run main.zc` on CI or headless machines without a display)
raw {
    typedef struct Vector2 {
        float x;
        float y;
    } Vector2;

    typedef struct Color {
        unsigned char r;
        unsigned char g;
        unsigned char b;
        unsigned char a;
    } Color;

    static int g_window_open = 0;
    static int g_frame_counter = 0;
    static int g_max_frames = 5;

    void sim_InitWindow(int width, int height, const char* title) {
        g_window_open = 1;
        g_frame_counter = 0;
        printf("[Raylib Sim] InitWindow(%d, %d, \"%s\")\n", width, height, title);
    }

    void sim_SetTargetFPS(int fps) {
        printf("[Raylib Sim] SetTargetFPS(%d)\n", fps);
    }

    bool sim_WindowShouldClose(void) {
        return g_frame_counter >= g_max_frames;
    }

    float sim_GetFrameTime(void) {
        return 1.0f / 60.0f;
    }

    void sim_BeginDrawing(void) {}

    void sim_ClearBackground(Color color) {
        (void)color;
    }

    void sim_DrawCircleV(Vector2 center, float radius, Color color) {
        printf("  Frame #%d -> DrawCircleV(pos=(%.1f, %.1f), r=%.1f, rgba=(%u,%u,%u,%u))\n",
               g_frame_counter + 1, center.x, center.y, radius,
               color.r, color.g, color.b, color.a);
    }

    void sim_EndDrawing(void) {
        g_frame_counter += 1;
    }

    void sim_CloseWindow(void) {
        g_window_open = 0;
        printf("[Raylib Sim] CloseWindow() called cleanly via defer\n");
    }
}

// 1. Matching C ABI value structs in Zen C
struct Vector2 {
    x: f32,
    y: f32,
}

struct Color {
    r: u8,
    g: u8,
    b: u8,
    a: u8,
}

// 2. FFI bindings mapped to Raylib API names via @link_name
@link_name("sim_InitWindow")
extern fn InitWindow(width: c_int, height: c_int, @ctype("const char*") title: string);

@link_name("sim_SetTargetFPS")
extern fn SetTargetFPS(fps: c_int);

@link_name("sim_WindowShouldClose")
extern fn WindowShouldClose() -> bool;

@link_name("sim_GetFrameTime")
extern fn GetFrameTime() -> f32;

@link_name("sim_BeginDrawing")
extern fn BeginDrawing();

@link_name("sim_ClearBackground")
extern fn ClearBackground(color: Color);

@link_name("sim_DrawCircleV")
extern fn DrawCircleV(center: Vector2, radius: f32, color: Color);

@link_name("sim_EndDrawing")
extern fn EndDrawing();

@link_name("sim_CloseWindow")
extern fn CloseWindow();

def SCREEN_WIDTH = 800;
def SCREEN_HEIGHT = 450;

fn main() {
    InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "Zen C + Raylib FFI Demo");
    defer CloseWindow();

    SetTargetFPS(60);

    let ball_pos = Vector2{ x: 400.0, y: 225.0 };
    let ball_vel = Vector2{ x: 240.0, y: 180.0 };
    let ball_radius: f32 = 20.0;

    let bg_color = Color{ r: (u8)24, g: (u8)24, b: (u8)36, a: (u8)255 };
    let ball_color = Color{ r: (u8)230, g: (u8)41, b: (u8)55, a: (u8)255 };

    while !WindowShouldClose() {
        let dt: f32 = GetFrameTime();

        // Update ball position
        ball_pos.x = ball_pos.x + (ball_vel.x * dt);
        ball_pos.y = ball_pos.y + (ball_vel.y * dt);

        BeginDrawing();
        ClearBackground(bg_color);
        DrawCircleV(ball_pos, ball_radius, ball_color);
        EndDrawing();
    }

    assert(ball_pos.x == 420.0 && ball_pos.y == 240.0, "After 5 frames at 60 FPS, ball moved +(20, 15)");
}
```

使用 `zc run` 运行该模拟：

```bash
$ zc run examples/ch12/ch12-05-raylib-example/main.zc
[Raylib Sim] InitWindow(800, 450, "Zen C + Raylib FFI Demo")
[Raylib Sim] SetTargetFPS(60)
  Frame #1 -> DrawCircleV(pos=(404.0, 228.0), r=20.0, rgba=(230,41,55,255))
  Frame #2 -> DrawCircleV(pos=(408.0, 231.0), r=20.0, rgba=(230,41,55,255))
  Frame #3 -> DrawCircleV(pos=(412.0, 234.0), r=20.0, rgba=(230,41,55,255))
  Frame #4 -> DrawCircleV(pos=(416.0, 237.0), r=20.0, rgba=(230,41,55,255))
  Frame #5 -> DrawCircleV(pos=(420.0, 240.0), r=20.0, rgba=(230,41,55,255))
[Raylib Sim] CloseWindow() called cleanly via defer
```

---

## 🔍 窥探底层 C 代码

在转译出的 C11 输出中，注意 `Vector2` 和 `Color` 是如何通过零开销复合字面量进行初始化的，`while !WindowShouldClose()` 通过 `@link_name` 直接调用 `sim_WindowShouldClose()`，而 `defer CloseWindow();` 会在 `main` 结尾处自动发射：

```c
ZC_FUNC int main(void)
{
    {
        sim_InitWindow(800, 450, "Zen C + Raylib FFI Demo");
        sim_SetTargetFPS(60);

        Vector2 ball_pos = (Vector2){.x = 400.0, .y = 225.0};
        Vector2 ball_vel = (Vector2){.x = 240.0, .y = 180.0};
        float ball_radius = 20.0;

        Color bg_color = (Color){.r = (uint8_t)(24), .g = (uint8_t)(24), .b = (uint8_t)(36), .a = (uint8_t)(255)};
        Color ball_color = (Color){.r = (uint8_t)(230), .g = (uint8_t)(41), .b = (uint8_t)(55), .a = (uint8_t)(255)};

        while ((!sim_WindowShouldClose())) {
            float dt = sim_GetFrameTime();
            (ball_pos.x = (ball_pos.x + (ball_vel.x * dt)));
            (ball_pos.y = (ball_pos.y + (ball_vel.y * dt)));

            sim_BeginDrawing();
            sim_ClearBackground(bg_color);
            sim_DrawCircleV(ball_pos, ball_radius, ball_color);
            sim_EndDrawing();
        }

        __zenc_assert(((ball_pos.x == 420.0) && (ball_pos.y == 240.0)),
                      "After 5 frames at 60 FPS, ball moved +(20, 15)");

        // Emitted from `defer CloseWindow();`:
        sim_CloseWindow();
    }
}
```
