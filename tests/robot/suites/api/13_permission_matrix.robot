*** Settings ***
Documentation       A1 permission matrix: role (owner, admin, estimator, viewer, non-member, anonymous) x action, one test
...                 per cell, plus decision tables for role changes, member removal and the role of an invitation.
...                 Expected statuses come from ``backend/src/shared/domain/permissions.ts`` (MATRIX), the policies in
...                 ``backend/src/modules/workspaces/domain/policies`` and ``project-access.ts``: a member without the
...                 permission gets 403 ``forbidden``, a non-member 404 ``not_found`` (the tenant stays invisible), no
...                 token 401 ``unauthenticated``. The test rows are generated from compact tables; the keywords below
...                 are hand written.
Resource            ../../resources/api.resource
Resource            ../../resources/db.resource
Resource            ../../resources/pages/api_team.resource
Suite Setup         Prepare Matrix Team
Test Tags           api    team    security    matrix    db


*** Test Cases ***
# ── role x action matrix ──
Owner Gets 200 On Read Workspace
    [Documentation]    Permission ``workspace.read``: owner -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    read workspace    200

Admin Gets 200 On Read Workspace
    [Documentation]    Permission ``workspace.read``: admin -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    read workspace    200

Estimator Gets 200 On Read Workspace
    [Documentation]    Permission ``workspace.read``: estimator -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    estimator    read workspace    200

Viewer Gets 200 On Read Workspace
    [Documentation]    Permission ``workspace.read``: viewer -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    viewer    read workspace    200

Outsider Gets 404 On Read Workspace
    [Documentation]    Permission ``workspace.read``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    read workspace    404

Anonymous Gets 401 On Read Workspace
    [Documentation]    Permission ``workspace.read``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    read workspace    401

Owner Gets 200 On Rename Workspace
    [Documentation]    Permission ``workspace.rename``: owner -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    rename workspace    200

Admin Gets 200 On Rename Workspace
    [Documentation]    Permission ``workspace.rename``: admin -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    rename workspace    200

Estimator Gets 403 On Rename Workspace
    [Documentation]    Permission ``workspace.rename``: estimator -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    estimator    rename workspace    403

Viewer Gets 403 On Rename Workspace
    [Documentation]    Permission ``workspace.rename``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    rename workspace    403

Outsider Gets 404 On Rename Workspace
    [Documentation]    Permission ``workspace.rename``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    rename workspace    404

Anonymous Gets 401 On Rename Workspace
    [Documentation]    Permission ``workspace.rename``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    rename workspace    401

Owner Gets 204 On Delete Workspace
    [Documentation]    Permission ``workspace.delete``: owner -> 204.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    delete workspace    204

Admin Gets 403 On Delete Workspace
    [Documentation]    Permission ``workspace.delete``: admin -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    admin    delete workspace    403

Estimator Gets 403 On Delete Workspace
    [Documentation]    Permission ``workspace.delete``: estimator -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    estimator    delete workspace    403

Viewer Gets 403 On Delete Workspace
    [Documentation]    Permission ``workspace.delete``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    delete workspace    403

Outsider Gets 404 On Delete Workspace
    [Documentation]    Permission ``workspace.delete``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    delete workspace    404

Anonymous Gets 401 On Delete Workspace
    [Documentation]    Permission ``workspace.delete``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    delete workspace    401

Owner Gets 200 On List Members
    [Documentation]    Permission ``members.read``: owner -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    list members    200

Admin Gets 200 On List Members
    [Documentation]    Permission ``members.read``: admin -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    list members    200

Estimator Gets 200 On List Members
    [Documentation]    Permission ``members.read``: estimator -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    estimator    list members    200

Viewer Gets 200 On List Members
    [Documentation]    Permission ``members.read``: viewer -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    viewer    list members    200

Outsider Gets 404 On List Members
    [Documentation]    Permission ``members.read``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    list members    404

Anonymous Gets 401 On List Members
    [Documentation]    Permission ``members.read``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    list members    401

Owner Gets 201 On Invite Member
    [Documentation]    Permission ``members.invite``: owner -> 201.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    invite member    201

Admin Gets 201 On Invite Member
    [Documentation]    Permission ``members.invite``: admin -> 201.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    invite member    201

Estimator Gets 403 On Invite Member
    [Documentation]    Permission ``members.invite``: estimator -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    estimator    invite member    403

Viewer Gets 403 On Invite Member
    [Documentation]    Permission ``members.invite``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    invite member    403

Outsider Gets 404 On Invite Member
    [Documentation]    Permission ``members.invite``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    invite member    404

Anonymous Gets 401 On Invite Member
    [Documentation]    Permission ``members.invite``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    invite member    401

Owner Gets 200 On List Invitations
    [Documentation]    Permission ``members.invite``: owner -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    list invitations    200

Admin Gets 200 On List Invitations
    [Documentation]    Permission ``members.invite``: admin -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    list invitations    200

Estimator Gets 403 On List Invitations
    [Documentation]    Permission ``members.invite``: estimator -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    estimator    list invitations    403

Viewer Gets 403 On List Invitations
    [Documentation]    Permission ``members.invite``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    list invitations    403

Outsider Gets 404 On List Invitations
    [Documentation]    Permission ``members.invite``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    list invitations    404

Anonymous Gets 401 On List Invitations
    [Documentation]    Permission ``members.invite``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    list invitations    401

Owner Gets 200 On Change Role
    [Documentation]    Permission ``members.changeRole``: owner -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    change role    200

Admin Gets 200 On Change Role
    [Documentation]    Permission ``members.changeRole``: admin -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    change role    200

Estimator Gets 403 On Change Role
    [Documentation]    Permission ``members.changeRole``: estimator -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    estimator    change role    403

Viewer Gets 403 On Change Role
    [Documentation]    Permission ``members.changeRole``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    change role    403

Outsider Gets 404 On Change Role
    [Documentation]    Permission ``members.changeRole``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    change role    404

Anonymous Gets 401 On Change Role
    [Documentation]    Permission ``members.changeRole``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    change role    401

Owner Gets 204 On Remove Member
    [Documentation]    Permission ``members.remove``: owner -> 204.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    remove member    204

Admin Gets 204 On Remove Member
    [Documentation]    Permission ``members.remove``: admin -> 204.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    remove member    204

Estimator Gets 403 On Remove Member
    [Documentation]    Permission ``members.remove``: estimator -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    estimator    remove member    403

Viewer Gets 403 On Remove Member
    [Documentation]    Permission ``members.remove``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    remove member    403

Outsider Gets 404 On Remove Member
    [Documentation]    Permission ``members.remove``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    remove member    404

Anonymous Gets 401 On Remove Member
    [Documentation]    Permission ``members.remove``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    remove member    401

Owner Gets 201 On Create Project
    [Documentation]    Permission ``projects.create``: owner -> 201.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    create project    201

Admin Gets 201 On Create Project
    [Documentation]    Permission ``projects.create``: admin -> 201.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    create project    201

Estimator Gets 201 On Create Project
    [Documentation]    Permission ``projects.create``: estimator -> 201.
    [Tags]    positive
    [Template]    Role Action Should Give
    estimator    create project    201

Viewer Gets 403 On Create Project
    [Documentation]    Permission ``projects.create``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    create project    403

Outsider Gets 404 On Create Project
    [Documentation]    Permission ``projects.create``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    create project    404

Anonymous Gets 401 On Create Project
    [Documentation]    Permission ``projects.create``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    create project    401

Owner Gets 200 On List Projects
    [Documentation]    Permission ``projects.read``: owner -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    list projects    200

Admin Gets 200 On List Projects
    [Documentation]    Permission ``projects.read``: admin -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    list projects    200

Estimator Gets 200 On List Projects
    [Documentation]    Permission ``projects.read``: estimator -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    estimator    list projects    200

Viewer Gets 200 On List Projects
    [Documentation]    Permission ``projects.read``: viewer -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    viewer    list projects    200

Outsider Gets 404 On List Projects
    [Documentation]    Permission ``projects.read``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    list projects    404

Anonymous Gets 401 On List Projects
    [Documentation]    Permission ``projects.read``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    list projects    401

Owner Gets 200 On Read Project
    [Documentation]    Permission ``projects.read``: owner -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    read project    200

Admin Gets 200 On Read Project
    [Documentation]    Permission ``projects.read``: admin -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    read project    200

Estimator Gets 200 On Read Project
    [Documentation]    Permission ``projects.read``: estimator -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    estimator    read project    200

Viewer Gets 200 On Read Project
    [Documentation]    Permission ``projects.read``: viewer -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    viewer    read project    200

Outsider Gets 404 On Read Project
    [Documentation]    Permission ``projects.read``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    read project    404

Anonymous Gets 401 On Read Project
    [Documentation]    Permission ``projects.read``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    read project    401

Owner Gets 200 On Rename Project
    [Documentation]    Permission ``projects.edit``: owner -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    rename project    200

Admin Gets 200 On Rename Project
    [Documentation]    Permission ``projects.edit``: admin -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    rename project    200

Estimator Gets 200 On Rename Project
    [Documentation]    Permission ``projects.edit``: estimator -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    estimator    rename project    200

Viewer Gets 403 On Rename Project
    [Documentation]    Permission ``projects.edit``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    rename project    403

Outsider Gets 404 On Rename Project
    [Documentation]    Permission ``projects.edit``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    rename project    404

Anonymous Gets 401 On Rename Project
    [Documentation]    Permission ``projects.edit``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    rename project    401

Owner Gets 200 On Archive Project
    [Documentation]    Permission ``projects.archive``: owner -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    archive project    200

Admin Gets 200 On Archive Project
    [Documentation]    Permission ``projects.archive``: admin -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    archive project    200

Estimator Gets 200 On Archive Project
    [Documentation]    Permission ``projects.archive``: estimator -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    estimator    archive project    200

Viewer Gets 403 On Archive Project
    [Documentation]    Permission ``projects.archive``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    archive project    403

Outsider Gets 404 On Archive Project
    [Documentation]    Permission ``projects.archive``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    archive project    404

Anonymous Gets 401 On Archive Project
    [Documentation]    Permission ``projects.archive``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    archive project    401

Owner Gets 204 On Delete Project
    [Documentation]    Permission ``projects.delete``: owner -> 204.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    delete project    204

Admin Gets 204 On Delete Project
    [Documentation]    Permission ``projects.delete``: admin -> 204.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    delete project    204

Estimator Gets 403 On Delete Project
    [Documentation]    Permission ``projects.delete``: estimator -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    estimator    delete project    403

Viewer Gets 403 On Delete Project
    [Documentation]    Permission ``projects.delete``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    delete project    403

Outsider Gets 404 On Delete Project
    [Documentation]    Permission ``projects.delete``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    delete project    404

Anonymous Gets 401 On Delete Project
    [Documentation]    Permission ``projects.delete``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    delete project    401

Owner Gets 201 On Create Revision
    [Documentation]    Permission ``revisions.create``: owner -> 201.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    create revision    201

Admin Gets 201 On Create Revision
    [Documentation]    Permission ``revisions.create``: admin -> 201.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    create revision    201

Estimator Gets 201 On Create Revision
    [Documentation]    Permission ``revisions.create``: estimator -> 201.
    [Tags]    positive
    [Template]    Role Action Should Give
    estimator    create revision    201

Viewer Gets 403 On Create Revision
    [Documentation]    Permission ``revisions.create``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    create revision    403

Outsider Gets 404 On Create Revision
    [Documentation]    Permission ``revisions.create``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    create revision    404

Anonymous Gets 401 On Create Revision
    [Documentation]    Permission ``revisions.create``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    create revision    401

Owner Gets 200 On Assign Level
    [Documentation]    Permission ``levels.assign``: owner -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    owner    assign level    200

Admin Gets 200 On Assign Level
    [Documentation]    Permission ``levels.assign``: admin -> 200.
    [Tags]    positive
    [Template]    Role Action Should Give
    admin    assign level    200

Estimator Gets 403 On Assign Level
    [Documentation]    Permission ``levels.assign``: estimator -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    estimator    assign level    403

Viewer Gets 403 On Assign Level
    [Documentation]    Permission ``levels.assign``: viewer -> 403.
    [Tags]    negative
    [Template]    Role Action Should Give
    viewer    assign level    403

Outsider Gets 404 On Assign Level
    [Documentation]    Permission ``levels.assign``: outsider -> 404.
    [Tags]    negative
    [Template]    Role Action Should Give
    outsider    assign level    404

Anonymous Gets 401 On Assign Level
    [Documentation]    Permission ``levels.assign``: anonymous -> 401.
    [Tags]    negative
    [Template]    Role Action Should Give
    anonymous    assign level    401

# ── decision table: who may change whose role to what ──
Owner Changing Admin To Estimator Gets 200
    [Documentation]    role-change.policy: actor owner, target admin, new role estimator -> 200.
    [Tags]    positive    role-change
    [Template]    Role Change Should Give
    owner    admin    estimator    200

Owner Changing Estimator To Owner Gets 200
    [Documentation]    role-change.policy: actor owner, target estimator, new role owner -> 200.
    [Tags]    positive    role-change
    [Template]    Role Change Should Give
    owner    estimator    owner    200

Owner Changing Owner To Admin Gets 200
    [Documentation]    role-change.policy: actor owner, target owner, new role admin -> 200.
    [Tags]    positive    role-change
    [Template]    Role Change Should Give
    owner    owner    admin    200

Owner Changing Viewer To Admin Gets 200
    [Documentation]    role-change.policy: actor owner, target viewer, new role admin -> 200.
    [Tags]    positive    role-change
    [Template]    Role Change Should Give
    owner    viewer    admin    200

Owner Changing Admin To Viewer Gets 200
    [Documentation]    role-change.policy: actor owner, target admin, new role viewer -> 200.
    [Tags]    positive    role-change
    [Template]    Role Change Should Give
    owner    admin    viewer    200

Admin Changing Estimator To Viewer Gets 200
    [Documentation]    role-change.policy: actor admin, target estimator, new role viewer -> 200.
    [Tags]    positive    role-change
    [Template]    Role Change Should Give
    admin    estimator    viewer    200

Admin Changing Viewer To Estimator Gets 200
    [Documentation]    role-change.policy: actor admin, target viewer, new role estimator -> 200.
    [Tags]    positive    role-change
    [Template]    Role Change Should Give
    admin    viewer    estimator    200

Admin Changing Viewer To Admin Gets 200
    [Documentation]    role-change.policy: actor admin, target viewer, new role admin -> 200.
    [Tags]    positive    role-change
    [Template]    Role Change Should Give
    admin    viewer    admin    200

Admin Changing Admin To Viewer Gets 200
    [Documentation]    role-change.policy: actor admin, target admin, new role viewer -> 200.
    [Tags]    positive    role-change
    [Template]    Role Change Should Give
    admin    admin    viewer    200

Admin Changing Estimator To Owner Gets 403
    [Documentation]    role-change.policy: actor admin, target estimator, new role owner -> 403.
    [Tags]    negative    role-change
    [Template]    Role Change Should Give
    admin    estimator    owner    403

Admin Changing Owner To Viewer Gets 403
    [Documentation]    role-change.policy: actor admin, target owner, new role viewer -> 403.
    [Tags]    negative    role-change
    [Template]    Role Change Should Give
    admin    owner    viewer    403

Admin Changing Owner To Owner Gets 403
    [Documentation]    role-change.policy: actor admin, target owner, new role owner -> 403.
    [Tags]    negative    role-change
    [Template]    Role Change Should Give
    admin    owner    owner    403

Admin Changing Admin To Owner Gets 403
    [Documentation]    role-change.policy: actor admin, target admin, new role owner -> 403.
    [Tags]    negative    role-change
    [Template]    Role Change Should Give
    admin    admin    owner    403

Estimator Changing Viewer To Estimator Gets 403
    [Documentation]    role-change.policy: actor estimator, target viewer, new role estimator -> 403.
    [Tags]    negative    role-change
    [Template]    Role Change Should Give
    estimator    viewer    estimator    403

Estimator Changing Estimator To Viewer Gets 403
    [Documentation]    role-change.policy: actor estimator, target estimator, new role viewer -> 403.
    [Tags]    negative    role-change
    [Template]    Role Change Should Give
    estimator    estimator    viewer    403

Viewer Changing Estimator To Viewer Gets 403
    [Documentation]    role-change.policy: actor viewer, target estimator, new role viewer -> 403.
    [Tags]    negative    role-change
    [Template]    Role Change Should Give
    viewer    estimator    viewer    403

Viewer Changing Viewer To Viewer Gets 403
    [Documentation]    role-change.policy: actor viewer, target viewer, new role viewer -> 403.
    [Tags]    negative    role-change
    [Template]    Role Change Should Give
    viewer    viewer    viewer    403

# ── decision table: who may remove whom ──
Owner Removing Admin Gets 204
    [Documentation]    member-removal.policy: actor owner, target admin -> 204.
    [Tags]    positive    removal
    [Template]    Removal Should Give
    owner    admin    204

Owner Removing Estimator Gets 204
    [Documentation]    member-removal.policy: actor owner, target estimator -> 204.
    [Tags]    positive    removal
    [Template]    Removal Should Give
    owner    estimator    204

Owner Removing Viewer Gets 204
    [Documentation]    member-removal.policy: actor owner, target viewer -> 204.
    [Tags]    positive    removal
    [Template]    Removal Should Give
    owner    viewer    204

Owner Removing Owner Gets 204
    [Documentation]    member-removal.policy: actor owner, target owner -> 204.
    [Tags]    positive    removal
    [Template]    Removal Should Give
    owner    owner    204

Admin Removing Estimator Gets 204
    [Documentation]    member-removal.policy: actor admin, target estimator -> 204.
    [Tags]    positive    removal
    [Template]    Removal Should Give
    admin    estimator    204

Admin Removing Viewer Gets 204
    [Documentation]    member-removal.policy: actor admin, target viewer -> 204.
    [Tags]    positive    removal
    [Template]    Removal Should Give
    admin    viewer    204

Admin Removing Admin Gets 204
    [Documentation]    member-removal.policy: actor admin, target admin -> 204.
    [Tags]    positive    removal
    [Template]    Removal Should Give
    admin    admin    204

Admin Removing Owner Gets 403
    [Documentation]    member-removal.policy: actor admin, target owner -> 403.
    [Tags]    negative    removal
    [Template]    Removal Should Give
    admin    owner    403

Estimator Removing Viewer Gets 403
    [Documentation]    member-removal.policy: actor estimator, target viewer -> 403.
    [Tags]    negative    removal
    [Template]    Removal Should Give
    estimator    viewer    403

Estimator Removing Admin Gets 403
    [Documentation]    member-removal.policy: actor estimator, target admin -> 403.
    [Tags]    negative    removal
    [Template]    Removal Should Give
    estimator    admin    403

Viewer Removing Estimator Gets 403
    [Documentation]    member-removal.policy: actor viewer, target estimator -> 403.
    [Tags]    negative    removal
    [Template]    Removal Should Give
    viewer    estimator    403

Viewer Removing Owner Gets 403
    [Documentation]    member-removal.policy: actor viewer, target owner -> 403.
    [Tags]    negative    removal
    [Template]    Removal Should Give
    viewer    owner    403

Admin Leaving Gets 204
    [Documentation]    member-removal.policy: actor admin, target self -> 204.
    [Tags]    positive    removal
    [Template]    Removal Should Give
    admin    self    204

Estimator Leaving Gets 204
    [Documentation]    member-removal.policy: actor estimator, target self -> 204.
    [Tags]    positive    removal
    [Template]    Removal Should Give
    estimator    self    204

Viewer Leaving Gets 204
    [Documentation]    member-removal.policy: actor viewer, target self -> 204.
    [Tags]    positive    removal
    [Template]    Removal Should Give
    viewer    self    204

# ── decision table: who may invite with which role ──
Owner Inviting As Admin Gets 201
    [Documentation]    invitation.policy: inviter owner, invited role admin -> 201.
    [Tags]    positive    invitation-role
    [Template]    Invite Role Should Give
    owner    admin    201

Owner Inviting As Estimator Gets 201
    [Documentation]    invitation.policy: inviter owner, invited role estimator -> 201.
    [Tags]    positive    invitation-role
    [Template]    Invite Role Should Give
    owner    estimator    201

Owner Inviting As Viewer Gets 201
    [Documentation]    invitation.policy: inviter owner, invited role viewer -> 201.
    [Tags]    positive    invitation-role
    [Template]    Invite Role Should Give
    owner    viewer    201

Owner Inviting As Owner Gets 400
    [Documentation]    invitation.policy: inviter owner, invited role owner -> 400.
    [Tags]    negative    invitation-role
    [Template]    Invite Role Should Give
    owner    owner    400

Admin Inviting As Admin Gets 201
    [Documentation]    invitation.policy: inviter admin, invited role admin -> 201.
    [Tags]    positive    invitation-role
    [Template]    Invite Role Should Give
    admin    admin    201

Admin Inviting As Estimator Gets 201
    [Documentation]    invitation.policy: inviter admin, invited role estimator -> 201.
    [Tags]    positive    invitation-role
    [Template]    Invite Role Should Give
    admin    estimator    201

Admin Inviting As Viewer Gets 201
    [Documentation]    invitation.policy: inviter admin, invited role viewer -> 201.
    [Tags]    positive    invitation-role
    [Template]    Invite Role Should Give
    admin    viewer    201

Admin Inviting As Owner Gets 400
    [Documentation]    invitation.policy: inviter admin, invited role owner -> 400.
    [Tags]    negative    invitation-role
    [Template]    Invite Role Should Give
    admin    owner    400

Estimator Inviting As Admin Gets 403
    [Documentation]    invitation.policy: inviter estimator, invited role admin -> 403.
    [Tags]    negative    invitation-role
    [Template]    Invite Role Should Give
    estimator    admin    403

Estimator Inviting As Estimator Gets 403
    [Documentation]    invitation.policy: inviter estimator, invited role estimator -> 403.
    [Tags]    negative    invitation-role
    [Template]    Invite Role Should Give
    estimator    estimator    403

Estimator Inviting As Viewer Gets 403
    [Documentation]    invitation.policy: inviter estimator, invited role viewer -> 403.
    [Tags]    negative    invitation-role
    [Template]    Invite Role Should Give
    estimator    viewer    403

Viewer Inviting As Admin Gets 403
    [Documentation]    invitation.policy: inviter viewer, invited role admin -> 403.
    [Tags]    negative    invitation-role
    [Template]    Invite Role Should Give
    viewer    admin    403

Viewer Inviting As Estimator Gets 403
    [Documentation]    invitation.policy: inviter viewer, invited role estimator -> 403.
    [Tags]    negative    invitation-role
    [Template]    Invite Role Should Give
    viewer    estimator    403

Viewer Inviting As Viewer Gets 403
    [Documentation]    invitation.policy: inviter viewer, invited role viewer -> 403.
    [Tags]    negative    invitation-role
    [Template]    Invite Role Should Give
    viewer    viewer    403


*** Keywords ***
Prepare Matrix Team
    [Documentation]    One shared team for the non-destructive cells (suite variable ``${TEAM}``).
    Create Anonymous Session    anon
    ${team}=    Create Team Workspace
    VAR    &{anonymous}    alias=anon
    Set To Dictionary    ${team}    anonymous=${anonymous}
    VAR    ${TEAM}    ${team}    scope=SUITE

Matrix Status Code Should Match
    [Documentation]    The error code that belongs to the status (401 unauthenticated, 403 forbidden, 404 not_found).
    [Arguments]    ${resp}    ${status}
    IF    ${status} == 401
        Error Code Should Be    ${resp}    unauthenticated
    ELSE IF    ${status} == 403
        Error Code Should Be    ${resp}    forbidden
    ELSE IF    ${status} == 404
        Error Code Should Be    ${resp}    not_found
    ELSE IF    ${status} == 400
        Error Code Should Be    ${resp}    validation_failed
    END

Disposable Workspace
    [Documentation]    A fresh company workspace for destructive cells. Returns ``${ws}``, the acting ``&{user}`` and the
    ...    creator. ``outsider`` acts from another tenant, ``anonymous`` without a token.
    [Arguments]    ${role}
    ${creator}=    Register User Via API    own
    ${ws}=    Create Company Workspace Via API    ${creator}
    IF    '${role}' == 'owner'
        VAR    ${actor}    ${creator}
    ELSE IF    '${role}' == 'outsider'
        VAR    ${actor}    ${TEAM}[outsider]
    ELSE IF    '${role}' == 'anonymous'
        VAR    ${actor}    ${TEAM}[anonymous]
    ELSE
        ${actor}=    Add Member With Role    ${creator}    ${ws}    ${role}
    END
    RETURN    ${ws}    ${actor}    ${creator}

Role Action Should Give
    [Documentation]    One cell of the matrix: ``${role}`` performs ``${action}`` and must get ``${expected}``;
    ...    the database must show the write only when the call succeeded.
    [Arguments]    ${role}    ${action}    ${expected}
    ${user}=    Set Variable    ${TEAM}[${role}]
    ${ws}=    Set Variable    ${TEAM}[ws]
    ${owner}=    Set Variable    ${TEAM}[owner]
    ${name}=    Unique Name    ทดสอบสิทธิ์
    ${email}=    Unique Email    inv
    IF    $action == 'read workspace'
        ${resp}=    Api Call    ${user}[alias]    GET    /workspaces/${ws}    ${expected}
    ELSE IF    $action == 'rename workspace'
        VAR    &{body}    name=${name}
        ${resp}=    Api Call    ${user}[alias]    PATCH    /workspaces/${ws}    ${expected}    ${body}
        ${stored}=    Query Value    select name from workspaces where id = %s    ${ws}
        IF    ${expected} == 200
            Should Be Equal    ${stored}    ${name}
        ELSE
            Should Not Be Equal    ${stored}    ${name}
        END
    ELSE IF    $action == 'delete workspace'
        ${target}    ${actor}    ${creator}=    Disposable Workspace    ${role}
        ${resp}=    Api Call    ${actor}[alias]    DELETE    /workspaces/${target}    ${expected}
        ${left}=    Query Value    select count(*) from workspaces where id = %s    ${target}
        Should Be Equal As Integers    ${left}    ${{ 0 if ${expected} == 204 else 1 }}
    ELSE IF    $action == 'list members'
        ${resp}=    Api Call    ${user}[alias]    GET    /workspaces/${ws}/members    ${expected}
    ELSE IF    $action == 'invite member'
        ${resp}=    Invite Via API    ${user}    ${ws}    ${email}    viewer    ${expected}
        ${rows}=    Query Value    select count(*) from invitations where workspace_id = %s and email = %s    ${ws}    ${email}
        Should Be Equal As Integers    ${rows}    ${{ 1 if ${expected} == 201 else 0 }}
    ELSE IF    $action == 'list invitations'
        ${resp}=    Api Call    ${user}[alias]    GET    /workspaces/${ws}/invitations    ${expected}
    ELSE IF    $action == 'change role'
        ${target}=    Add Member With Role    ${owner}    ${ws}    estimator
        VAR    &{body}    role=viewer
        ${resp}=    Api Call    ${user}[alias]    PATCH    /workspaces/${ws}/members/${target}[id]    ${expected}    ${body}
        ${now}=    Query Value    select role from memberships where workspace_id = %s and user_id = %s    ${ws}    ${target}[id]
        Should Be Equal    ${now}    ${{ 'viewer' if ${expected} == 200 else 'estimator' }}
    ELSE IF    $action == 'remove member'
        ${target}=    Add Member With Role    ${owner}    ${ws}    viewer
        ${resp}=    Api Call    ${user}[alias]    DELETE    /workspaces/${ws}/members/${target}[id]    ${expected}
        ${left}=    Query Value    select count(*) from memberships where workspace_id = %s and user_id = %s    ${ws}    ${target}[id]
        Should Be Equal As Integers    ${left}    ${{ 0 if ${expected} == 204 else 1 }}
    ELSE IF    $action == 'create project'
        VAR    &{body}    name=${name}    start=blank
        ${resp}=    Api Call    ${user}[alias]    POST    /workspaces/${ws}/projects    ${expected}    ${body}
        ${rows}=    Query Value    select count(*) from projects where workspace_id = %s and name = %s    ${ws}    ${name}
        Should Be Equal As Integers    ${rows}    ${{ 1 if ${expected} == 201 else 0 }}
    ELSE IF    $action == 'list projects'
        ${resp}=    Api Call    ${user}[alias]    GET    /workspaces/${ws}/projects    ${expected}
    ELSE
        Project Action Should Give    ${action}    ${user}    ${expected}
        RETURN
    END
    Matrix Status Code Should Match    ${resp}    ${expected}

Project Action Should Give
    [Documentation]    Actions on an existing project (created by the owner for this cell).
    [Arguments]    ${action}    ${user}    ${expected}
    ${ws}=    Set Variable    ${TEAM}[ws]
    ${project}=    Create Project Via API    ${TEAM}[owner]    ${ws}
    ${id}=    Set Variable    ${project}[project][id]
    ${name}=    Unique Name    ชื่อใหม่
    IF    $action == 'read project'
        ${resp}=    Api Call    ${user}[alias]    GET    /projects/${id}    ${expected}
    ELSE IF    $action == 'rename project'
        VAR    &{body}    name=${name}
        ${resp}=    Api Call    ${user}[alias]    PATCH    /projects/${id}    ${expected}    ${body}
        ${stored}=    Query Value    select name from projects where id = %s    ${id}
        IF    ${expected} == 200
            Should Be Equal    ${stored}    ${name}
        ELSE
            Should Not Be Equal    ${stored}    ${name}
        END
    ELSE IF    $action == 'archive project'
        VAR    &{body}    archived=${True}
        ${resp}=    Api Call    ${user}[alias]    PATCH    /projects/${id}    ${expected}    ${body}
        ${archived}=    Query Value    select archived_at is not null from projects where id = %s    ${id}
        Should Be Equal    ${archived}    ${{ ${expected} == 200 }}
    ELSE IF    $action == 'delete project'
        ${resp}=    Api Call    ${user}[alias]    DELETE    /projects/${id}    ${expected}
        ${left}=    Query Value    select count(*) from projects where id = %s    ${id}
        Should Be Equal As Integers    ${left}    ${{ 0 if ${expected} == 204 else 1 }}
    ELSE IF    $action == 'create revision'
        VAR    &{body}    label=${{ 'R' + $name[-6:] }}
        ${resp}=    Api Call    ${user}[alias]    POST    /projects/${id}/revisions    ${expected}    ${body}
        ${rows}=    Query Value    select count(*) from project_revisions where project_id = %s    ${id}
        Should Be Equal As Integers    ${rows}    ${{ 1 if ${expected} == 201 else 0 }}
    ELSE IF    $action == 'assign level'
        VAR    &{body}    userId=${TEAM}[estimator][id]
        ${resp}=    Api Call    ${user}[alias]    PUT    /projects/${id}/assignments/land-inspection    ${expected}    ${body}
        ${rows}=    Query Value    select count(*) from level_assignments where project_id = %s    ${id}
        Should Be Equal As Integers    ${rows}    ${{ 1 if ${expected} == 200 else 0 }}
    ELSE
        Fail    Unknown action ${action}
    END
    Matrix Status Code Should Match    ${resp}    ${expected}

Role Change Should Give
    [Documentation]    Decision table of ``role-change.policy``: a fresh workspace with its creator (owner), the actor and
    ...    the target; the actor sets the target to ``${new_role}``.
    [Arguments]    ${actor_role}    ${target_role}    ${new_role}    ${expected}
    ${creator}=    Register User Via API    own
    ${ws}=    Create Company Workspace Via API    ${creator}
    IF    '${actor_role}' == 'owner'
        VAR    ${actor}    ${creator}
    ELSE
        ${actor}=    Add Member With Role    ${creator}    ${ws}    ${actor_role}
    END
    ${target}=    Add Member With Role    ${creator}    ${ws}    ${target_role}
    VAR    &{body}    role=${new_role}
    ${resp}=    Api Call    ${actor}[alias]    PATCH    /workspaces/${ws}/members/${target}[id]    ${expected}    ${body}
    ${now}=    Query Value    select role from memberships where workspace_id = %s and user_id = %s    ${ws}    ${target}[id]
    IF    ${expected} == 200
        Should Be Equal    ${now}    ${new_role}
    ELSE
        Should Be Equal    ${now}    ${target_role}
        Error Code Should Be    ${resp}    forbidden
    END
    ${owners}=    Owner Count In Database    ${ws}
    Should Be True    ${owners} >= 1

Removal Should Give
    [Documentation]    Decision table of ``member-removal.policy`` (``self`` = the actor leaves).
    [Arguments]    ${actor_role}    ${target_role}    ${expected}
    ${creator}=    Register User Via API    own
    ${ws}=    Create Company Workspace Via API    ${creator}
    ${actor}=    Add Member With Role    ${creator}    ${ws}    ${actor_role}
    IF    '${target_role}' == 'self'
        VAR    ${target}    ${actor}
    ELSE
        ${target}=    Add Member With Role    ${creator}    ${ws}    ${target_role}
    END
    ${resp}=    Api Call    ${actor}[alias]    DELETE    /workspaces/${ws}/members/${target}[id]    ${expected}
    ${left}=    Query Value    select count(*) from memberships where workspace_id = %s and user_id = %s    ${ws}    ${target}[id]
    Should Be Equal As Integers    ${left}    ${{ 0 if ${expected} == 204 else 1 }}
    IF    ${expected} == 403
        Error Code Should Be    ${resp}    forbidden
    END

Invite Role Should Give
    [Documentation]    Decision table of ``invitation.policy``: ``${inviter_role}`` invites with ``${invited_role}``.
    [Arguments]    ${inviter_role}    ${invited_role}    ${expected}
    ${creator}=    Register User Via API    own
    ${ws}=    Create Company Workspace Via API    ${creator}
    IF    '${inviter_role}' == 'owner'
        VAR    ${inviter}    ${creator}
    ELSE
        ${inviter}=    Add Member With Role    ${creator}    ${ws}    ${inviter_role}
    END
    ${email}=    Unique Email    inv
    ${resp}=    Invite Via API    ${inviter}    ${ws}    ${email}    ${invited_role}    ${expected}
    ${rows}=    Query Value    select count(*) from invitations where workspace_id = %s and email = %s    ${ws}    ${email}
    Should Be Equal As Integers    ${rows}    ${{ 1 if ${expected} == 201 else 0 }}
    IF    ${expected} == 201
        Should Be Equal    ${resp.json()}[invitation][role]    ${invited_role}
    END
