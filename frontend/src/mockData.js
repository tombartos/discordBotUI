// Discord "snowflake" IDs are larger than JavaScript's safe integer range.
// Keep them as strings in the frontend to avoid precision loss.

export const roles = [
    {
        id: '1448340203264803000',
        roleName: 'TestRole',
        invitationLink: null,
    },
    {
        id: '1425124398456635400',
        roleName: 'Owner',
        invitationLink: null,
    },
]

export const users = [
    {
        id: '283189354157965300',
        username: 'tombartos',
        joinedDate: '2025-10-03T08:34:17.163',
        roles: [
            {
                id: '1425124398456635400',
                roleName: 'Owner',
                invitationLink: null,
            },
        ],
    },
]

export const invitationLinks = [
    {
        id: '1',
        invitationLink: 'R778zuxUht',
    },
]
