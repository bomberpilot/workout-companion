const { spawnSync } = require("node:child_process");
const path = require("node:path");

// Informational inventory: advisories must be triaged, not hidden by forced updates.
// Invalid audit responses are errors; a valid report with advisories is still printed.
for (const directory of [".", "functions"]) {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["audit", "--json"], {
    cwd: path.resolve(__dirname, "..", directory),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error("npm audit did not return valid JSON for " + directory);
  }
  if (report.error || !report.metadata?.vulnerabilities) {
    throw new Error("npm audit could not complete for " + directory);
  }
  const inventory = Object.entries(report.vulnerabilities ?? {}).map(([name, advisory]) => ({
    name,
    severity: advisory.severity,
    direct: advisory.isDirect,
    vulnerableRange: advisory.range,
    installedPaths: advisory.nodes,
    fixAvailable: advisory.fixAvailable,
    via: advisory.via.map((item) => typeof item === "string" ? item : ({
      title: item.title,
      url: item.url,
      severity: item.severity,
      range: item.range,
    })),
  }));
  console.log(JSON.stringify({ directory, totals: report.metadata.vulnerabilities, inventory }));
}
