// A one-slot observable that bridges the imperative scene and the React panel. The EngineScene
// creates the Phaser controller at mount time (it needs the canvas host), which is AFTER the panel
// first renders; the panel subscribes here and re-renders once the controller is published. This is
// what lets one controller instance be shared by the scene and the UI without prop-drilling across
// the imperative/React boundary.

export interface ControllerBox<T> {
  get(): T | null;
  set(value: T | null): void;
  subscribe(listener: () => void): () => void;
}

export function createControllerBox<T>(): ControllerBox<T> {
  let value: T | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
