import { useEffect, useState } from 'react'
import { LosslessNumber, parse as losslessParse } from 'lossless-json'
import './App.css'

function joinUrl(base, path) {
  const normalizedBase = String(base ?? '').trim()
  if (!normalizedBase) return path
  const hasTrailingSlash = normalizedBase.endsWith('/')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return hasTrailingSlash
    ? `${normalizedBase.slice(0, -1)}${normalizedPath}`
    : `${normalizedBase}${normalizedPath}`
}

async function fetchJson(url, { signal } = {}) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status} ${response.statusText}`)
    error.status = response.status
    throw error
  }

  if (response.status === 204) return null

  const text = await response.text()
  if (!text) return null

  return losslessParse(text, (key, value) => {
    if (key === 'id') {
      if (value instanceof LosslessNumber) return value.toString()
      if (typeof value === 'number') return String(value)
    }
    return value
  })
}

async function putJson(url, { signal } = {}) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status} ${response.statusText}`)
    error.status = response.status
    throw error
  }

  if (response.status === 204) return null

  try {
    const text = await response.text()
    if (!text) return null
    return losslessParse(text, (key, value) => {
      if (key === 'id') {
        if (value instanceof LosslessNumber) return value.toString()
        if (typeof value === 'number') return String(value)
      }
      return value
    })
  } catch {
    return null
  }
}

function asArray(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload

  // Common Spring pageable shapes: { content: [...] }, { items: [...] }, etc.
  if (Array.isArray(payload.content)) return payload.content
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.results)) return payload.results

  return []
}

function formatJoinedDate(isoLike) {
  const date = new Date(isoLike)
  if (Number.isNaN(date.getTime())) return String(isoLike)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function emptyDash(value) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function displayInvitationLink(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value

  if (typeof value === 'object') {
    const maybeLink = value.invitationLink ?? value.code ?? value.url
    if (typeof maybeLink === 'string' && maybeLink.trim()) return maybeLink
  }

  return String(value)
}

function invitationCodeFromValue(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const withoutQuery = raw.split('?')[0]
  const withoutHash = withoutQuery.split('#')[0]

  // If it's a URL, prefer URL parsing.
  if (/^https?:\/\//i.test(withoutHash)) {
    try {
      const url = new URL(withoutHash)
      const parts = url.pathname.split('/').filter(Boolean)
      return parts.at(-1) ?? ''
    } catch {
      // Fall through to string heuristics.
    }
  }

  // Common Discord formats: discord.gg/CODE, discord.com/invite/CODE
  const normalized = withoutHash.replace(/^.*discord\.(gg|com)\//i, '')
  const parts = normalized.split('/').filter(Boolean)
  const last = parts.at(-1) ?? ''
  return last.replace(/^invite\//i, '')
}

function Section({ title, subtitle, children }) {
  return (
    <section className="section">
      <header className="sectionHeader">
        <div>
          <h2 className="sectionTitle">{title}</h2>
          {subtitle ? <p className="sectionSubtitle">{subtitle}</p> : null}
        </div>
      </header>
      <div className="sectionBody">{children}</div>
    </section>
  )
}

function Table({ columns, rows, rowKey }) {
  return (
    <div className="tableWrap" role="region" aria-label="data table">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.header} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="emptyCell" colSpan={columns.length}>
                No data.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td key={col.header}>{col.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''

  const [dbStatus, setDbStatus] = useState({
    status: 'checking',
    error: null,
  })

  const [botStatus, setBotStatus] = useState({
    status: 'checking',
    error: null,
  })

  const [rolesState, setRolesState] = useState({
    data: [],
    loading: true,
    error: null,
  })

  const [usersState, setUsersState] = useState({
    data: [],
    loading: true,
    error: null,
  })

  const [invitesState, setInvitesState] = useState({
    data: [],
    loading: true,
    error: null,
  })

  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedInviteLink, setSelectedInviteLink] = useState('')
  const [associationState, setAssociationState] = useState({
    status: 'idle',
    message: '',
  })

  useEffect(() => {
    const controller = new AbortController()
    let refreshInFlight = false

    const loadDbStatus = async ({ initialLoad }) => {
      if (initialLoad) setDbStatus({ status: 'checking', error: null })
      try {
        const url = joinUrl(apiBase, '/ping')
        const json = await fetchJson(url, { signal: controller.signal })
        if (json?.status === 'ok') {
          setDbStatus({ status: 'ok', error: null })
        } else {
          setDbStatus({ status: 'down', error: null })
        }
      } catch (err) {
        if (controller.signal.aborted) return
        setDbStatus({ status: 'down', error: err })
      }
    }

    const loadBotStatus = async ({ initialLoad }) => {
      if (initialLoad) setBotStatus({ status: 'checking', error: null })
      try {
        const url = joinUrl(apiBase, '/bot-ping')
        const json = await fetchJson(url, { signal: controller.signal })
        if (json?.status === 'ok') {
          setBotStatus({ status: 'ok', error: null })
        } else {
          setBotStatus({ status: 'down', error: null })
        }
      } catch (err) {
        if (controller.signal.aborted) return
        setBotStatus({ status: 'down', error: err })
      }
    }

    const loadList = async (path, setState, { initialLoad }) => {
      if (initialLoad) {
        setState({ data: [], loading: true, error: null })
      } else {
        setState((prev) => ({ ...prev, error: null }))
      }

      try {
        const url = joinUrl(apiBase, path)
        const json = await fetchJson(url, { signal: controller.signal })
        const list = asArray(json)
        setState({ data: list, loading: false, error: null })
      } catch (err) {
        if (controller.signal.aborted) return
        setState((prev) => ({
          data: prev.data ?? [],
          loading: false,
          error: err,
        }))
      }
    }

    const refreshAll = async ({ initialLoad }) => {
      if (refreshInFlight) return
      refreshInFlight = true
      try {
        await Promise.all([
          loadDbStatus({ initialLoad }),
          loadBotStatus({ initialLoad }),
          loadList('/invitation?page=0&size=20', setInvitesState, { initialLoad }),
          loadList('/role?page=0&size=20', setRolesState, { initialLoad }),
          loadList('/user?page=0&size=20', setUsersState, { initialLoad }),
        ])
      } finally {
        refreshInFlight = false
      }
    }

    void refreshAll({ initialLoad: true })
    const intervalId = window.setInterval(() => {
      void refreshAll({ initialLoad: false })
    }, 5_000)

    return () => {
      window.clearInterval(intervalId)
      controller.abort()
    }
  }, [apiBase])

  useEffect(() => {
    setSelectedRoleId((prev) =>
      prev && rolesState.data.some((r) => String(r.id) === prev) ? prev : '',
    )
  }, [rolesState.data])

  useEffect(() => {
    setSelectedInviteLink((prev) =>
      prev && invitesState.data.some((i) => String(i.invitationLink) === prev) ? prev : '',
    )
  }, [invitesState.data])

  const selectedRole = rolesState.data.find((r) => String(r.id) === selectedRoleId) ?? null
  const selectedInviteCode = invitationCodeFromValue(selectedInviteLink)
  const canConfirm = Boolean(selectedRole && selectedInviteCode)

  let roleSelectPlaceholder = 'Select a role'
  if (rolesState.loading) roleSelectPlaceholder = 'Loading roles…'
  else if (rolesState.error) roleSelectPlaceholder = 'Roles unavailable'

  let inviteSelectPlaceholder = 'Select an invitation link'
  if (invitesState.loading) inviteSelectPlaceholder = 'Loading invitation links…'
  else if (invitesState.error) inviteSelectPlaceholder = 'Invitation links unavailable'

  return (
    <div className="app">
      <header className="appHeader">
        <div>
          <h1 className="appTitle">Discord Bot Admin</h1>
          <p className="appSubtitle">Single-server administrator interface</p>
        </div>

        <div className="statusBadges" aria-label="Service status">
          <div
            className={`pill pill--${dbStatus.status}`}
            title={
              dbStatus.status === 'down' && dbStatus.error
                ? String(dbStatus.error.message ?? dbStatus.error)
                : 'Database server status'
            }
            aria-label="Database server status"
          >
            DB: {dbStatus.status === 'ok' ? 'OK' : dbStatus.status === 'checking' ? 'Checking…' : 'Offline'}
          </div>

          <div
            className={`pill pill--${botStatus.status}`}
            title={
              botStatus.status === 'down' && botStatus.error
                ? String(botStatus.error.message ?? botStatus.error)
                : 'Discord bot status'
            }
            aria-label="Discord bot status"
          >
            Bot: {botStatus.status === 'ok' ? 'OK' : botStatus.status === 'checking' ? 'Checking…' : 'Offline'}
          </div>
        </div>
      </header>

      <main className="grid">
        <Section
          title="Associate Invitation Link"
          subtitle="Choose a role and an invitation link (placeholder UI)"
        >
          <fieldset className="formGrid" aria-label="associate invitation link with role">
            <legend className="fieldLegend">Selection</legend>
            <div className="formField">
              <label className="fieldLabel" htmlFor="roleSelect">
                Role
              </label>
              <select
                id="roleSelect"
                className="select"
                value={selectedRoleId}
                onChange={(e) => {
                  setSelectedRoleId(e.target.value)
                  setAssociationState({ status: 'idle', message: '' })
                }}
                disabled={rolesState.loading || Boolean(rolesState.error) || rolesState.data.length === 0}
              >
                <option value="">{roleSelectPlaceholder}</option>
                {rolesState.data.map((role) => (
                  <option key={String(role.id)} value={String(role.id)}>
                    {role.roleName}
                  </option>
                ))}
              </select>
            </div>

            <div className="formField">
              <label className="fieldLabel" htmlFor="inviteSelect">
                Invitation Link
              </label>
              <select
                id="inviteSelect"
                className="select"
                value={selectedInviteLink}
                onChange={(e) => {
                  setSelectedInviteLink(e.target.value)
                  setAssociationState({ status: 'idle', message: '' })
                }}
                disabled={invitesState.loading || Boolean(invitesState.error) || invitesState.data.length === 0}
              >
                <option value="">{inviteSelectPlaceholder}</option>
                {invitesState.data.map((invite) => {
                  const link = String(invite.invitationLink)
                  return (
                    <option key={`${String(invite.id)}:${link}`} value={link}>
                      {link}
                    </option>
                  )
                })}
              </select>
            </div>
          </fieldset>

          <div className="buttonRow">
            <button
              type="button"
              onClick={async () => {
                const inviteCode = invitationCodeFromValue(selectedInviteLink)
                if (!selectedRole || !inviteCode) return
                setAssociationState({ status: 'saving', message: 'Saving…' })
                try {
                  const path = `/role/${encodeURIComponent(String(selectedRole.id))}/${encodeURIComponent(
                    inviteCode,
                  )}`
                  const url = joinUrl(apiBase, path)
                  await putJson(url)

                  setRolesState((prev) => ({
                    ...prev,
                    data: (prev.data ?? []).map((role) =>
                      String(role.id) === String(selectedRole.id)
                        ? { ...role, invitationLink: inviteCode }
                        : role,
                    ),
                  }))

                  setAssociationState({
                    status: 'success',
                    message: `Saved: ${selectedRole.roleName} -> ${inviteCode}`,
                  })
                } catch (err) {
                  setAssociationState({
                    status: 'error',
                    message: `Failed to save: ${String(err?.message ?? err)}`,
                  })
                }
              }}
              disabled={!canConfirm || associationState.status === 'saving'}
            >
              Confirm
            </button>
          </div>

          {associationState.message ? (
            <div className={`status ${associationState.status === 'error' ? 'error' : ''}`}>
              {associationState.message}
            </div>
          ) : null}
        </Section>

        <Section
          title="Roles"
          subtitle={rolesState.loading ? 'Loading…' : `Total: ${rolesState.data.length}`}
        >
          {rolesState.error ? (
            <div className="status error">
              Failed to load roles: {String(rolesState.error.message ?? rolesState.error)}
            </div>
          ) : (
            <Table
              rows={rolesState.data}
              rowKey={(r) => String(r.id)}
              columns={[
                { header: 'ID', render: (r) => String(r.id) },
                { header: 'Role', render: (r) => r.roleName },
                { header: 'Invitation Link', render: (r) => displayInvitationLink(r.invitationLink) },
              ]}
            />
          )}
        </Section>

        <Section
          title="Users"
          subtitle={usersState.loading ? 'Loading…' : `Total: ${usersState.data.length}`}
        >
          {usersState.error ? (
            <div className="status error">
              Failed to load users: {String(usersState.error.message ?? usersState.error)}
            </div>
          ) : (
            <Table
              rows={usersState.data}
              rowKey={(u) => String(u.id)}
              columns={[
                { header: 'ID', render: (u) => String(u.id) },
                { header: 'Username', render: (u) => u.username },
                { header: 'Joined', render: (u) => formatJoinedDate(u.joinedDate) },
                {
                  header: 'Roles',
                  render: (u) =>
                    u.roles?.length
                      ? u.roles
                        .map((role) =>
                          role.invitationLink
                            ? `${role.roleName} (${displayInvitationLink(role.invitationLink)})`
                            : role.roleName,
                        )
                        .join(', ')
                      : '—',
                },
              ]}
            />
          )}
        </Section>

        <Section
          title="Invitation Links"
          subtitle={invitesState.loading ? 'Loading…' : `Total: ${invitesState.data.length}`}
        >
          {invitesState.error ? (
            <div className="status error">
              Failed to load invitation links:{' '}
              {String(invitesState.error.message ?? invitesState.error)}
            </div>
          ) : (
            <Table
              rows={invitesState.data}
              rowKey={(i) => String(i.id)}
              columns={[
                { header: 'ID', render: (i) => String(i.id) },
                { header: 'Invitation Link', render: (i) => i.invitationLink },
              ]}
            />
          )}
        </Section>
      </main>

      <footer className="footerNote">
        IDs are treated as strings to avoid JavaScript precision loss.
      </footer>
    </div>
  )
}

export default App
