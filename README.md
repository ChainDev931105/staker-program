# staker-program


## Introduction


### Run Solana Validator


### Install
```bash
yarn install
```

### Test
First, build program.
```bash
anchor build
```
Second, get correct `programId`
```bash
solana address -k ./target/deploy/staker_program-keypair.json
```
Third, replace `programsId`s in `/Anchor.toml` and `/programs/staker-program/src/lib.rs` with above one.

Finally, run test. (you can skip above steps once you did them.)

```bash
yarn test:all
```


