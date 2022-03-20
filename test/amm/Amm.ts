import { artifacts, ethers, waffle } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { Amm, LiquidityEvent } from "../../src/types/Amm";
import type { ERC20Mock } from "../../src/types/ERC20Mock";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import _ from "underscore";

const { deployContract } = waffle;
const { parseEther } = utils;

const ONE = ethers.constants.One;
const ZERO = ethers.constants.Zero;

const calculateK = (_x: BigNumber, _y: BigNumber) => _x.mul(_y);

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
      const _x = parseEther("10");
      const _y = parseEther("10");
      const _k = calculateK(_x, _y);
      const _args = [admin.address, _x, _y, _k];

      await adminXToken.approve(adminAmm.address, _x);
      await adminYToken.approve(adminAmm.address, _y);

      await expect(adminAmm.init(_x, _y))
        .to.emit(adminAmm, "Liquidity")
        .withArgs(..._args);

      expect(await adminAmm.balanceOf(admin.address)).to.eq(_k);
      expect(await adminAmm.xReserves()).to.eq(_x);
      expect(await adminAmm.yReserves()).to.eq(_y);
    });

    it("should not allow initialize after already init", async () => {
      const _x = parseEther("10");
      const _y = parseEther("10");

      await expect(adminAmm.init(_x, _y)).to.be.revertedWith("pool already initialized");
    });

    describe("with liquidity", async () => {
      it("should not mint amm tokens when x and y have different amounts", async () => {
        const _x = parseEther("1");
        const _y = parseEther("1.5");

        await expect(adminAmm.mint(_x, _y)).to.be.revertedWith("ratio of sent tokens does not match amm");
      });

      it("should mint amm tokens", async () => {
        const _x = parseEther("1");
        const _y = parseEther("1");

        const [xTokensBefore, yTokensBefore, xReserves, ammTokensBefore] = await Promise.all([
          adminXToken.balanceOf(admin.address),
          adminYToken.balanceOf(admin.address),
          adminAmm.xReserves(),
          adminAmm.balanceOf(admin.address),
        ]);

        await adminXToken.approve(adminAmm.address, _x);
        await adminYToken.approve(adminAmm.address, _y);
        await adminAmm.mint(_x, _y);

        const [xTokensAfter, yTokensAfter, ammTokensAfter] = await Promise.all([
          adminXToken.balanceOf(admin.address),
          adminYToken.balanceOf(admin.address),
          adminAmm.balanceOf(admin.address),
        ]);

        expect(xTokensBefore.sub(xTokensAfter)).to.eq(_x);
        expect(yTokensBefore.sub(yTokensAfter)).to.eq(_y);

        expect(ammTokensAfter.sub(ammTokensBefore)).to.eq(_x.div(xReserves));
      });

      it("should burn amm tokens", async () => {
        const _amount = parseEther("1");

        const ammTokensBefore = await adminAmm.balanceOf(admin.address);
        await adminAmm.burn(_amount);
        const ammTokensAfter = await adminAmm.balanceOf(admin.address);

        expect(ammTokensBefore.sub(ammTokensAfter)).to.eq(_amount);
      });

      it("should sell x", async () => {
        const _x = parseEther("1");

        const xBalBefore = await xToken.balanceOf(admin.address);
        await adminAmm.sellX(_x);
        const xBalAfter = await xToken.balanceOf(admin.address);

        expect(xBalBefore.sub(xBalAfter)).to.eq(_x);
        await expect(adminAmm.sellX(_x)).to.emit(adminAmm, "SellX");
        // .withArgs(..._args);
      });

      it("should sell y", async () => {
        const _y = parseEther("1");

        const yBalBefore = await yToken.balanceOf(admin.address);
        await adminAmm.sellY(_y);
        const yBalAfter = await yToken.balanceOf(admin.address);

        expect(yBalBefore.sub(yBalAfter)).to.eq(_y);
        await expect(adminAmm.sellY(_y)).to.emit(adminAmm, "SellY");
        // .withArgs(..._args);
      });
    });
  });
});
