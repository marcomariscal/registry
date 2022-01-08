import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { ERC20Mock__factory } from "../../src/types/factories/ERC20Mock__factory";
import { ERC20Mock } from "../../src/types/ERC20Mock";

import { Vault1__factory } from "../../src/types/factories/Vault1__factory";
import { Vault1 as Vault } from "../../src/types/Vault1";

task("deploy:Vault1").setAction(async (taskArgs: TaskArguments, { ethers }) => {
  const [deployer] = await ethers.getSigners();

  const tokenFactory = <ERC20Mock__factory>await ethers.getContractFactory("ERC20Mock");
  const token = <ERC20Mock>await tokenFactory.deploy("Test", "TST");
  await token.deployed();

  const vaultFactory = <Vault1__factory>await ethers.getContractFactory("Vault1");
  const vault = <Vault>await vaultFactory.deploy(token.address);
  await vault.deployed();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Token deployed to address:", token.address);
  console.log("Vault deployed to address:", vault.address);
});
