use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod rbac_system {
    use super::*;

    /// Initialize the RBAC system with an admin
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let rbac_state = &mut ctx.accounts.rbac_state;
        rbac_state.admin = ctx.accounts.admin.key();
        rbac_state.bump = ctx.bumps.rbac_state;
        rbac_state.role_count = 0;
        rbac_state.user_count = 0;
        
        // Create admin role automatically
        rbac_state.role_count = 1;
        
        emit!(RbacInitialized {
            admin: ctx.accounts.admin.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Create a new role with specific permissions
    pub fn create_role(
        ctx: Context<CreateRole>,
        role_name: String,
        permissions: Vec<Permission>,
    ) -> Result<()> {
        require!(
            role_name.len() <= 32,
            RbacError::RoleNameTooLong
        );
        
        let role = &mut ctx.accounts.role;
        role.name = role_name;
        role.permissions = permissions;
        role.created_at = Clock::get()?.unix_timestamp;
        role.bump = ctx.bumps.role;
        
        let rbac_state = &mut ctx.accounts.rbac_state;
        rbac_state.role_count += 1;
        
        emit!(RoleCreated {
            name: role.name.clone(),
            permissions: role.permissions.clone(),
            timestamp: role.created_at,
        });
        
        Ok(())
    }

    /// Assign a role to a user
    pub fn assign_role(
        ctx: Context<AssignRole>,
        user: Pubkey,
        role_name: String,
    ) -> Result<()> {
        // Verify role exists
        require!(
            ctx.accounts.role.name == role_name,
            RbacError::RoleNotFound
        );
        
        // Create user role assignment
        let user_role = &mut ctx.accounts.user_role;
        user_role.user = user;
        user_role.role = role_name.clone();
        user_role.assigned_at = Clock::get()?.unix_timestamp;
        user_role.assigned_by = ctx.accounts.authority.key();
        user_role.bump = ctx.bumps.user_role;
        
        let rbac_state = &mut ctx.accounts.rbac_state;
        rbac_state.user_count += 1;
        
        emit!(RoleAssigned {
            user,
            role: role_name,
            assigned_by: ctx.accounts.authority.key(),
            timestamp: user_role.assigned_at,
        });
        
        Ok(())
    }

    /// Check if user has specific permission
    pub fn check_permission(
        ctx: Context<CheckPermission>,
        user: Pubkey,
        permission: Permission,
    ) -> Result<bool> {
        // In a real scenario, this would be called by another program
        // For demo, we just verify and return result
        let user_role = &ctx.accounts.user_role;
        let role = &ctx.accounts.role;
        
        require!(
            user_role.role == role.name,
            RbacError::UserRoleMismatch
        );
        
        let has_permission = role.permissions.contains(&permission);
        
        emit!(PermissionChecked {
            user,
            permission,
            result: has_permission,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(has_permission)
    }

    /// Revoke a role from user
    pub fn revoke_role(
        ctx: Context<RevokeRole>,
        user: Pubkey,
    ) -> Result<()> {
        // Just close the account - role is revoked
        emit!(RoleRevoked {
            user,
            revoked_by: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Execute action with permission check
    pub fn execute_action(
        ctx: Context<ExecuteAction>,
        action: Action,
    ) -> Result<()> {
        // Verify permission first
        let user_role = &ctx.accounts.user_role;
        let role = &ctx.accounts.role;
        
        require!(
            user_role.role == role.name,
            RbacError::UserRoleMismatch
        );
        
        // Map actions to required permissions
        let required_permission = match action {
            Action::CreateResource => Permission::Create,
            Action::ReadResource => Permission::Read,
            Action::UpdateResource => Permission::Update,
            Action::DeleteResource => Permission::Delete,
            Action::AdminOperation => Permission::Admin,
        };
        
        require!(
            role.permissions.contains(&required_permission),
            RbacError::PermissionDenied
        );
        
        emit!(ActionExecuted {
            user: ctx.accounts.user.key(),
            action,
            permission: required_permission,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

/// Initialize the RBAC system
#[derive(Accounts)]
pub struct Initialize<'a> {
    #[account(
        init,
        payer = admin,
        space = 8 + RbacState::SIZE,
        seeds = [b"rbac_state"],
        bump
    )]
    pub rbac_state: Account<'a, RbacState>,
    
    #[account(mut)]
    pub admin: Signer<'a>,
    
    pub system_program: Program<'a, System>,
}

/// Create a new role
#[derive(Accounts)]
#[instruction(role_name: String)]
pub struct CreateRole<'a> {
    #[account(
        mut,
        seeds = [b"rbac_state"],
        bump = rbac_state.bump,
        has_one = admin,
    )]
    pub rbac_state: Account<'a, RbacState>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + Role::SIZE,
        seeds = [b"role", role_name.as_bytes()],
        bump
    )]
    pub role: Account<'a, Role>,
    
    #[account(mut)]
    pub admin: Signer<'a>,
    
    pub system_program: Program<'a, System>,
}

/// Assign role to user
#[derive(Accounts)]
#[instruction(user: Pubkey, role_name: String)]
pub struct AssignRole<'a> {
    #[account(
        mut,
        seeds = [b"rbac_state"],
        bump = rbac_state.bump,
    )]
    pub rbac_state: Account<'a, RbacState>,
    
    #[account(
        seeds = [b"role", role_name.as_bytes()],
        bump = role.bump,
    )]
    pub role: Account<'a, Role>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + UserRole::SIZE,
        seeds = [b"user_role", user.as_ref()],
        bump
    )]
    pub user_role: Account<'a, UserRole>,
    
    #[account(mut)]
    pub authority: Signer<'a>,
    
    pub system_program: Program<'a, System>,
}

/// Check permission
#[derive(Accounts)]
pub struct CheckPermission<'a> {
    #[account(
        seeds = [b"role", user_role.role.as_bytes()],
        bump = role.bump,
    )]
    pub role: Account<'a, Role>,
    
    #[account(
        seeds = [b"user_role", user_role.user.as_ref()],
        bump = user_role.bump,
    )]
    pub user_role: Account<'a, UserRole>,
}

/// Revoke role from user
#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct RevokeRole<'a> {
    #[account(
        mut,
        seeds = [b"user_role", user.as_ref()],
        bump = user_role.bump,
        close = authority,
    )]
    pub user_role: Account<'a, UserRole>,
    
    #[account(mut)]
    pub authority: Signer<'a>,
}

/// Execute action with permission check
#[derive(Accounts)]
pub struct ExecuteAction<'a> {
    #[account(
        seeds = [b"rbac_state"],
        bump = rbac_state.bump,
    )]
    pub rbac_state: Account<'a, RbacState>,
    
    #[account(
        seeds = [b"role", user_role.role.as_bytes()],
        bump = role.bump,
    )]
    pub role: Account<'a, Role>,
    
    #[account(
        seeds = [b"user_role", user.key().as_ref()],
        bump = user_role.bump,
    )]
    pub user_role: Account<'a, UserRole>,
    
    #[account(mut)]
    pub user: Signer<'a>,
}

/// RBAC State - tracks system configuration
#[account]
#[derive(Default)]
pub struct RbacState {
    pub admin: Pubkey,          // System admin
    pub role_count: u32,        // Number of roles created
    pub user_count: u32,        // Number of users with roles
    pub bump: u8,               // PDA bump
}

impl RbacState {
    pub const SIZE: usize = 32 + 4 + 4 + 1 + 64; // +64 for safety
}

/// Role definition with permissions
#[account]
pub struct Role {
    pub name: String,                // Role name (max 32 chars)
    pub permissions: Vec<Permission>, // List of permissions
    pub created_at: i64,             // Creation timestamp
    pub bump: u8,                    // PDA bump
}

impl Role {
    pub const SIZE: usize = 4 + 32 + 4 + (5 * 1) + 8 + 1 + 128; // +128 for Vec overhead
}

/// User-Role assignment
#[account]
pub struct UserRole {
    pub user: Pubkey,          // User public key
    pub role: String,          // Assigned role name
    pub assigned_at: i64,      // Assignment timestamp
    pub assigned_by: Pubkey,   // Who assigned the role
    pub bump: u8,              // PDA bump
}

impl UserRole {
    pub const SIZE: usize = 32 + 4 + 32 + 8 + 32 + 1 + 64; // +64 for safety
}

/// Permissions enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum Permission {
    Read,    // Can read resources
    Create,  // Can create resources
    Update,  // Can update resources
    Delete,  // Can delete resources
    Admin,   // Can perform admin operations
}

/// Actions that require permissions
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum Action {
    CreateResource,
    ReadResource,
    UpdateResource,
    DeleteResource,
    AdminOperation,
}

/// Custom errors
#[error_code]
pub enum RbacError {
    #[msg("Role name exceeds maximum length of 32 characters")]
    RoleNameTooLong,
    #[msg("Role not found")]
    RoleNotFound,
    #[msg("User role assignment does not match")]
    UserRoleMismatch,
    #[msg("Permission denied")]
    PermissionDenied,
    #[msg("Only admin can perform this action")]
    NotAuthorized,
}

// Events
#[event]
pub struct RbacInitialized {
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RoleCreated {
    pub name: String,
    pub permissions: Vec<Permission>,
    pub timestamp: i64,
}

#[event]
pub struct RoleAssigned {
    pub user: Pubkey,
    pub role: String,
    pub assigned_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PermissionChecked {
    pub user: Pubkey,
    pub permission: Permission,
    pub result: bool,
    pub timestamp: i64,
}

#[event]
pub struct RoleRevoked {
    pub user: Pubkey,
    pub revoked_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ActionExecuted {
    pub user: Pubkey,
    pub action: Action,
    pub permission: Permission,
    pub timestamp: i64,
}