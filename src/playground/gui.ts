import type { Scene } from '@babylonjs/core/scene';
import { AdvancedDynamicTexture, Button, StackPanel } from '@babylonjs/gui/2D';

export const setUI = async (scene: Scene) => {
  if (scene.getEngine().name === 'WebGPU') {
    // WebGPU specific imports
    await import('@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture');
    await import('@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTarget');
  }

  const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('myUI', true, scene);

  const panel = new StackPanel();
  panel.width = 0.15;
  panel.verticalAlignment = 0;
  panel.horizontalAlignment = 0;
  panel.isVertical = true;
  panel.topInPixels = 20;
  advancedTexture.addControl(panel);

  const button = Button.CreateSimpleButton('but', 'Click Me');
  button.width = 0.9;
  button.height = '40px';
  button.color = 'white';
  button.background = 'MidnightBlue';
  panel.addControl(button);

  let counter = 0;
  button.onPointerUpObservable.add(() => {
    counter++;
    button.textBlock!.text = counter.toString();
  });

  const disposeButton = Button.CreateSimpleButton('disposeButton', 'Dispose GUI');
  disposeButton.width = 0.9;
  disposeButton.height = '40px';
  disposeButton.color = 'white';
  disposeButton.background = 'Maroon';
  panel.addControl(disposeButton);

  disposeButton.onPointerUpObservable.addOnce(() => {
    advancedTexture.dispose();
  });
};
