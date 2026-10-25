# 12.5 Hands-on Example: Raylib Graphics Window

To bring together everything in Chapter 12—C header imports, value-passed C structs, `@ctype` string parameters, `defer` resource cleanup, and cross-platform `//>` build directives—let's build a real-time 2D graphics and physics loop using **[Raylib](https://www.raylib.com/)**.

Raylib is an ideal showcase for Zen C's zero-overhead C ABI compatibility because its API passes small structs (`Vector2`, `Color`, `Rectangle`) **by value** in CPU registers and manages OS window/OpenGL contexts through explicit `InitWindow` / `CloseWindow` pairs.

---

## 1. Cross-Platform Desktop Window with `import "raylib.h" as rl`

If you have Raylib installed on your system (e.g., via `apt install libraylib-dev`, `pacman -S raylib`, or `brew install raylib`), you can write a complete, cross-platform graphical application in a single `.zc` file using `import "raylib.h" as rl;`:

```zc
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

### What Makes This Work Seamlessly

1. **Cross-Platform `//>` Directives**: A single `zc run` command links the appropriate platform libraries (`-lraylib -lX11` on Linux, `Cocoa`/`IOKit` frameworks on macOS, or `opengl32`/`gdi32`/`winmm` on Windows).
2. **RAII Window Lifecycle (`defer`)**: Placing `defer rl::CloseWindow();` immediately after `rl::InitWindow(...)` ensures the GPU context and window are destroyed cleanly when `main` returns.
3. **Pass-by-Value C Structs**: `rl::Vector2{ x: 400.0, y: 225.0 }` compiles to a standard C99 compound literal `(Vector2){.x = 400.0, .y = 225.0}` passed directly in floating-point registers to `DrawCircleV`.

---

## 2. Self-Contained Runnable Example (Headless Raylib Simulator)

When writing automated tests or running on headless CI servers without an X11/Wayland display or GPU, you can pair Zen C's explicit FFI bindings (`struct Vector2`, `struct Color`, `extern fn`, and `@link_name`) with a lightweight C simulator backend.

The following complete example (`examples/ch12/ch12-05-raylib-example/main.zc`) uses the exact Raylib data structures and function signatures while stepping through 5 frames at 60 FPS so you can run and verify it on any machine:

```zc
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

Run the simulation with `zc run`:

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

## 🔍 Peek at the C

In the transpiled C11 output, notice how `Vector2` and `Color` are initialized with zero-overhead compound literals, `while !WindowShouldClose()` calls `sim_WindowShouldClose()` directly via `@link_name`, and `defer CloseWindow();` is emitted automatically at the end of `main`:

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
