import { type Ref } from "vue";

interface AutoScrollOptions {
  /** 每帧滚动的像素数 */
  speed?: number;
  /** 到达顶部/底部时的停顿时长（毫秒） */
  pauseDuration?: number;
}

/**
 * 让容器在垂直方向上自动来回滚动：到底部后反向、到顶部后再正向，
 * 两端各停顿一段时间。逻辑与展示页原有实现保持一致，仅从组件中抽离以便复用与维护。
 *
 * @param container 滚动容器的模板 ref
 */
export function useAutoScroll(
  container: Ref<HTMLElement | null>,
  options: AutoScrollOptions = {}
) {
  const speed = options.speed ?? 0.68;
  const pauseDuration = options.pauseDuration ?? 3000;

  let direction = 1;
  let paused = false;
  let frameId: number | null = null;

  const tick = () => {
    const el = container.value;
    if (!el || paused) {
      frameId = requestAnimationFrame(tick);
      return;
    }

    const isAtBottom =
      Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
    const isAtTop = el.scrollTop <= 0;

    if (isAtBottom) {
      direction = -1;
      paused = true;
      setTimeout(() => {
        paused = false;
      }, pauseDuration);
    } else if (isAtTop) {
      direction = 1;
      paused = true;
      setTimeout(() => {
        paused = false;
      }, pauseDuration);
    }

    el.scrollTop += speed * direction;
    frameId = requestAnimationFrame(tick);
  };

  const start = () => {
    stop();
    frameId = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  const reset = () => {
    const el = container.value;
    if (el) {
      el.scrollTop = 0;
      direction = 1;
      paused = false;
    }
  };

  return { start, stop, reset };
}
