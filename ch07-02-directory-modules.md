# Directory Modules and Re-exports

## 4. Directory Modules (`mod.zc`)

As projects grow, related functionality is often grouped into folders. Zen C supports **Directory Modules** using the `mod.zc` convention (similar to Rust's `mod.rs` or Python's `__init__.py`).

Consider the following project directory structure:

```text
my_project/
├── main.zc
└── network/
    ├── mod.zc
    ├── packet.zc
    └── socket.zc
```

Inside `network/mod.zc`, we define the public interface of the `network` module and import its internal submodules:

```zenc
// network/mod.zc
import "./packet.zc" as packet;

def DEFAULT_PORT = 8080;

fn connect(host: string, port: int) {
    println "Connecting to {host}:{port}...";
}
```

From `main.zc`, you can import the entire `network` folder directly:

**Listing 7-6: `list7-6.zc`**

```zenc
 1 | // main.zc
 2 | import "./network";
 3 |
 4 | fn main() {
 5 |     connect("127.0.0.1", DEFAULT_PORT);
 6 | }
```

Output:
```text
Connecting to 127.0.0.1:8080...
```

Or import the directory module with an explicit namespace:

**Listing 7-7: `list7-7.zc`**

```zenc
 1 | // main.zc
 2 | import "network/mod.zc" as net;
 3 |
 4 | fn main() {
 5 |     net::connect("127.0.0.1", net::DEFAULT_PORT);
 6 | }
```

Output:
```text
Connecting to 127.0.0.1:8080...
```

### Re-Exporting Modules (`export import`)

A module can re-export another module or submodule using `export import`:

```zenc
// network/mod.zc
export import "./packet.zc" as packet;
```

Now, any consumer that imports `network` can also access `packet` through the `network` namespace!

---
