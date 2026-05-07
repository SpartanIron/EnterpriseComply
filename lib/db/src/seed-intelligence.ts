// Superseded by seed-colorcomply.ts - kept as stub to avoid removing from any scripts

export async function seedIntelligence() {
  console.log("seed-intelligence is a no-op (superseded by seed-colorcomply.ts)");
}

if (require.main === module) {
  seedIntelligence().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
