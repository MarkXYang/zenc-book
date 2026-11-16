# Asset Embedding (`embed`) and Compiler Plugins

Systems tools frequently need to ship static assets—SQL schemas, shaders, HTML templates, or version banners—inside a single self-contained binary. Zen C supports this directly in the language with `embed`, and also lets you extend the transpiler itself with native compiler plugins.

## Embedding Files at Compile Time with `embed`

The `embed` expression reads a file during compilation and bakes its contents into the generated C source as static data:

- `embed "path"` returns a raw byte slice (`{ data, len }`).
- `embed "path" as string` embeds the contents as a null-terminated `string`.
- `embed "path" as u8[N]` embeds the contents into a fixed-size byte array of length `N`.

Note that `embed` resolves file paths relative to the current working directory from which `zc` is invoked.

```zenc
// File: examples/ch19/ch19-03-embed-plugins/main.zc

fn main() {
    println "Testing Asset Embedding (embed)...";

    // Embed as a compile-time string literal (path is relative to build CWD)
    let banner = embed "examples/ch19/ch19-03-embed-plugins/banner.txt" as string;
    println "Embedded string: {banner}";

    // Embed as a raw byte slice ({ data, len })
    let raw_bytes = embed "examples/ch19/ch19-03-embed-plugins/banner.txt";
    println "Embedded raw slice len = {raw_bytes.len}";
    assert(raw_bytes.len > 0, "Embedded slice must not be empty");

    // Embed into a fixed-size byte array (u8[41])
    let fixed = embed "examples/ch19/ch19-03-embed-plugins/banner.txt" as u8[41];
    assert(fixed[0] == 'Z', "First byte must be 'Z'");
    assert(fixed[4] == 'C', "Fifth byte must be 'C'");

    println "All embed checks passed!";
}
```

<span class="caption">Listing 19-3: Embedding an asset as a `string`, raw byte slice, and fixed-size `u8[N]` array</span>

## Extending the Transpiler with Compiler Plugins

When `comptime` string generation isn't enough—for instance, when you want to embed an entire domain-specific language (DSL) such as SQL, Lisp, or Forth directly inside `.zc` files—Zen C supports **native compiler plugins** via shared libraries (`.so`).

The plugin host interface is defined in `plugins/zprep_plugin.h` (`ZEN_PLUGIN_API_VERSION = 2`):

- A plugin implements `ZPluginTranspileFn`: `void transpile(const char *input_body, const ZApi *api)`.
- The `ZApi` struct gives the plugin access to `api->out` (inline C output stream), `api->hoist_out` (file-scope/header C output stream), diagnostics (`api->error`, `api->warn`, `api->note`), and build metadata (`api->config.target`, `api->config.cc`).
- Plugins can also optionally provide an LSP hover handler so IDE users get rich documentation when hovering over DSL blocks.

The Zen C repository ships example plugins in `plugins/` (including `sql.zc`, `lisp.zc`, `forth.zc`, `brainfuck.zc`, and `befunge.zc`) that demonstrate how custom syntax blocks are lowered into C at compile time.

> ### 🔍 Peek at the C
>
> An `embed "file" as u8[N]` expression lowers to a static C byte array initialized with the exact hex bytes of the file (`static const unsigned char _embed_0[41] = { 0x5a, ... };`). There is no runtime `fopen`, no external file dependency, and no startup allocation.
