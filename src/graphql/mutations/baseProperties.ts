import { gql } from '@apollo/client/core'

export const SET_PROPERTIES = gql`
  mutation SetProperties($input: SetPropertiesInput!) {
    setProperties(input: $input) {
      targetId
      properties {
        name
        displayValue
        value
        definition { id }
      }
    }
  }
`
