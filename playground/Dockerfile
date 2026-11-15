FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    python3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Build and install Zen C from upstream
RUN git clone --depth 1 https://github.com/zenc-lang/zenc.git /opt/Zen-C \
    && make -C /opt/Zen-C \
    && make -C /opt/Zen-C install

RUN useradd --create-home --shell /bin/bash runner
USER runner

WORKDIR /app
COPY server.py /app/server.py

EXPOSE 8787
ENV ZENC_PLAYGROUND_HOST=0.0.0.0
ENV ZENC_PLAYGROUND_PORT=8787

CMD ["python3", "/app/server.py"]
