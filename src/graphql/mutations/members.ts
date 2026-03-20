import { gql } from '@apollo/client'

// ─── Hub mutations ───────────────────────────────────────────────────────────

export const ADD_HUB_MEMBERS = gql`
  mutation AddHubMembers($input: AddHubMembersInput!) {
    addHubMembers(input: $input) {
      hub { id }
    }
  }
`

export const CHANGE_HUB_MEMBER_ROLE = gql`
  mutation ChangeHubMemberRole($input: ChangeHubMemberRoleInput!) {
    changeHubMemberRole(input: $input) {
      member {
        role
        status
        user { id email }
      }
    }
  }
`

export const DEACTIVATE_HUB_MEMBER = gql`
  mutation DeactivateHubMember($input: DeactivateHubMemberInput!) {
    deactivateHubMember(input: $input) {
      member {
        status
        user { id email }
      }
    }
  }
`

export const ACTIVATE_HUB_MEMBER = gql`
  mutation ActivateHubMember($input: ActivateHubMemberInput!) {
    activateHubMember(input: $input) {
      member {
        status
        user { id email }
      }
    }
  }
`

export const RESEND_HUB_INVITATION = gql`
  mutation ResendHubInvitation($input: ResendHubInvitationInput!) {
    resendHubInvitation(input: $input) {
      member { status }
    }
  }
`

// ─── Project mutations ────────────────────────────────────────────────────────

export const ADD_PROJECT_MEMBERS = gql`
  mutation AddProjectMembers($input: AddProjectMembersInput!) {
    addProjectMembers(input: $input) {
      project { id }
    }
  }
`

export const CHANGE_PROJECT_MEMBER_ROLE = gql`
  mutation ChangeProjectMemberRole($input: ChangeProjectMemberRoleInput!) {
    changeProjectMemberRole(input: $input) {
      project { id }
    }
  }
`

export const REMOVE_PROJECT_MEMBERS = gql`
  mutation RemoveProjectMembers($input: RemoveProjectMembersInput!) {
    removeProjectMembers(input: $input) {
      project { id }
    }
  }
`

// ─── Folder mutations ─────────────────────────────────────────────────────────

export const ADD_FOLDER_MEMBERS = gql`
  mutation AddFolderMembers($input: AddFolderMembersInput!) {
    addFolderMembers(input: $input) {
      folder { id }
    }
  }
`

export const CHANGE_FOLDER_MEMBER_ROLE = gql`
  mutation ChangeFolderMemberRole($input: ChangeFolderMemberRoleInput!) {
    changeFolderMemberRole(input: $input) {
      folder { id }
    }
  }
`

export const REMOVE_FOLDER_MEMBERS = gql`
  mutation RemoveFolderMembers($input: RemoveFolderMembersInput!) {
    removeFolderMembers(input: $input) {
      folder { id }
    }
  }
`
