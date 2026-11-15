# Zen C Book Playground Runner

This directory provides the backend runner for the **Run** / **Edit** buttons embedded in the HTML edition of *The Zen C Programming Language*.

## Local Development

1. Start the playground runner (requires `zc` in `PATH`):

```sh
python3 playground/server.py
```

By default, it listens on `http://127.0.0.1:8787`.

2. Serve the book with `mdbook`:

```sh
mdbook serve --open
```

Any runnable ```` ```zenc ```` block (containing `fn main` or `test "..."`) will show **Edit** and **Run** buttons.

## Production / Public Deployment

For public hosting, run `playground/server.py` inside an isolated container with strict resource and network limits:

```sh
docker build -t zenc-playground ./playground
docker run -d \
  --name zenc-playground \
  -p 8787:8787 \
  --network=none \
  --read-only \
  --tmpfs /tmp:rw,exec,nosuid,size=64m \
  --pids-limit=64 \
  --memory=256m \
  --cpus=1 \
  zenc-playground
```

To point the static HTML book at a hosted playground URL, set `window.ZENC_PLAYGROUND_URL = "https://your-playground.example.com/run";` before `theme/playground.js` loads (or edit the default URL in `theme/playground.js`).
