import {
  Mesh
} from "./chunk-43BBZCW2.js";
import {
  VertexData
} from "./chunk-NPDPINWR.js";
import {
  useOpenGLOrientationForUV
} from "./chunk-CHQ2B3XR.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Meshes/Builders/planeBuilder.js
function CreatePlaneVertexData(options) {
  const indices = [];
  const positions = [];
  const normals = [];
  const uvs = [];
  const width = options.width !== void 0 ? options.width : options.size !== void 0 ? options.size : 1;
  const height = options.height !== void 0 ? options.height : options.size !== void 0 ? options.size : 1;
  const sideOrientation = options.sideOrientation === 0 ? 0 : options.sideOrientation || VertexData.DEFAULTSIDE;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  positions.push(-halfWidth, -halfHeight, 0);
  normals.push(0, 0, -1);
  uvs.push(0, useOpenGLOrientationForUV ? 1 : 0);
  positions.push(halfWidth, -halfHeight, 0);
  normals.push(0, 0, -1);
  uvs.push(1, useOpenGLOrientationForUV ? 1 : 0);
  positions.push(halfWidth, halfHeight, 0);
  normals.push(0, 0, -1);
  uvs.push(1, useOpenGLOrientationForUV ? 0 : 1);
  positions.push(-halfWidth, halfHeight, 0);
  normals.push(0, 0, -1);
  uvs.push(0, useOpenGLOrientationForUV ? 0 : 1);
  indices.push(0);
  indices.push(1);
  indices.push(2);
  indices.push(0);
  indices.push(2);
  indices.push(3);
  VertexData._ComputeSides(sideOrientation, positions, indices, normals, uvs, options.frontUVs, options.backUVs);
  const vertexData = new VertexData();
  vertexData.indices = indices;
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  return vertexData;
}
function CreatePlane(name, options = {}, scene = null) {
  const plane = new Mesh(name, scene);
  options.sideOrientation = Mesh._GetDefaultSideOrientation(options.sideOrientation);
  plane._originalBuilderSideOrientation = options.sideOrientation;
  const vertexData = CreatePlaneVertexData(options);
  vertexData.applyToMesh(plane, options.updatable);
  if (options.sourcePlane) {
    plane.translate(options.sourcePlane.normal, -options.sourcePlane.d);
    plane.setDirection(options.sourcePlane.normal.scale(-1));
  }
  return plane;
}
VertexData.CreatePlane = CreatePlaneVertexData;
Mesh.CreatePlane = (name, size, scene, updatable, sideOrientation) => {
  const options = {
    size,
    width: size,
    height: size,
    sideOrientation,
    updatable
  };
  return CreatePlane(name, options, scene);
};

export {
  CreatePlane
};
//# sourceMappingURL=chunk-46HGLBZT.js.map
