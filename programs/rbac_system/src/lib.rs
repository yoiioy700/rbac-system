use anchor_lang::prelude::*;

declare_id!("826VeESV6R1DQnt5dELnGHx7j3xewoCRYX3nN4gJ9p2T");

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
        
        // Let user manually create admin role. The initial creator is already stored as admin.
        emit!(RbacInitialized {
            admin: ctx.accounts.admin.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    /// Create a new role with specific bitmask permissions
    pub fn create_role(
        ctx: Context<CreateRole>,
        role_name: String,
        permissions: u32,
    ) -> Result<()> {
        require!(
            role_name.len() <= 32,
            RbacError::RoleNameTooLong
        );
        require!(
            ctx.accounts.rbac_state.admin == ctx.accounts.admin.key(),
            RbacError::NotAuthorized
        );
        
        let role = &mut ctx.accounts.role;
        role.name = role_name.clone();
        role.permissions = permissions;
        role.created_at = Clock::get()?.unix_timestamp;
        role.bump = ctx.bumps.role;
        
        let rbac_state = &mut ctx.accounts.rbac_state;
        rbac_state.role_count += 1;
        
        emit!(RoleCreated {
            name: role_name,
            permissions,
            timestamp: role.created_at,
        });
        
        Ok(())
    }

    /// Assign a role to a user. Supports multi-role per user via PDA structure and Time-bound expiry.
    pub fn assign_role(
        ctx: Context<AssignRole>,
        user: Pubkey,
        role_name: String,
        expires_at: Option<i64>,
    ) -> Result<()> {
        // Only admin can assign
        require!(
            ctx.accounts.rbac_state.admin == ctx.accounts.authority.key(),
            RbacError::NotAuthorized
        );
        // Verify target role exists
        require!(
            ctx.accounts.role.name == role_name,
            RbacError::RoleNotFound
        );
        
        // Create or update user role assignment
        let user_role = &mut ctx.accounts.user_role;
        user_role.user = user;
        user_role.role = role_name.clone();
        user_role.assigned_at = Clock::get()?.unix_timestamp;
        user_role.expires_at = expires_at;
        user_role.assigned_by = ctx.accounts.authority.key();
        user_role.bump = ctx.bumps.user_role;
        
        // Don't increment user_count here multiple times if they just get more roles, 
        // to be strictly correct we would need a separate User struct, but for now we keep it simple.
        ctx.accounts.rbac_state.user_count += 1;
        
        emit!(RoleAssigned {
            user,
            role: role_name,
            assigned_by: ctx.accounts.authority.key(),
            expires_at,
            timestamp: user_role.assigned_at,
        });
        
        Ok(())
    }

    /// Check if user has specific permission (optimized for CPI).
    /// Used natively by other programs.
    pub fn check_permission(
        ctx: Context<CheckPermission>,
        required_permission: u32,
    ) -> Result<bool> {
        let user_role = &ctx.accounts.user_role;
        let role = &ctx.accounts.role;
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(
            user_role.role == role.name,
            RbacError::UserRoleMismatch
        );

        // Validation 1: Check time expiry bounds
        if let Some(expiry) = user_role.expires_at {
            if current_time >= expiry {
                emit!(PermissionChecked {
                    user: user_role.user,
                    permission_checked: required_permission,
                    result: false,
                    reason: "Expired Role".to_string(),
                    timestamp: current_time,
                });
                return Ok(false);
            }
        }
        
        // Validation 2: Bitwise Permissions mask check
        // Check if role has the requested bits 
        let has_permission = (role.permissions & required_permission) == required_permission;
        
        emit!(PermissionChecked {
            user: user_role.user,
            permission_checked: required_permission,
            result: has_permission,
            reason: if has_permission { "Allowed".to_string() } else { "Insufficient Bitmask".to_string() },
            timestamp: current_time,
        });
        
        Ok(has_permission)
    }

    /// Direct CPI verification that halts execution if it fails.
    pub fn assert_has_permission(
        ctx: Context<CheckPermission>,
        required_permission: u32,
    ) -> Result<()> {
        let user_role = &ctx.accounts.user_role;
        let role = &ctx.accounts.role;
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(
            user_role.role == role.name,
            RbacError::UserRoleMismatch
        );

        if let Some(expiry) = user_role.expires_at {
            require!(current_time < expiry, RbacError::PermissionDenied);
        }
        
        let has_permission = (role.permissions & required_permission) == required_permission;
        require!(has_permission, RbacError::PermissionDenied);
        
        Ok(())
    }

    /// Revoke a role from user by closing the PDA 
    pub fn revoke_role(
        ctx: Context<RevokeRole>,
        _role_name: String, // Kept to align with Instruction derivation
    ) -> Result<()> {
        // Only admin can revoke
        require!(
            ctx.accounts.rbac_state.admin == ctx.accounts.authority.key(),
            RbacError::NotAuthorized
        );

        emit!(RoleRevoked {
            user: ctx.accounts.user_role.user,
            revoked_by: ctx.accounts.authority.key(),
            role_revoked: ctx.accounts.user_role.role.clone(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        // Anchor automatically returns the rent to `authority` because of `close = authority`
        Ok(())
    }
}

/// ============ INSTRUCTIONS ============

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + RbacState::SIZE,
        seeds = [b"rbac_state"],
        bump
    )]
    pub rbac_state: Account<'info, RbacState>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(role_name: String, permissions: u32)]
pub struct CreateRole<'info> {
    #[account(
        mut,
        seeds = [b"rbac_state"],
        bump = rbac_state.bump,
    )]
    pub rbac_state: Account<'info, RbacState>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + Role::SIZE,
        seeds = [b"role", role_name.as_bytes()],
        bump
    )]
    pub role: Account<'info, Role>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(user: Pubkey, role_name: String)]
pub struct AssignRole<'info> {
    #[account(
        mut,
        seeds = [b"rbac_state"],
        bump = rbac_state.bump,
    )]
    pub rbac_state: Account<'info, RbacState>,
    
    #[account(
        seeds = [b"role", role_name.as_bytes()],
        bump = role.bump,
    )]
    pub role: Account<'info, Role>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + UserRole::SIZE,
        seeds = [b"user_role", user.as_ref(), role_name.as_bytes()],
        bump
    )]
    pub user_role: Account<'info, UserRole>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckPermission<'info> {
    #[account(
        seeds = [b"role", user_role.role.as_bytes()],
        bump = role.bump,
    )]
    pub role: Account<'info, Role>,
    
    #[account(
        seeds = [b"user_role", user_role.user.as_ref(), user_role.role.as_bytes()],
        bump = user_role.bump,
    )]
    pub user_role: Account<'info, UserRole>,
}

#[derive(Accounts)]
#[instruction(role_name: String)]
pub struct RevokeRole<'info> {
    #[account(
        mut,
        seeds = [b"rbac_state"],
        bump = rbac_state.bump,
    )]
    pub rbac_state: Account<'info, RbacState>,

    #[account(
        mut,
        seeds = [b"user_role", user_role.user.as_ref(), role_name.as_bytes()],
        bump = user_role.bump,
        close = authority,
    )]
    pub user_role: Account<'info, UserRole>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}


/// ============ STATE ACCOUNTS ============

/// Global RBAC Configuration
#[account]
pub struct RbacState {
    pub admin: Pubkey,          // Master admin
    pub role_count: u32,        // System analytics
    pub user_count: u32,        // System analytics
    pub bump: u8,               
}
impl RbacState {
    pub const SIZE: usize = 32 + 4 + 4 + 1; 
}

/// On-chain Role Data
#[account]
pub struct Role {
    pub name: String,                // Limited to 32 chars
    pub permissions: u32,            // Bitmask. E.g: 0b0001 = read, 0b0010 = create
    pub created_at: i64,             
    pub bump: u8,                    
}
impl Role {
    // 4 for Prefix + 32 String + 4 (u32) + 8 (i64) + 1 (u8)
    pub const SIZE: usize = 4 + 32 + 4 + 8 + 1; 
}

/// Maps User to Role 
#[account]
pub struct UserRole {
    pub user: Pubkey,          
    pub role: String,          
    pub assigned_at: i64,      
    pub expires_at: Option<i64>, // Time bound constraint. Nullable.
    pub assigned_by: Pubkey,   
    pub bump: u8,              
}
impl UserRole {
    // 32 + (4+32 string) + 8 + 9 (Option<i64>) + 32 + 1 
    pub const SIZE: usize = 32 + 36 + 8 + 9 + 32 + 1; 
}

/// ============ ERROR CODES ============

#[error_code]
pub enum RbacError {
    #[msg("Role name exceeds maximum length of 32 characters")]
    RoleNameTooLong,
    #[msg("Role not found from the provided PDA")]
    RoleNotFound,
    #[msg("User role PDA does not match expected Role")]
    UserRoleMismatch,
    #[msg("User does not have required permissions or role expired")]
    PermissionDenied,
    #[msg("Only the admin can perform this configuration action")]
    NotAuthorized,
}

/// ============ EVENTS ============

#[event]
pub struct RbacInitialized {
    pub admin: Pubkey,
    pub timestamp: i64,
}
#[event]
pub struct RoleCreated {
    pub name: String,
    pub permissions: u32,
    pub timestamp: i64,
}
#[event]
pub struct RoleAssigned {
    pub user: Pubkey,
    pub role: String,
    pub assigned_by: Pubkey,
    pub expires_at: Option<i64>,
    pub timestamp: i64,
}
#[event]
pub struct RoleRevoked {
    pub user: Pubkey,
    pub role_revoked: String,
    pub revoked_by: Pubkey,
    pub timestamp: i64,
}
#[event]
pub struct PermissionChecked {
    pub user: Pubkey,
    pub permission_checked: u32,
    pub result: bool,
    pub reason: String,
    pub timestamp: i64,
}