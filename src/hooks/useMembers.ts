import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { GET_HUB_MEMBERS, GET_PROJECT_MEMBERS, GET_FOLDER_MEMBERS } from '../graphql/queries/members'
import {
  ADD_HUB_MEMBERS, CHANGE_HUB_MEMBER_ROLE, DEACTIVATE_HUB_MEMBER, ACTIVATE_HUB_MEMBER, RESEND_HUB_INVITATION,
  ADD_PROJECT_MEMBERS, CHANGE_PROJECT_MEMBER_ROLE, REMOVE_PROJECT_MEMBERS,
  ADD_FOLDER_MEMBERS, CHANGE_FOLDER_MEMBER_ROLE, REMOVE_FOLDER_MEMBERS,
} from '../graphql/mutations/members'
import type { NavNode } from '../types/nav.types'
import type { MemberRow, MemberRole, MemberStatus } from '../types/members.types'

function mapToMemberRow(m: any): MemberRow {
  return {
    id: m.user.id,
    email: m.user.email ?? '',
    displayName: m.displayName ?? ([m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || m.user.userName) ?? m.user.email ?? '',
    firstName: m.user.firstName ?? null,
    lastName: m.user.lastName ?? null,
    avatarUrl: m.avatarUrl ?? null,
    role: m.role as MemberRole,
    status: m.status as MemberStatus,
    isProjectCreator: m.isProjectCreator ?? undefined,
  }
}

export function useMembers(node: NavNode): {
  rows: MemberRow[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  refetch: () => void
  addMembers: (emails: string[], role: MemberRole | null) => Promise<void>
  changeRole: (email: string, role: MemberRole) => Promise<void>
  removeMember: (email: string) => Promise<void>
  reactivateMember: (email: string) => Promise<void>
  resendInvitation: (email: string) => Promise<void>
} {
  // ─── Queries (all called unconditionally) ────────────────────────────────────

  const hubResult = useQuery(GET_HUB_MEMBERS, {
    skip: node.type !== 'hub',
    variables: { hubId: node.entityId },
    fetchPolicy: 'network-only',
  })

  const projectResult = useQuery(GET_PROJECT_MEMBERS, {
    skip: node.type !== 'project',
    variables: { projectId: node.entityId },
    fetchPolicy: 'network-only',
  })

  const folderResult = useQuery(GET_FOLDER_MEMBERS, {
    skip: node.type !== 'folder' || !node.projectId,
    variables: { folderId: node.entityId, projectId: node.projectId ?? '' },
    fetchPolicy: 'network-only',
  })

  // ─── Mutations (all called unconditionally) ───────────────────────────────────

  const [addHubMembersMut] = useMutation(ADD_HUB_MEMBERS)
  const [changeHubRoleMut] = useMutation(CHANGE_HUB_MEMBER_ROLE)
  const [deactivateHubMut] = useMutation(DEACTIVATE_HUB_MEMBER)
  const [activateHubMut] = useMutation(ACTIVATE_HUB_MEMBER)
  const [resendHubInviteMut] = useMutation(RESEND_HUB_INVITATION)
  const [addProjectMembersMut] = useMutation(ADD_PROJECT_MEMBERS)
  const [changeProjectRoleMut] = useMutation(CHANGE_PROJECT_MEMBER_ROLE)
  const [removeProjectMembersMut] = useMutation(REMOVE_PROJECT_MEMBERS)
  const [addFolderMembersMut] = useMutation(ADD_FOLDER_MEMBERS)
  const [changeFolderRoleMut] = useMutation(CHANGE_FOLDER_MEMBER_ROLE)
  const [removeFolderMembersMut] = useMutation(REMOVE_FOLDER_MEMBERS)

  // ─── Derive active query state ────────────────────────────────────────────────

  const activeData =
    node.type === 'hub' ? hubResult.data :
    node.type === 'project' ? projectResult.data :
    folderResult.data

  const activeLoading =
    node.type === 'hub' ? hubResult.loading :
    node.type === 'project' ? projectResult.loading :
    folderResult.loading

  const activeError =
    node.type === 'hub' ? hubResult.error :
    node.type === 'project' ? projectResult.error :
    folderResult.error

  const activeRefetch =
    node.type === 'hub' ? hubResult.refetch :
    node.type === 'project' ? projectResult.refetch :
    folderResult.refetch

  const activeFetchMore =
    node.type === 'hub' ? hubResult.fetchMore :
    node.type === 'project' ? projectResult.fetchMore :
    folderResult.fetchMore

  // ─── Pagination ───────────────────────────────────────────────────────────────

  const pagination: any =
    (activeData as any)?.hub?.members?.pagination ??
    (activeData as any)?.project?.members?.pagination ??
    (activeData as any)?.folder?.members?.pagination ??
    null

  const hasMore: boolean = pagination?.cursor != null
  const cursor: string | null = pagination?.cursor ?? null

  // ─── Row state ────────────────────────────────────────────────────────────────

  const [allRows, setAllRows] = useState<MemberRow[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  // Reset when node changes
  useEffect(() => {
    setAllRows([])
  }, [node.id])

  // Populate from query
  useEffect(() => {
    const raw: any[] =
      (activeData as any)?.hub?.members?.results ??
      (activeData as any)?.project?.members?.results ??
      (activeData as any)?.folder?.members?.results ??
      []
    setAllRows(raw.map(mapToMemberRow))
  }, [activeData])

  // ─── loadMore ─────────────────────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await activeFetchMore({
        variables:
          node.type === 'hub'
            ? { hubId: node.entityId, cursor }
            : node.type === 'project'
            ? { projectId: node.entityId, cursor }
            : { folderId: node.entityId, projectId: node.projectId ?? '', cursor },
      })
      const newRaw: any[] =
        (result.data as any)?.hub?.members?.results ??
        (result.data as any)?.project?.members?.results ??
        (result.data as any)?.folder?.members?.results ??
        []
      setAllRows(prev => [...prev, ...newRaw.map(mapToMemberRow)])
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore, activeFetchMore, node])

  // ─── addMembers ───────────────────────────────────────────────────────────────

  const addMembers = useCallback(async (emails: string[], role: MemberRole | null) => {
    if (node.type === 'hub') {
      await addHubMembersMut({ variables: { input: { hubId: node.entityId, emailAddresses: emails } } })
    } else if (node.type === 'project') {
      await addProjectMembersMut({ variables: { input: { projectId: node.entityId, memberRole: role!, emailAddresses: emails } } })
    } else {
      await addFolderMembersMut({ variables: { input: { projectId: node.projectId!, folderId: node.entityId, memberRole: role!, emailAddresses: emails } } })
    }
    await activeRefetch()
  }, [node, addHubMembersMut, addProjectMembersMut, addFolderMembersMut, activeRefetch])

  // ─── changeRole ───────────────────────────────────────────────────────────────

  const changeRole = useCallback(async (email: string, role: MemberRole) => {
    if (node.type === 'hub') {
      await changeHubRoleMut({ variables: { input: { hubId: node.entityId, emailAddress: email, role: role as any } } })
    } else if (node.type === 'project') {
      await changeProjectRoleMut({ variables: { input: { projectId: node.entityId, emailAddress: email, memberRole: role as any } } })
    } else {
      await changeFolderRoleMut({ variables: { input: { projectId: node.projectId!, folderId: node.entityId, emailAddress: email, memberRole: role as any } } })
    }
    await activeRefetch()
  }, [node, changeHubRoleMut, changeProjectRoleMut, changeFolderRoleMut, activeRefetch])

  // ─── removeMember ─────────────────────────────────────────────────────────────

  const removeMember = useCallback(async (email: string) => {
    if (node.type === 'hub') {
      await deactivateHubMut({ variables: { input: { hubId: node.entityId, emailAddress: email } } })
    } else if (node.type === 'project') {
      await removeProjectMembersMut({ variables: { input: { projectId: node.entityId, emailAddresses: [email] } } })
    } else {
      await removeFolderMembersMut({ variables: { input: { projectId: node.projectId!, folderId: node.entityId, emailAddresses: [email] } } })
    }
    await activeRefetch()
  }, [node, deactivateHubMut, removeProjectMembersMut, removeFolderMembersMut, activeRefetch])

  // ─── reactivateMember ─────────────────────────────────────────────────────────

  const reactivateMember = useCallback(async (email: string) => {
    await activateHubMut({ variables: { input: { hubId: node.entityId, emailAddress: email } } })
    await activeRefetch()
  }, [node.entityId, activateHubMut, activeRefetch])

  // ─── resendInvitation ─────────────────────────────────────────────────────────

  const resendInvitation = useCallback(async (email: string) => {
    await resendHubInviteMut({ variables: { input: { hubId: node.entityId, emailAddress: email } } })
  }, [node.entityId, resendHubInviteMut])

  // ─── Return ───────────────────────────────────────────────────────────────────

  return {
    rows: allRows,
    loading: activeLoading,
    error: activeError?.message ?? null,
    hasMore: hasMore || loadingMore,
    loadMore,
    refetch: activeRefetch,
    addMembers,
    changeRole,
    removeMember,
    reactivateMember,
    resendInvitation,
  }
}
