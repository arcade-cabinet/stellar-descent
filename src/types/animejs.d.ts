declare module 'animejs' {
  interface AnimationParams {
    targets?: any;
    duration?: number;
    delay?: number | ((el: Element, i: number, l: number) => number);
    easing?: string;
    round?: number;
    complete?: (anim: AnimationInstance) => void;
    update?: (anim: AnimationInstance) => void;
    begin?: (anim: AnimationInstance) => void;
    loopBegin?: (anim: AnimationInstance) => void;
    changeBegin?: (anim: AnimationInstance) => void;
    change?: (anim: AnimationInstance) => void;
    changeComplete?: (anim: AnimationInstance) => void;
    loopComplete?: (anim: AnimationInstance) => void;
    direction?: 'normal' | 'reverse' | 'alternate';
    loop?: number | boolean;
    autoplay?: boolean;
    [key: string]: any;
  }

  interface AnimationInstance {
    play(): void;
    pause(): void;
    restart(): void;
    reverse(): void;
    seek(time: number): void;
    completed: boolean;
    paused: boolean;
    duration: number;
    currentTime: number;
  }

  export function animate(params: AnimationParams): AnimationInstance;
}
