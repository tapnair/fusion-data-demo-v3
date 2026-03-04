/**
 * GraphQL Schema Introspection Script
 * Fetches the schema from the GraphQL endpoint and saves it
 */

import fs from 'fs';

const GRAPHQL_ENDPOINT = 'https://developer.api.autodesk.com/mfg/v3/graphql/public';
const BEARER_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IlZiakZvUzhQU3lYODQyMV95dndvRUdRdFJEa19SUzI1NiIsInBpLmF0bSI6ImFzc2MifQ.eyJzY29wZSI6WyJkYXRhOnJlYWQiLCJkYXRhOndyaXRlIl0sImNsaWVudF9pZCI6Im5McGNES2p1ODlJYU8zaHI4bldueGxheGFWNjBvMnB6WGYyMEdHQjlwMlJqU0VSRyIsImlzcyI6Imh0dHBzOi8vZGV2ZWxvcGVyLmFwaS5hdXRvZGVzay5jb20iLCJhdWQiOiJodHRwczovL2F1dG9kZXNrLmNvbSIsImp0aSI6ImlCWVFEVnA2UEN4cVdEWmpnT1hmRHZXVjZIajBlNVBvZHFoZ3VYY3JXMW1kUTZKNmZVUlVBNEo3MGhmSEZ5N08iLCJ1c2VyaWQiOiJYTjM5TDZXQ0taM1giLCJleHAiOjE3NzI1ODMyNzZ9.d_9DtnzA1vS4R8-9WqrQ0IdiWJDqTgDRCaC2M-bkkpY_qyJrxGYx5INvWz4lkeqbKX-sNB7359kuPBMbcQ-5Qi17B0C22-gzbgNz26db-pIm2Ja-AhAuGsdYWu2H5KbIfXJqrWiJzkH0HD_dF60tbgVp2KOZyqlhGMGkCIOqT1wC1Zl-r-0kzxcIQyttUcbdsNBYkz_MOJvAqO9RH3zkZLSpIiGdZKW324d5JbklofWjKOig6_ZYAGzI0VYv3ZGTWzQ9I1OZ8MhZHvrQ4xBASwnUo8hhICaTqlT5Y5gTq0w8-NKQfKg0qX_cmtOgTCgw--d_liJ78cQ72WJghLbFaw';

// Full introspection query
const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
      directives {
        name
        description
        locations
        args {
          ...InputValue
        }
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function introspectSchema() {
  console.log('🔍 Fetching GraphQL schema...');

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
      body: JSON.stringify({
        query: introspectionQuery,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('❌ GraphQL Errors:', result.errors);
      throw new Error('Introspection query failed');
    }

    // Save raw introspection result
    fs.writeFileSync(
      'schema-introspection.json',
      JSON.stringify(result.data, null, 2)
    );
    console.log('✅ Saved raw introspection to schema-introspection.json');

    // Convert to SDL
    const sdl = convertToSDL(result.data.__schema);
    fs.writeFileSync('schema.graphql', sdl);
    console.log('✅ Saved GraphQL SDL to schema.graphql');

    console.log('\n📊 Schema Summary:');
    const types = result.data.__schema.types.filter(
      t => !t.name.startsWith('__')
    );
    console.log(`  - ${types.length} types`);
    console.log(`  - Query type: ${result.data.__schema.queryType?.name || 'N/A'}`);
    console.log(`  - Mutation type: ${result.data.__schema.mutationType?.name || 'N/A'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function convertToSDL(schema) {
  let sdl = '# Autodesk Manufacturing Data Model API v3 Schema\n';
  sdl += '# Generated via introspection\n\n';

  // Filter out built-in types
  const types = schema.types.filter(type => !type.name.startsWith('__'));

  // Add directives
  if (schema.directives && schema.directives.length > 0) {
    schema.directives.forEach(directive => {
      sdl += `directive @${directive.name}`;
      if (directive.args && directive.args.length > 0) {
        sdl += '(' + directive.args.map(arg => `${arg.name}: ${typeToString(arg.type)}`).join(', ') + ')';
      }
      sdl += ` on ${directive.locations.join(' | ')}\n`;
    });
    sdl += '\n';
  }

  // Add schema definition
  sdl += 'schema {\n';
  if (schema.queryType) sdl += `  query: ${schema.queryType.name}\n`;
  if (schema.mutationType) sdl += `  mutation: ${schema.mutationType.name}\n`;
  if (schema.subscriptionType) sdl += `  subscription: ${schema.subscriptionType.name}\n`;
  sdl += '}\n\n';

  // Add types
  types.forEach(type => {
    sdl += typeToSDL(type) + '\n\n';
  });

  return sdl;
}

function typeToSDL(type) {
  if (!type) return '';

  let sdl = '';

  if (type.description) {
    sdl += `"""${type.description}"""\n`;
  }

  switch (type.kind) {
    case 'OBJECT':
      sdl += `type ${type.name}`;
      if (type.interfaces && type.interfaces.length > 0) {
        sdl += ` implements ${type.interfaces.map(i => i.name).join(' & ')}`;
      }
      sdl += ' {\n';
      if (type.fields) {
        type.fields.forEach(field => {
          if (field.description) sdl += `  """${field.description}"""\n`;
          sdl += `  ${field.name}`;
          if (field.args && field.args.length > 0) {
            sdl += '(' + field.args.map(arg => {
              let argStr = `${arg.name}: ${typeToString(arg.type)}`;
              if (arg.defaultValue) argStr += ` = ${arg.defaultValue}`;
              return argStr;
            }).join(', ') + ')';
          }
          sdl += `: ${typeToString(field.type)}`;
          if (field.isDeprecated) sdl += ` @deprecated(reason: "${field.deprecationReason || 'No longer supported'}")`;
          sdl += '\n';
        });
      }
      sdl += '}';
      break;

    case 'INTERFACE':
      sdl += `interface ${type.name} {\n`;
      if (type.fields) {
        type.fields.forEach(field => {
          sdl += `  ${field.name}: ${typeToString(field.type)}\n`;
        });
      }
      sdl += '}';
      break;

    case 'UNION':
      sdl += `union ${type.name} = ${type.possibleTypes.map(t => t.name).join(' | ')}`;
      break;

    case 'ENUM':
      sdl += `enum ${type.name} {\n`;
      if (type.enumValues) {
        type.enumValues.forEach(value => {
          if (value.description) sdl += `  """${value.description}"""\n`;
          sdl += `  ${value.name}`;
          if (value.isDeprecated) sdl += ` @deprecated(reason: "${value.deprecationReason || 'No longer supported'}")`;
          sdl += '\n';
        });
      }
      sdl += '}';
      break;

    case 'INPUT_OBJECT':
      sdl += `input ${type.name} {\n`;
      if (type.inputFields) {
        type.inputFields.forEach(field => {
          sdl += `  ${field.name}: ${typeToString(field.type)}`;
          if (field.defaultValue) sdl += ` = ${field.defaultValue}`;
          sdl += '\n';
        });
      }
      sdl += '}';
      break;

    case 'SCALAR':
      sdl += `scalar ${type.name}`;
      break;
  }

  return sdl;
}

function typeToString(type) {
  if (!type) return 'Unknown';

  if (type.kind === 'NON_NULL') {
    return typeToString(type.ofType) + '!';
  }

  if (type.kind === 'LIST') {
    return '[' + typeToString(type.ofType) + ']';
  }

  return type.name;
}

introspectSchema();
