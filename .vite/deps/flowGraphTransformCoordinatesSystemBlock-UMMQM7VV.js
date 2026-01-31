import {
  FlowGraphBlock,
  RichTypeAny,
  RichTypeVector3
} from "./chunk-2RMCMAHJ.js";
import "./chunk-L6UPA4UW.js";
import "./chunk-I3IYKWNG.js";
import {
  TmpVectors,
  Vector3
} from "./chunk-YLLTSBLI.js";
import "./chunk-YSTPYZG5.js";
import "./chunk-DSUROWQ4.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";
import "./chunk-WOUDRWXV.js";
import "./chunk-3EU3L2QH.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphTransformCoordinatesSystemBlock.js
var FlowGraphTransformCoordinatesSystemBlock = class extends FlowGraphBlock {
  /**
   * Creates a new FlowGraphCoordinateTransformBlock
   * @param config optional configuration for this block
   */
  constructor(config) {
    super(config);
    this.sourceSystem = this.registerDataInput("sourceSystem", RichTypeAny);
    this.destinationSystem = this.registerDataInput("destinationSystem", RichTypeAny);
    this.inputCoordinates = this.registerDataInput("inputCoordinates", RichTypeVector3);
    this.outputCoordinates = this.registerDataOutput("outputCoordinates", RichTypeVector3);
  }
  _updateOutputs(_context) {
    const sourceSystemValue = this.sourceSystem.getValue(_context);
    const destinationSystemValue = this.destinationSystem.getValue(_context);
    const inputCoordinatesValue = this.inputCoordinates.getValue(_context);
    const sourceWorld = sourceSystemValue.getWorldMatrix();
    const destinationWorld = destinationSystemValue.getWorldMatrix();
    const destinationWorldInverse = TmpVectors.Matrix[0].copyFrom(destinationWorld);
    destinationWorldInverse.invert();
    const sourceToDestination = TmpVectors.Matrix[1];
    destinationWorldInverse.multiplyToRef(sourceWorld, sourceToDestination);
    const outputCoordinatesValue = this.outputCoordinates.getValue(_context);
    Vector3.TransformCoordinatesToRef(inputCoordinatesValue, sourceToDestination, outputCoordinatesValue);
  }
  /**
   * Gets the class name of this block
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphTransformCoordinatesSystemBlock";
  }
};
RegisterClass("FlowGraphTransformCoordinatesSystemBlock", FlowGraphTransformCoordinatesSystemBlock);
export {
  FlowGraphTransformCoordinatesSystemBlock
};
//# sourceMappingURL=flowGraphTransformCoordinatesSystemBlock-UMMQM7VV.js.map
