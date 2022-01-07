import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { Registry__factory } from "../../src/types/factories/Registry__factory";
import { Registry } from "../../src/types/Registry";

task("deploy:Registry").setAction(async (taskArgs: TaskArguments, { ethers }) => {
  const [deployer] = await ethers.getSigners();

  const registryFactory = <Registry__factory>await ethers.getContractFactory("Registry");
  const registry = <Registry>await registryFactory.deploy();
  await registry.deployed();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log("Registry deployed to address:", registry.address);
});
