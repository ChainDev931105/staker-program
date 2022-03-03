import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { StakerProgram } from '../target/types/staker_program';
import * as utils from "./utils";

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

  let xtokenMint: Token;
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

    xtokenMint = await utils.createMint(
      provider.connection,
      mintKeypair,
      (provider.wallet as anchor.Wallet).payer,
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
          xtokenMint.publicKey.toBuffer()
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
        xtokenMint: xtokenMint.publicKey,
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
          xtokenMint.publicKey.toBuffer(),
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
      xtokenMint: xtokenMint.publicKey.toBase58(),
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
        xtokenMint: xtokenMint.publicKey,
        userXtokenAccount,
        posMint,
        userPosAccount
      },
      signers: [userAuthority]
    });
    PRINT_LOG && console.log("Your transaction signature", tx);
  });

  it('Stake', async () => {
    await xtokenMint.mintTo(
      userXtokenAccount,
      tokenMintAuthority.publicKey,
      [tokenMintAuthority],
      TEST_AMOUNT
    );
    const tx = await program.rpc.stake({
      amount: new anchor.BN(TEST_AMOUNT)
    }, {
      accounts: {
        tokenProgram: TOKEN_PROGRAM_ID,
        stakeState,
        userAuthority: userAuthority.publicKey,
        xtokenMint: xtokenMint.publicKey,
        userXtokenAccount,
        posMint,
        userPosAccount,
        vault,
        mintAuthority
      },
      signers: [userAuthority]
    });
    PRINT_LOG && console.log("Your transaction signature", tx);
  });

  it('Unstake', async () => {
    const tx = await program.rpc.unstake({
      amount: new anchor.BN(TEST_AMOUNT)
    }, {
      accounts: {
        tokenProgram: TOKEN_PROGRAM_ID,
        stakeState,
        userAuthority: userAuthority.publicKey,
        xtokenMint: xtokenMint.publicKey,
        userXtokenAccount,
        posMint,
        userPosAccount,
        vault,
        vaultAuthority
      },
      signers: [userAuthority]
    });
    PRINT_LOG && console.log("Your transaction signature", tx);
  });
});
