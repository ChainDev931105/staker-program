use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Burn, Mint, MintTo, Token, Transfer};

declare_id!("J9bPtWZgaybEF9emecXXQfXpEBAcKHQpfZ41B9d4iEvX");

pub const POS_MINT_SEED: &str = "pos-token";
pub const STAKE_STATE_SEED: &str = "stake-state";
pub const VAULT_SEED: &str = "vault";
pub const VAULT_AUTH_SEED: &str = "vault-auth";
pub const MINT_AUTH_SEED: &str = "mint-auth";

#[program]
pub mod staker_program {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> ProgramResult {
        ctx.accounts.stake_state.xtoken_mint = ctx.accounts.xtoken_mint.key();
        ctx.accounts.stake_state.pos_mint = ctx.accounts.pos_mint.key();
        ctx.accounts.stake_state.stake_state_nonce = args.stake_state_nonce;
        ctx.accounts.stake_state.vault_nonce = args.vault_nonce;
        ctx.accounts.stake_state.mint_auth_nonce = args.mint_auth_nonce;
        ctx.accounts.stake_state.vault_auth_nonce = args.vault_auth_nonce;
        Ok(())
    }

    pub fn register_stake(ctx: Context<RegisterStake>) -> ProgramResult {
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, args: StakeArgs) -> ProgramResult {
        let mint_seeds = mint_authority! {
            bump = ctx.accounts.stake_state.mint_auth_nonce
        };

        token::mint_to(
            ctx.accounts
                .into_mint_to_context()
                .with_signer(&[&mint_seeds[..]]),
            args.amount,
        )?;

        token::transfer(ctx.accounts.into_transfer_context(), args.amount)?;

        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>, args: UnstakeArgs) -> ProgramResult {
        let mint_seeds = mint_authority! {
            bump = ctx.accounts.stake_state.mint_auth_nonce
        };
        let vault_seeds = vault_authority! {
            bump = ctx.accounts.stake_state.vault_auth_nonce
        };

        token::transfer(
            ctx.accounts
                .into_transfer_context()
                .with_signer(&[&vault_seeds[..]]),
            args.amount,
        )?;

        token::burn(
            ctx.accounts.into_burn_context(),
            args.amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(args: InitializeArgs)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub xtoken_mint: Account<'info, Mint>,
    #[account(
        seeds = [MINT_AUTH_SEED.as_bytes().as_ref()],
        bump = args.mint_auth_nonce,
    )]
    pub mint_authority: AccountInfo<'info>,
    #[account(
        init,
        mint::decimals = xtoken_mint.decimals,
        mint::authority = mint_authority,
        seeds = [POS_MINT_SEED.as_bytes().as_ref(), stake_state.key().as_ref()],
        bump = args.pos_mint_nonce,
        payer = admin,
    )]
    pub pos_mint: Account<'info, Mint>,
    #[account(
        init,
        seeds = [STAKE_STATE_SEED.as_bytes().as_ref(), xtoken_mint.key().as_ref()],
        bump = args.stake_state_nonce,
        payer = admin,
    )]
    pub stake_state: Box<Account<'info, StakeState>>,
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes().as_ref()],
        bump = args.vault_auth_nonce,
    )]
    pub vault_authority: AccountInfo<'info>,
    #[account(
        init,
        token::mint = xtoken_mint,
        token::authority = vault_authority,
        seeds = [VAULT_SEED.as_bytes().as_ref(), stake_state.key().as_ref()],
        bump = args.vault_nonce,
        payer = admin,
    )]
    pub vault: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct RegisterStake<'info> {
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    #[account(
        mut,
        seeds = [STAKE_STATE_SEED.as_bytes().as_ref(), stake_state.xtoken_mint.as_ref()],
        bump = stake_state.stake_state_nonce,
    )]
    pub stake_state: Account<'info, StakeState>,
    #[account(mut)]
    pub user_authority: Signer<'info>,
    #[account(
        constraint = xtoken_mint.key() == stake_state.xtoken_mint @ ErrorCode::XtokenMintMismatch,
    )]
    pub xtoken_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        token::mint = xtoken_mint,
        token::authority = user_authority,
        payer = user_authority,
    )]
    pub user_xtoken_account: Account<'info, TokenAccount>,
    #[account( 
        constraint = pos_mint.key() == stake_state.pos_mint @ ErrorCode::PosMintMismatch,
    )]
    pub pos_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        token::mint = pos_mint,
        token::authority = user_authority,
        payer = user_authority,
    )]
    pub user_pos_account: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
#[instruction(args: StakeArgs)]
pub struct Stake<'info> {
    pub token_program: Program<'info, Token>,
    #[account(
        mut,
        seeds = [STAKE_STATE_SEED.as_bytes().as_ref(), stake_state.xtoken_mint.as_ref()],
        bump = stake_state.stake_state_nonce,
    )]
    pub stake_state: Account<'info, StakeState>,
    #[account(mut)]
    pub user_authority: Signer<'info>,
    #[account(
        constraint = xtoken_mint.key() == stake_state.xtoken_mint @ ErrorCode::XtokenMintMismatch,
    )]
    pub xtoken_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = user_xtoken_account.owner == user_authority.key() @ ErrorCode::XtokenOwnerMismatch,
        constraint = user_xtoken_account.mint == xtoken_mint.key() @ ErrorCode::XtokenMintMismatch,
        constraint = user_xtoken_account.amount >= args.amount @ ErrorCode::InsufficientFunds,
    )]
    pub user_xtoken_account: Account<'info, TokenAccount>,
    #[account(
        constraint = pos_mint.key() == stake_state.pos_mint @ ErrorCode::PosMintMismatch,
    )]
    pub pos_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = user_pos_account.owner == user_authority.key() @ ErrorCode::PosOwnerMismatch,
        constraint = user_pos_account.mint == pos_mint.key() @ ErrorCode::PosMintMismatch,
    )]
    pub user_pos_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [VAULT_SEED.as_bytes().as_ref(), stake_state.key().as_ref()],
        bump = stake_state.vault_nonce,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [MINT_AUTH_SEED.as_bytes().as_ref()],
        bump = stake_state.mint_auth_nonce,
    )]
    pub mint_authority: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(args: UnstakeArgs)]
pub struct Unstake<'info> {
    pub token_program: Program<'info, Token>,
    #[account(
        mut,
        seeds = [STAKE_STATE_SEED.as_bytes().as_ref(), stake_state.xtoken_mint.as_ref()],
        bump = stake_state.stake_state_nonce,
    )]
    pub stake_state: Account<'info, StakeState>,
    #[account(mut)]
    pub user_authority: Signer<'info>,
    #[account(
        constraint = xtoken_mint.key() == stake_state.xtoken_mint @ ErrorCode::XtokenMintMismatch,
    )]
    pub xtoken_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = user_xtoken_account.owner == user_authority.key() @ ErrorCode::XtokenOwnerMismatch,
        constraint = user_xtoken_account.mint == xtoken_mint.key() @ ErrorCode::XtokenMintMismatch,
    )]
    pub user_xtoken_account: Account<'info, TokenAccount>,
    #[account(
        constraint = pos_mint.key() == stake_state.pos_mint @ ErrorCode::PosMintMismatch,
    )]
    pub pos_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = user_pos_account.owner == user_authority.key() @ ErrorCode::PosOwnerMismatch,
        constraint = user_pos_account.mint == pos_mint.key() @ ErrorCode::PosMintMismatch,
        constraint = user_pos_account.amount >= args.amount @ ErrorCode::InsufficientStakeAmount,
    )]
    pub user_pos_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [VAULT_SEED.as_bytes().as_ref(), stake_state.key().as_ref()],
        bump = stake_state.vault_nonce,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes().as_ref()],
        bump = stake_state.vault_auth_nonce,
    )]
    pub vault_authority: AccountInfo<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeArgs {
    pub pos_mint_nonce: u8,
    pub stake_state_nonce: u8,
    pub vault_auth_nonce: u8,
    pub vault_nonce: u8,
    pub mint_auth_nonce: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct StakeArgs {
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UnstakeArgs {
    pub amount: u64,
}

impl<'info> Stake<'info> {
    pub fn into_mint_to_context(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: self.pos_mint.to_account_info().clone(),
            to: self.user_pos_account.to_account_info().clone(),
            authority: self.mint_authority.clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }

    pub fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.user_xtoken_account.to_account_info().clone(),
            to: self.vault.to_account_info(),
            authority: self.user_authority.to_account_info().clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }
}

impl<'info> Unstake<'info> {
    pub fn into_burn_context(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_accounts = Burn {
            mint: self.pos_mint.to_account_info().clone(),
            to: self.user_pos_account.to_account_info().clone(),
            authority: self.user_authority.to_account_info().clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }

    pub fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.user_xtoken_account.to_account_info().clone(),
            to: self.vault.to_account_info(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }
}

#[macro_export]
macro_rules! mint_authority {
    (bump = $bump:expr) => {
        &[MINT_AUTH_SEED.as_bytes().as_ref(), &[$bump]]
    };
}

#[macro_export]
macro_rules! vault_authority {
    (bump = $bump:expr) => {
        &[VAULT_AUTH_SEED.as_bytes().as_ref(), &[$bump]]
    };
}

#[account]
#[derive(Default)]
pub struct StakeState {
    pub xtoken_mint: Pubkey,
    pub pos_mint: Pubkey,

    pub stake_state_nonce: u8,
    pub vault_nonce: u8,
    pub mint_auth_nonce: u8,
    pub vault_auth_nonce: u8,
}

#[error]
pub enum ErrorCode {
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Insufficient stake amount")]
    InsufficientStakeAmount,
    #[msg("Token Account doesn't match")]
    TokenAccountMismatch,
    #[msg("Invalid token account owner")]
    InvalidTokenAccountOwner,
    #[msg("XToken Owner mismatch")]
    XtokenOwnerMismatch,
    #[msg("XToken Mint mismatch")]
    XtokenMintMismatch,
    #[msg("Pos Owner mismatch")]
    PosOwnerMismatch,
    #[msg("Pos Mint mismatch")]
    PosMintMismatch,
}
