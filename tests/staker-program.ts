import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { createMint, mintTo } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { StakerProgram } from '../target/types/staker_program';
// import * as utils from "./utils";

const PRINT_LOG: boolean = false;

const POS_MINT_SEED: string = "pos-token";
const STAKE_STATE_SEED: string = "stake-state";
const VAULT_SEED: string = "vault";
const VAULT_AUTH_SEED: string = "vault-auth";
const MINT_AUTH_SEED: string = "mint-auth";

const TEST_AMOUNT = 1_000_000_000;

describe('staker-program', () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.StakerProgram as Program<StakerProgram>;
  const admin = Keypair.generate();
  const userAuthority = Keypair.generate();
  const tokenMintAuthority = Keypair.generate();
  const mintKeypair = Keypair.generate();

  let xtokenMint: PublicKey;
  let vault: PublicKey;
  let vaultAuthority: PublicKey;
  let stakeState: PublicKey;
  let mintAuthority: PublicKey;
  let posMint: PublicKey;
  let userXtokenAccount: PublicKey;
  let userPosAccount: PublicKey;

  PRINT_LOG && console.log({
    admin: admin.publicKey.toBase58(),
    userAuthority: userAuthority.publicKey.toBase58()
  });

  it('Initialized!', async () => {
    await program.provider.connection.confirmTransaction(
      await program.provider.connection.requestAirdrop(
        admin.publicKey,
        10000000000
      ),
      "confirmed"
    );

    xtokenMint = await createMint(
      provider.connection,
      admin,
      tokenMintAuthority.publicKey,
      tokenMintAuthority.publicKey,
      9
    );

    let [_vaultAuthority, vaultAuthNonce] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode(VAULT_AUTH_SEED))],
        program.programId
      );
    vaultAuthority = _vaultAuthority;
    let [_stakeState, stakeStateNonce] = 
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode(STAKE_STATE_SEED)),
          xtokenMint.toBuffer()
        ],
        program.programId
      );
    stakeState = _stakeState;
    let [_vault, vaultNonce] = 
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode(VAULT_SEED)),
          stakeState.toBuffer()
        ],
        program.programId
      );
    vault = _vault;
    let [_mintAuthority, mintAuthNonce] = 
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode(MINT_AUTH_SEED))],
        program.programId
      );
    mintAuthority = _mintAuthority;
    let [_posMint, posMintNonce] = 
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(anchor.utils.bytes.utf8.encode(POS_MINT_SEED)),
          stakeState.toBuffer()
        ],
        program.programId
      );
    posMint = _posMint;

    const tx = await program.rpc.initialize({
      posMintNonce,
      stakeStateNonce,
      vaultAuthNonce,
      vaultNonce,
      mintAuthNonce
    }, {
      accounts: {
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        xtokenMint: xtokenMint,
        mintAuthority,
        posMint,
        stakeState,
        vaultAuthority,
        vault
      },
      signers: [admin]
    });
    PRINT_LOG && console.log("Your transaction signature", tx);
  });

  it('Register staking', async () => {
    await program.provider.connection.confirmTransaction(
      await program.provider.connection.requestAirdrop(
        userAuthority.publicKey,
        10000000000
      ),
      "confirmed"
    );
    await program.provider.connection.confirmTransaction(
      await program.provider.connection.requestAirdrop(
        mintAuthority,
        10000000000
      ),
      "confirmed"
    );
    let [_userXtokenAccount, userXtokenAccountNonce] = 
      await anchor.web3.PublicKey.findProgramAddress(
        [
          xtokenMint.toBuffer(),
          userAuthority.publicKey.toBuffer()
        ],
        program.programId
      );
    userXtokenAccount = _userXtokenAccount;
    let [_userPosAccount, userPosAccountNonce] = 
      await anchor.web3.PublicKey.findProgramAddress(
        [
          posMint.toBuffer(),
          userAuthority.publicKey.toBuffer()
        ],
        program.programId
      );
    userPosAccount = _userPosAccount;

    PRINT_LOG && console.log({
      xtokenMint: xtokenMint.toBase58(),
      userXtokenAccount: userXtokenAccount.toBase58(),
      userPosAccount: userPosAccount.toBase58(),
      vault: vault.toBase58(),
      posMint: posMint.toBase58(),
      mintAuthority: mintAuthority.toBase58(),
      stakeState: stakeState.toBase58()
    });

    const tx = await program.rpc.registerStake({
      userXtokenAccountNonce,
      userPosAccountNonce
    }, {
      accounts: {
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        stakeState,
        userAuthority: userAuthority.publicKey,
        xtokenMint: xtokenMint,
        userXtokenAccount,
        posMint,
        userPosAccount
      },
      signers: [userAuthority]
    });
    PRINT_LOG && console.log("Your transaction signature", tx);
  });

  it('Stake', async () => {
    await mintTo(
      provider.connection,
      admin,
      xtokenMint,
      userXtokenAccount,
      tokenMintAuthority,
      TEST_AMOUNT
    );

    const balanceXtokenBefore = parseInt((await provider.connection.getTokenAccountBalance(userXtokenAccount)).value.amount);
    const balancePosBefore = parseInt((await provider.connection.getTokenAccountBalance(userPosAccount)).value.amount);

    const tx = await program.rpc.stake({
      amount: new anchor.BN(TEST_AMOUNT)
    }, {
      accounts: {
        tokenProgram: TOKEN_PROGRAM_ID,
        stakeState,
        userAuthority: userAuthority.publicKey,
        xtokenMint: xtokenMint,
        userXtokenAccount,
        posMint,
        userPosAccount,
        vault,
        mintAuthority
      },
      signers: [userAuthority]
    });
    const balanceXtokenAfter = parseInt((await provider.connection.getTokenAccountBalance(userXtokenAccount)).value.amount);
    const balancePosAfter = parseInt((await provider.connection.getTokenAccountBalance(userPosAccount)).value.amount);
    console.log({ balanceXtokenBefore, balancePosBefore, balanceXtokenAfter, balancePosAfter });
    PRINT_LOG && console.log("Your transaction signature", tx);

    expect(balanceXtokenBefore - balanceXtokenAfter).to.equal(TEST_AMOUNT);
    expect(balancePosAfter - balancePosBefore).to.equal(TEST_AMOUNT);
  });

  it('Unstake', async () => {
    const balanceXtokenBefore = parseInt((await provider.connection.getTokenAccountBalance(userXtokenAccount)).value.amount);
    const balancePosBefore = parseInt((await provider.connection.getTokenAccountBalance(userPosAccount)).value.amount);
    const tx = await program.rpc.unstake({
      amount: new anchor.BN(TEST_AMOUNT)
    }, {
      accounts: {
        tokenProgram: TOKEN_PROGRAM_ID,
        stakeState,
        userAuthority: userAuthority.publicKey,
        xtokenMint: xtokenMint,
        userXtokenAccount,
        posMint,
        userPosAccount,
        vault,
        vaultAuthority
      },
      signers: [userAuthority]
    });
    const balanceXtokenAfter = parseInt((await provider.connection.getTokenAccountBalance(userXtokenAccount)).value.amount);
    const balancePosAfter = parseInt((await provider.connection.getTokenAccountBalance(userPosAccount)).value.amount);
    console.log({ balanceXtokenBefore, balancePosBefore, balanceXtokenAfter, balancePosAfter });
    PRINT_LOG && console.log("Your transaction signature", tx);

    expect(balanceXtokenAfter - balanceXtokenBefore).to.equal(TEST_AMOUNT);
    expect(balancePosBefore - balancePosAfter).to.equal(TEST_AMOUNT);
  });
});
