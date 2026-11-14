// File: examples/ch20/ch20-05-embedding-zc/main.c
//
// Host C program that calls into compiled Zen C functions.
//
// Build & link:
//   zc build zenc_math.zc -c -o zenc_math.o
//   gcc main.c zenc_math.o -o host_app
//   ./host_app

#include <stdio.h>
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>

// Declarations of exported Zen C functions
int zenc_add(int a, int b);
int zenc_fibonacci(int n);
float zenc_dot_product(const float *a, const float *b, int len);

int main(void) {
    printf("Embedding Zen C in a C Application\n");

    int sum = zenc_add(15, 27);
    printf("zenc_add(15, 27) = %d\n", sum);
    assert(sum == 42);

    int fib10 = zenc_fibonacci(10);
    printf("zenc_fibonacci(10) = %d\n", fib10);
    assert(fib10 == 55);

    float vec_a[] = {1.0f, 2.0f, 3.0f};
    float vec_b[] = {4.0f, 5.0f, 6.0f};
    float dot = zenc_dot_product(vec_a, vec_b, 3);
    printf("zenc_dot_product = %.1f\n", dot);
    assert(dot == 32.0f);

    printf("Successfully embedded Zen C module into native C host!\n");
    return 0;
}
