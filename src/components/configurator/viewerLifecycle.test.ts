import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchViewerContext } from './viewerLifecycle';

afterEach(() => { document.body.replaceChildren(); });
describe('viewer context lifecycle', () => {
  it('reports genuine context loss on the live viewer', () => {
    const canvas = document.createElement('canvas'), fail = vi.fn();
    document.body.append(canvas);
    const stop = watchViewerContext(canvas, fail);
    canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(fail).toHaveBeenCalledTimes(1);
    stop();
  });
  it('does not disable 3D when switching to the plan disposes the canvas', () => {
    const canvas = document.createElement('canvas'), fail = vi.fn();
    document.body.append(canvas);
    const stop = watchViewerContext(canvas, fail);
    stop();
    canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(fail).not.toHaveBeenCalled();
  });
  it('ignores delayed loss from a removed canvas', () => {
    const canvas = document.createElement('canvas'), fail = vi.fn();
    document.body.append(canvas);
    const stop = watchViewerContext(canvas, fail);
    canvas.remove();
    canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(fail).not.toHaveBeenCalled();
    stop();
  });
});