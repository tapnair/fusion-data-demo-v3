import { gql } from '@apollo/client/core'

const PROPERTY_FIELDS = `
  displayValue
  definition { units { name } }
`

export const GET_ROOT_COMPONENT_PHYSICAL_PROPERTIES = gql`
  query GetRootComponentPhysicalProperties($componentId: ID!) {
    component(componentId: $componentId, composition: WORKING) {
      id
      primaryModel {
        id
        physicalProperties {
          status
          mass    { ${PROPERTY_FIELDS} }
          volume  { ${PROPERTY_FIELDS} }
          density { ${PROPERTY_FIELDS} }
          area    { ${PROPERTY_FIELDS} }
          boundingBox {
            length { ${PROPERTY_FIELDS} }
            width  { ${PROPERTY_FIELDS} }
            height { ${PROPERTY_FIELDS} }
          }
        }
      }
    }
  }
`

export const GET_COMPONENT_PHYSICAL_PROPERTIES = gql`
  query GetComponentPhysicalProperties($componentId: ID!, $state: String) {
    component(componentId: $componentId, state: $state) {
      id
      primaryModel {
        id
        physicalProperties {
          status
          mass    { ${PROPERTY_FIELDS} }
          volume  { ${PROPERTY_FIELDS} }
          density { ${PROPERTY_FIELDS} }
          area    { ${PROPERTY_FIELDS} }
          boundingBox {
            length { ${PROPERTY_FIELDS} }
            width  { ${PROPERTY_FIELDS} }
            height { ${PROPERTY_FIELDS} }
          }
        }
      }
    }
  }
`
