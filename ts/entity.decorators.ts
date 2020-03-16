
export function Reactive(): any {
  return function(target: any, key: string, descriptor: any) {
    if (!target.constructor.reactive) target.constructor.reactive = [];
    if (target.constructor.reactive.indexOf(key) > -1) return;
    target.constructor.reactive.push(key);
  }
}