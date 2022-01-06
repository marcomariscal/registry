import { artifacts, ethers, waffle } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import type { Registry } from "../../src/types/Registry";
import { expect } from "chai";

const { deployContract } = waffle;

describe("Registry", async () => {
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;

  let registry: Registry;

  const name = "nice"; // name to claim
  const name2 = "nicer"; // additional name to claim

  before(async () => {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
  });

  describe("claim", () => {
    it("should not allow for claiming a specific name multiple times", async () => {
      // claim name initially with admin
      await registry.connect(admin).claim(name);
      // try to claim name again with user1
      await expect(registry.connect(user1).claim(name)).to.be.revertedWith("name already claimed");
      // try to claim name again with admin
      await expect(registry.connect(admin).claim(name)).to.be.revertedWith("name already claimed");
    });

    it("should claim name with proper owner", async () => {
      await registry.connect(admin).claim(name);
      expect(await registry.nameToOwner(name)).to.equal(admin.address);
    });

    it("should allow for multiple distinct name claiming with same owner", async () => {
      await registry.connect(admin).claim(name);
      await registry.connect(admin).claim(name2);
      expect(await registry.nameToOwner(name)).to.equal(admin.address);
      expect(await registry.nameToOwner(name2)).to.equal(admin.address);
    });
  });

  describe("release", () => {
    beforeEach(async () => {
      const registryArtifact = await artifacts.readArtifact("Registry");
      registry = <Registry>await deployContract(admin, registryArtifact);
    });

    it("should not release name if not owner", async () => {
      await expect(registry.connect(user1).release(name)).to.be.revertedWith("not owner");
    });

    it("should release name if owner", async () => {
      await registry.connect(admin).claim(name);
      await registry.connect(admin).release(name);
      expect(await registry.nameToOwner(name)).to.not.equal(admin.address);
    });
  });
});
