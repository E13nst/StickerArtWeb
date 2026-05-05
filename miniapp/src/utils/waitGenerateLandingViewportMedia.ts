/**
 * Дожидается загрузки и decode картинок в viewport перед анимацией снятия boot overlay —
 * чтобы при съезжающем лоадере уже были видны герой, лента источников, шапка и видимые плитки.
 */
export async function waitGenerateLandingViewportMedia(deadlineMs = 11500): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const start = performance.now();
  const timeLeft = (): number => Math.max(48, deadlineMs - (performance.now() - start));

  const vv = window.visualViewport;
  const vHeight = vv?.height ?? window.innerHeight;
  const slack = Math.min(180, Math.round(vHeight * 0.14));

  const inViewportApprox = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.height < 2 || r.width < 2) return false;
    return (
      r.bottom > -slack &&
      r.top < vHeight + slack &&
      r.right > 0 &&
      r.left < (vv?.width ?? window.innerWidth) + slack
    );
  };

  async function fontsAndFrames(): Promise<void> {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  }

  const promoteLazyInViewport = (): void => {
    for (const sel of ['.generate-page', '.header-panel'] as const) {
      const root = document.querySelector(sel);
      if (!root) continue;
      for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
        try {
          if (img.loading === 'lazy' && inViewportApprox(img)) img.loading = 'eager';
        } catch {
          /* ignore */
        }
      }
    }
  };

  const waitOneImage = (img: HTMLImageElement, budgetMs: number): Promise<void> => {
    if (!img.src && !img.currentSrc) return Promise.resolve();
    if (img.complete && img.naturalHeight > 0) {
      return img.decode().catch(() => undefined);
    }
    return new Promise<void>((resolve) => {
      let done = false;
      const cleanup = (): void => {
        clearTimeout(timer);
        img.removeEventListener('load', onLoad as EventListener);
        img.removeEventListener('error', onErr as EventListener);
      };
      const finish = (): void => {
        if (done) return;
        done = true;
        cleanup();
        void img.decode().catch(() => undefined).finally(() => resolve());
      };
      const timer = window.setTimeout(finish, Math.max(96, budgetMs));
      const onLoad = (): void => finish();
      const onErr = (): void => finish();
      img.addEventListener('load', onLoad, { once: true });
      img.addEventListener('error', onErr, { once: true });
    });
  };

  let missingRootPasses = 0;

  while (performance.now() - start < deadlineMs - 36) {
    await fontsAndFrames();
    promoteLazyInViewport();

    const pageRoot = document.querySelector('.generate-page');
    if (!pageRoot) {
      missingRootPasses += 1;
      await new Promise<void>((r) => setTimeout(r, 40));
      if (missingRootPasses > 50) return;
      continue;
    }
    missingRootPasses = 0;

    const imgs: HTMLImageElement[] = [];
    document
      .querySelectorAll<HTMLImageElement>('.generate-page img, .header-panel img')
      .forEach((img) => {
        if (inViewportApprox(img)) imgs.push(img);
      });

    const pending = imgs.filter((img) => !(img.complete && img.naturalHeight > 0));
    if (pending.length === 0) {
      await fontsAndFrames();
      return;
    }

    const budget = Math.min(3200, timeLeft(), Math.floor(timeLeft() / Math.max(1, pending.length)));
    const slice = pending.slice(0, 28);
    await Promise.race([
      Promise.all(slice.map((img) => waitOneImage(img, budget))),
      new Promise<void>((r) => setTimeout(r, Math.min(200, timeLeft()))),
    ]);
  }
}
