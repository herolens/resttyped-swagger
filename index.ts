import ts from "typescript";

// hardcode our input file
const filePath = "/home/gonza/Development/herolens/code/api-defs/src/herolens/assets/index.ts";

// create a program instance, which is a collection of source files
// in this case we only have one source file
const program = ts.createProgram([filePath], {});

// pull off the typechecker instance from our program
const checker = program.getTypeChecker();

// get our models.ts source file AST
const source = program.getSourceFile(filePath);

// create TS printer instance which gives us utilities to pretty print our final AST
const printer = ts.createPrinter();

// helper to give us Node string type given kind
const syntaxToKind = (kind: ts.Node["kind"]) => {
  return ts.SyntaxKind[kind];
};

function getResponse(response_type: string) {
  if (response_type) {
    return { 
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: { 
              '$ref': `#/components/schemas/${response_type}`
            }
          }
        }
      }
    };
  } else
  return { 
    200: {
      description: 'OK'
    }
  };
}
// visit each node in the root AST and log its kind
let apiName: string;
let paths: any;
let components: any = { schemas: {}};

ts.forEachChild(source, node => {
  if ( ts.isInterfaceDeclaration(node) && node.name.getText().endsWith('API')) {
    apiName = node.name.getText();
    const symbol = checker.getSymbolAtLocation(node.name);
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    const properties = checker.getPropertiesOfType(type);
    paths = {};
    properties.map(declaration => {
      const members = (declaration.valueDeclaration as any).type.members;
      const path = declaration.getName();
      paths[path] = {};
      members.map( (m: any) => {
        const method = m.name.getText().toLowerCase();
        const method_members = m.type.members;
        paths[path][method] = {};
        method_members.map( (mm: any) => {
          let method_member_name = mm.name.getText();
          const mm_members = mm.type.members;
          if (method_member_name === 'response'){
            const response_type = mm.type.elementType && mm.type.elementType.typeName ? mm.type.elementType.typeName.getText() : null;
            if (!paths[path][method]['response']) {
              paths[path][method]['responses'] = getResponse(response_type);
            }
          } else if (method_member_name === 'params' || method_member_name === 'query'){
            if (!paths[path][method]['parameters'])
              paths[path][method]['parameters'] = [];
            if (method_member_name === 'params')
              method_member_name = 'path';
            if (mm_members)
              mm_members.map( (p: any) => {
                const type = ts.SyntaxKind[p.type.kind] === "StringKeyword" ? "string": "object";
                paths[path][method]['parameters'].push({
                  "in": method_member_name,
                  "name": p.name.getText(),
                  "description": "test",
                  "required": true,
                  "schema": {
                    type: type
                  }
                });
              });
          } else if (method_member_name === 'body') {
            const body_type = mm.type && mm.type.typeName ? mm.type.typeName.getText() : null;
            if (!paths[path][method]['requestBody'])
              paths[path][method]['requestBody'] = {
                required: true,
                content: {
                  'application/json':{
                    schema: {
                      '$ref': `#/components/schemas/${body_type}`
                    }
                  }
                }
              };
          }
        });
      });
    });
  } else if (ts.isInterfaceDeclaration(node)){
    const symbol = checker.getSymbolAtLocation(node.name);
    components.schemas[symbol.getName()] = { type: 'object', properties: {} };
    symbol.members.forEach( (m: any) => {
      const a = syntaxToKind(139);
      components.schemas[symbol.getName()]['properties'][m.name] = { type: 'object' }
    });
  }
});
    const openApiDeclaration = {
      openapi: '3.0.0',
      info: { 
        title: apiName,
        version: '1.0.0'
      },
      paths: paths,
      components: components
    };
    const json = JSON.stringify(openApiDeclaration);
    console.log(openApiDeclaration)