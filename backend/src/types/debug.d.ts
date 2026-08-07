declare module "debug" {
  type DebugLogger = (...args: unknown[]) => void;
  function debug(namespace: string): DebugLogger;
  export default debug;
}
