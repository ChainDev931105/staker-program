import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { StakerProgram } from '../target/types/staker_program';

describe('staker-program', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.StakerProgram as Program<StakerProgram>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
