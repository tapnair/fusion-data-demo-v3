import { gql } from '@apollo/client'

export const UPDATE_COMPONENT_DESCRIPTION = gql`
  mutation UpdateComponentDescription($input: UpdateComponentDescriptionInput!) {
    updateComponentDescription(input: $input) {
      id
      description { value displayValue }
    }
  }
`
