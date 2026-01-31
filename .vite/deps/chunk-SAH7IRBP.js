// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Loading/Plugins/babylonFileParser.function.js
var BabylonFileParsers = {};
var IndividualBabylonFileParsers = {};
function AddParser(name, parser) {
  BabylonFileParsers[name] = parser;
}
function AddIndividualParser(name, parser) {
  IndividualBabylonFileParsers[name] = parser;
}
function GetIndividualParser(name) {
  if (IndividualBabylonFileParsers[name]) {
    return IndividualBabylonFileParsers[name];
  }
  return null;
}

export {
  AddParser,
  AddIndividualParser,
  GetIndividualParser
};
//# sourceMappingURL=chunk-SAH7IRBP.js.map
