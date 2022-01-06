import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { Registry__factory } from "../../src/types/factories/Registry__factory";
import { Registry } from "../../src/types/Registry";

task("deploy:Registry").setAction(async (taskArgs: TaskArguments, { ethers }) => {
  const registryFactory = <Registry__factory>await ethers.getContractFactory("Greeter");
  const registry = <Registry>await registryFactory.deploy();
  await registry.deployed();
  console.log("Registry deployed to: ", registry.address);
});
