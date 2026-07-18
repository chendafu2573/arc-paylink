/**
 * 本脚本把 Agent Vault 编译为部署脚本和前端共用的 ABI/bytecode artifact。
 * 编译器版本由 package-lock 固定；任何 Solidity error 都会阻止 artifact 更新。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import solc from "solc";

const sourcePath = new URL("../contracts/ArcPaylinkAgentVault.sol", import.meta.url);
const outputPath = new URL("../src/generated/agent-vault.json", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const input = {
  language: "Solidity",
  sources: {
    "ArcPaylinkAgentVault.sol": { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object"] },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const failures = (output.errors ?? []).filter((entry) => entry.severity === "error");
if (failures.length) {
  throw new Error(failures.map((entry) => entry.formattedMessage).join("\n"));
}

const contract = output.contracts["ArcPaylinkAgentVault.sol"].ArcPaylinkAgentVault;
await mkdir(new URL("../src/generated/", import.meta.url), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      contractName: "ArcPaylinkAgentVault",
      compilerVersion: solc.version(),
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
    },
    null,
    2,
  )}\n`,
);

console.log(`Compiled ArcPaylinkAgentVault with ${solc.version()}`);
