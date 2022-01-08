import { artifacts, ethers, waffle } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { Vault1 as Vault } from "../../src/types/Vault1";
import type { ERC20Mock } from "../../src/types/ERC20Mock";
import { expect } from "chai";
import { BigNumber } from "ethers";

const { deployContract } = waffle;

const ONE = ethers.constants.One;
const ZERO = ethers.constants.Zero;

describe("Vault1", async () => {
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;

  let vault: Vault;
  let token: ERC20Mock;

  let adminBalance: BigNumber;

  before(async () => {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
  });

  beforeEach(async () => {
    const tokenArtifact = await artifacts.readArtifact("ERC20Mock");
    token = <ERC20Mock>await deployContract(admin, tokenArtifact, ["Test", "TST"]);
    adminBalance = await token.balanceOf(admin.address);

    const vaultArtifact = await artifacts.readArtifact("Vault1");
    vault = <Vault>await deployContract(admin, vaultArtifact, [token.address]);
  });

  describe("with no deposits", async () => {
    it("should not allow withdrawal", async () => {
      await expect(vault.connect(admin).withdraw(ONE)).to.be.revertedWith("amount greater than vault balance");
    });

    it("should not deposit if not enough funds", async () => {
      await expect(vault.connect(admin).deposit(adminBalance.add(ONE))).to.be.revertedWith("not enough token balance");
    });

    it("should deposit if enough funds", async () => {
      await vault.connect(admin).deposit(adminBalance);
      expect(await vault.balances(admin.address)).to.equal(adminBalance);
    });

    describe("with deposits", async () => {
      it("should not allow withdrawal when not enough balance and others have deposited", async () => {
        await expect(vault.connect(user1).withdraw(ONE)).to.be.revertedWith("amount greater than vault balance");
        await expect(vault.connect(admin).withdraw(adminBalance.add(ONE))).to.be.revertedWith(
          "amount greater than vault balance",
        );
      });

      it("should allow withdrawal", async () => {
        // withdraw all admin funds from vault
        expect(vault.connect(admin).withdraw(adminBalance));
        expect(await vault.balances(admin.address)).to.equal(ZERO);
      });
    });
  });
});
