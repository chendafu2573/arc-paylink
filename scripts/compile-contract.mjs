/**
 * 本脚本把托管合约编译为前端和部署脚本共用的 ABI/bytecode artifact。
 * Solidity 编译器版本由 package-lock 固定；出现 warning 时必须人工审查后再部署。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import solc from "solc";

const sourcePath = new URL("../contracts/ArcPaylinkEscrow.sol", import.meta.url);
const outputPath = new URL("../src/generated/escrow.json", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const input = {
  language: "Solidity",
  sources: {
    "ArcPaylinkEscrow.sol": { content: source },
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

const contract = output.contracts["ArcPaylinkEscrow.sol"].ArcPaylinkEscrow;
await mkdir(new URL("../src/generated/", import.meta.url), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      contractName: "ArcPaylinkEscrow",
      compilerVersion: solc.version(),
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
    },
    null,
    2,
  )}\n`,
);

console.log(`Compiled ArcPaylinkEscrow with ${solc.version()}`);
