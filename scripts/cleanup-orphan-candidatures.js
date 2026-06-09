/**
 * 🚨 SESSION 52h — Cleanup massif des candidatures simulation orphelines en PRODUCTION
 *
 * À exécuter UNE FOIS en production pour purger les candidatures SIMULATION qui ont
 * été créées AVANT les fixes de validation stricte (sessions 52c/52d) et qui sont
 * incomplètes (1 jour de présence sans animation).
 *
 * ⚠️ SÉCURITÉ :
 *   - Ne supprime QUE les regs avec is_simulation=true OU organization_name commence par "[SIM]"
 *   - Les vraies candidatures sont RAPPORTÉES mais JAMAIS supprimées automatiquement
 *
 * USAGE :
 *   1. Copier ce fichier sur le serveur de production
 *   2. Configurer MONGO_URL et DB_NAME
 *   3. node scripts/cleanup-orphan-candidatures.js --dry-run    (simulation, n'efface rien)
 *   4. node scripts/cleanup-orphan-candidatures.js --apply       (effectue la purge)
 */

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'your_database_name';
const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  console.log(`\n🔍 Cleanup orphan candidatures — ${DRY_RUN ? 'DRY-RUN (rien sera supprimé)' : 'APPLY (suppression réelle)'}\n`);
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  // Charger toutes les regs actives (non annulées/refusées)
  const regs = await db.collection('registrations').find({ status: { $nin: ['annule', 'refuse', 'prospect'] } }).toArray();
  console.log(`Total registrations actives : ${regs.length}`);

  const orphans_sim = [];
  const orphans_real = [];

  for (const r of regs) {
    const days = (r.attending_days || []).filter(d => ['vendredi', 'samedi'].includes(d));
    if (days.length === 0) continue;
    const slots = await db.collection('animation_slots').find({ registration_id: r.id }).toArray();
    const missing = days.filter(d => !slots.some(s => s.day_label === d));
    if (missing.length === 0) continue;
    const isSim = r.is_simulation === true || (r.sim_session_id != null) || (r.organization_name || '').startsWith('[SIM]');
    const entry = { id: r.id, status: r.status, venue: r.venue_id, days, missing, slots: slots.length, org: r.organization_name };
    if (isSim) orphans_sim.push(entry); else orphans_real.push(entry);
  }

  console.log(`\n🔴 Simulations orphelines : ${orphans_sim.length}`);
  orphans_sim.slice(0, 20).forEach(o => console.log(`  - ${o.id} | ${o.org} | ${o.venue} | missing=${o.missing}`));

  console.log(`\n⚠️  Vraies candidatures orphelines (NON SUPPRIMÉES) : ${orphans_real.length}`);
  orphans_real.forEach(o => console.log(`  - ${o.id} | ${o.org} | ${o.venue} | status=${o.status} | missing=${o.missing}`));

  if (!DRY_RUN && orphans_sim.length > 0) {
    const ids = orphans_sim.map(o => o.id);
    const orgs = [...new Set(orphans_sim.map(o => regs.find(r => r.id === o.id)?.organization_id).filter(Boolean))];
    const cascades = ['animation_slots','stand_assignments','validation_requests','registration_documents','deposit_transactions','attendance_sessions','modification_tokens','modification_requests'];
    for (const c of cascades) {
      const r = await db.collection(c).deleteMany({ registration_id: { $in: ids } });
      console.log(`  ${c}: ${r.deletedCount} supprimés`);
    }
    const regDel = await db.collection('registrations').deleteMany({ id: { $in: ids } });
    console.log(`  registrations: ${regDel.deletedCount} supprimées`);
    for (const orgId of orgs) {
      const remaining = await db.collection('registrations').countDocuments({ organization_id: orgId });
      if (remaining === 0) {
        const org = await db.collection('organizations').findOne({ id: orgId });
        if (org && org.is_simulation) {
          await db.collection('organizations').deleteOne({ id: orgId });
          await db.collection('users').deleteMany({ organization_id: orgId, is_simulation: true });
        }
      }
    }
    console.log(`\n✅ Purge terminée.`);
  } else if (DRY_RUN) {
    console.log(`\nℹ️  DRY-RUN — relancer avec --apply pour effectuer la suppression.`);
  }

  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
