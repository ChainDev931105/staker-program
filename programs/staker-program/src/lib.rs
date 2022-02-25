use anchor_lang::prelude::*;

declare_id!("J9bPtWZgaybEF9emecXXQfXpEBAcKHQpfZ41B9d4iEvX");

#[program]
pub mod staker_program {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> ProgramResult {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
