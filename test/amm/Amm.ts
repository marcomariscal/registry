import { artifacts, ethers, waffle } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import type { Amm } from "../../src/types/Amm";
import type { ERC20Mock } from "../../src/types/ERC20Mock";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { formatEther } from "ethers/lib/utils";

const { deployContract } = waffle;
const { parseEther } = utils;

const ONE = ethers.constants.One;
const WAD = ethers.constants.WeiPerEther;

describe("Amm", async () => {
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;

  let Amm: Amm;
  let xToken: ERC20Mock;
  let yToken: ERC20Mock;

  let adminBalanceX: BigNumber;
  let adminBalanceY: BigNumber;
  let user1BalanceX: BigNumber;
  let user1BalanceY: BigNumber;

  let adminAmm: Amm;
  let adminXToken: ERC20Mock;
  let adminYToken: ERC20Mock;

  before(async () => {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];

    const tokenArtifact = await artifacts.readArtifact("ERC20Mock");
    xToken = <ERC20Mock>await deployContract(admin, tokenArtifact, ["xToken", "XTST"]);
    yToken = <ERC20Mock>await deployContract(admin, tokenArtifact, ["yToken", "YTST"]);

    // mint 100 XTST and 100 YTST to admin
    await xToken.mint(admin.address, ethers.utils.parseUnits("100"));
    await yToken.mint(admin.address, ethers.utils.parseUnits("100"));

    adminBalanceX = await xToken.balanceOf(admin.address);
    adminBalanceY = await yToken.balanceOf(admin.address);

    const ammArtifact = await artifacts.readArtifact("Amm");
    Amm = <Amm>await deployContract(admin, ammArtifact, [xToken.address, yToken.address]);

    // initializes contracts with signers
    adminXToken = xToken.connect(admin);
    adminYToken = yToken.connect(admin);
    adminAmm = Amm.connect(admin);
  });

  describe("with no liquidity", async () => {
    it("should not allow swaps", async () => {
      await expect(Amm.connect(admin).sellX(ONE)).to.be.revertedWith("not enough y reserves");
      await expect(Amm.connect(admin).sellY(ONE)).to.be.revertedWith("not enough x reserves");
    });

    it("should initialize amm", async () => {
      const x = parseEther("10");
      const y = parseEther("10");
      const k = x.mul(y).div(WAD);
      const args = [admin.address, x, y, k];

      await adminXToken.approve(adminAmm.address, x);
      await adminYToken.approve(adminAmm.address, y);

      await expect(adminAmm.init(x, y))
        .to.emit(adminAmm, "Liquidity")
        .withArgs(...args);

      expect(await adminAmm.balanceOf(admin.address)).to.eq(k);
      expect(await adminAmm.xReserves()).to.eq(x);
      expect(await adminAmm.yReserves()).to.eq(y);
    });

    it("should not allow initialize after already init", async () => {
      const x = parseEther("10");
      const y = parseEther("10");

      await expect(adminAmm.init(x, y)).to.be.revertedWith("pool already initialized");
    });

    describe("with liquidity", async () => {
      it("should not mint amm tokens when x and y have different amounts", async () => {
        const x = parseEther("1");
        const y = parseEther("1.5");

        await expect(adminAmm.mint(x, y)).to.be.revertedWith("reserve ratios need to stay the same");
      });

      it("should mint amm tokens", async () => {
        const x = parseEther("1");
        const y = parseEther("1");

        const [xTokensBefore, yTokensBefore, xReserves, ammTokensBefore, totalSupply] = await Promise.all([
          adminXToken.balanceOf(admin.address),
          adminYToken.balanceOf(admin.address),
          adminAmm.xReserves(),
          adminAmm.balanceOf(admin.address),
          adminAmm.totalSupply(),
        ]);

        const shouldHaveMinted = x.mul(totalSupply).div(xReserves);

        await adminXToken.approve(adminAmm.address, x);
        await adminYToken.approve(adminAmm.address, y);

        // check minted token event
        await expect(adminAmm.mint(x, y))
          .to.emit(adminAmm, "Liquidity")
          .withArgs(admin.address, x, y, shouldHaveMinted);

        const [xTokensAfter, yTokensAfter, ammTokensAfter] = await Promise.all([
          adminXToken.balanceOf(admin.address),
          adminYToken.balanceOf(admin.address),
          adminAmm.balanceOf(admin.address),
        ]);

        // check account token balances
        expect(ammTokensAfter.sub(ammTokensBefore)).to.eq(shouldHaveMinted);
        expect(xTokensBefore.sub(xTokensAfter)).to.eq(x);
        expect(yTokensBefore.sub(yTokensAfter)).to.eq(y);
      });

      it("should burn amm tokens", async () => {
        const amount = parseEther("1");

        const ammTokensBefore = await adminAmm.balanceOf(admin.address);

        // calculate how many x and y tokens should be received
        const [totalSupply, xReserves, yReserves] = await Promise.all([
          adminAmm.totalSupply(),
          adminAmm.xReserves(),
          adminAmm.yReserves(),
        ]);

        const ratio = xReserves.div(totalSupply);

        const xToReceive = xReserves.mul(ratio);
        const yToReceive = yReserves.mul(ratio);

        await adminAmm.approve(adminAmm.address, amount);

        // check minted token event
        await expect(adminAmm.burn(amount))
          .to.emit(adminAmm, "Burn")
          .withArgs(admin.address, amount, xToReceive, yToReceive);

        const ammTokensAfter = await adminAmm.balanceOf(admin.address);
        expect(ammTokensBefore.sub(ammTokensAfter)).to.eq(amount);
      });

      it("should sell x", async () => {
        const x = parseEther("1");

        // balances before
        const xBalBefore = await xToken.balanceOf(admin.address);
        const yBalBefore = await yToken.balanceOf(admin.address);

        // calculate how much y should be received
        const [xReserves, yReserves] = await Promise.all([adminAmm.xReserves(), adminAmm.yReserves()]);
        const newXReserves = xReserves.add(x);
        const newYReserves = xReserves.mul(yReserves).div(newXReserves);
        const yToReceive = yReserves.sub(newYReserves);

        await adminXToken.approve(adminAmm.address, x);

        // check sell x event
        await expect(adminAmm.sellX(x)).to.emit(adminAmm, "SellX").withArgs(admin.address, x, yToReceive);

        // balances after
        const xBalAfter = await xToken.balanceOf(admin.address);
        const yBalAfter = await yToken.balanceOf(admin.address);

        expect(xBalBefore.sub(xBalAfter)).to.eq(x);
        expect(yBalAfter.sub(yBalBefore)).to.eq(yToReceive);
      });

      it("should sell y", async () => {
        const y = parseEther("1");

        // balances before
        const xBalBefore = await xToken.balanceOf(admin.address);
        const yBalBefore = await yToken.balanceOf(admin.address);

        // calculate how much x should be received
        const [xReserves, yReserves] = await Promise.all([adminAmm.xReserves(), adminAmm.yReserves()]);
        const newYReserves = yReserves.add(y);
        const newXReserves = xReserves.mul(yReserves).div(newYReserves);
        const xToReceive = xReserves.sub(newXReserves);

        await adminYToken.approve(adminAmm.address, y);

        // check sell x event
        await expect(adminAmm.sellY(y)).to.emit(adminAmm, "SellY").withArgs(admin.address, y, xToReceive);

        // balances after
        const xBalAfter = await xToken.balanceOf(admin.address);
        const yBalAfter = await yToken.balanceOf(admin.address);

        expect(xBalAfter.sub(xBalBefore)).to.eq(xToReceive);
        expect(yBalBefore.sub(yBalAfter)).to.eq(y);
      });
    });
  });
});
